// QR code do convite da live (qrcode-generator, MIT, sem dependências). Desenhado como um
// único <path> SVG nas cores da paleta, com a margem branca que os leitores de celular pedem.
import qrcode from 'qrcode-generator';

/** Módulos do QR (true = escuro). Correção 'M': aguenta reflexo e compressão da live. */
export function qrMatrix(text: string): boolean[][] {
  const qr = qrcode(0, 'M');
  qr.addData(text, 'Byte');
  qr.make();
  const n = qr.getModuleCount();
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)));
}

/** SVG escalável (viewBox em módulos) com `margin` módulos de borda clara. */
export function qrSvg(text: string, dark: string, light: string, margin = 4): string {
  const m = qrMatrix(text);
  const size = m.length + margin * 2;
  let d = '';
  for (let r = 0; r < m.length; r++) {
    for (let c = 0; c < m.length; c++) if (m[r][c]) d += `M${c + margin} ${r + margin}h1v1h-1z`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" role="img" aria-label="QR code do convite"><rect width="${size}" height="${size}" fill="${light}"/><path d="${d}" fill="${dark}"/></svg>`;
}
