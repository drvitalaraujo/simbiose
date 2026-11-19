// Grava o canvas do jogo em vídeo (webm) enquanto a Jogada da Partida toca, para o botão
// "SALVAR CLIPE". Sem `captureStream`/`MediaRecorder` (ou sem webm), fica desligado.

const TYPES = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];

function pickType(): string | null {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') return null;
  return TYPES.find(t => MediaRecorder.isTypeSupported(t)) ?? null;
}

export class ClipCapture {
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private done: Promise<Blob | null> | null = null;
  /** Último vídeo pronto. */
  blob: Blob | null = null;

  constructor(private readonly canvas: HTMLCanvasElement) {}

  get supported(): boolean {
    return typeof this.canvas.captureStream === 'function' && pickType() !== null;
  }

  get recording() { return this.recorder !== null; }

  start() {
    this.cancel();
    this.blob = null;
    const type = pickType();
    if (!type || typeof this.canvas.captureStream !== 'function') return;
    try {
      const stream = this.canvas.captureStream(30);
      const recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 6_000_000 });
      this.chunks = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) this.chunks.push(e.data); };
      this.done = new Promise(resolve => {
        recorder.onstop = () => {
          for (const track of stream.getTracks()) track.stop();
          resolve(this.chunks.length ? new Blob(this.chunks, { type: 'video/webm' }) : null);
        };
      });
      recorder.start(250);
      this.recorder = recorder;
    } catch (e) {
      console.warn('[replay] não deu para gravar o clipe', e);
      this.recorder = null;
    }
  }

  /** Para e guarda o vídeo em `blob`. */
  async stop(): Promise<Blob | null> {
    const recorder = this.recorder;
    if (!recorder) return this.blob;
    this.recorder = null;
    if (recorder.state !== 'inactive') recorder.stop();
    this.blob = (await this.done) ?? null;
    this.done = null;
    return this.blob;
  }

  /** Descarta a gravação em andamento. */
  cancel() {
    const recorder = this.recorder;
    this.recorder = null;
    this.done = null;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null;
      recorder.stop();
      for (const track of recorder.stream.getTracks()) track.stop();
    }
  }

  /** Baixa o último vídeo pronto. */
  download(name: string) {
    if (!this.blob) return;
    const url = URL.createObjectURL(this.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}

/** Nome do arquivo: "simbiose-jogada-lia-2026-10-09.webm" (sem acento nem espaço). */
export function clipFileName(author: string, date = new Date()): string {
  const slug = author.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'jogador';
  const day = date.toISOString().slice(0, 10);
  return `simbiose-jogada-${slug}-${day}.webm`;
}
