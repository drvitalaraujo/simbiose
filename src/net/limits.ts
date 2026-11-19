// Limites do servidor contra abuso (puro): salas, conexões por endereço, mensagens por
// segundo e tamanho de mensagem. Os valores ficam aqui para teste e para o deploy (F4).

export interface ServerLimits {
  /** Salas abertas ao mesmo tempo no processo. */
  maxRooms: number;
  /** Salas criadas por um mesmo IP que ainda estão abertas. */
  roomsPerIp: number;
  /** Conexões de um mesmo IP somando todas as salas. */
  connectionsPerIp: number;
  /** Mensagens por segundo por conexão (60 comandos + eco do relógio + folga para jitter). */
  messagesPerSecond: number;
  /** Tamanho máximo de uma mensagem (bytes). Um comando tem menos de 30. */
  maxPayload: number;
}

export const DEFAULT_LIMITS: Readonly<ServerLimits> = {
  maxRooms: 40,
  roomsPerIp: 3,
  connectionsPerIp: 8,
  messagesPerSecond: 150,
  maxPayload: 1024,
};

const LIMIT_ENV: Record<keyof ServerLimits, string> = {
  maxRooms: 'SIMBIOSE_MAX_ROOMS', roomsPerIp: 'SIMBIOSE_ROOMS_PER_IP',
  connectionsPerIp: 'SIMBIOSE_CONNECTIONS_PER_IP', messagesPerSecond: 'SIMBIOSE_MESSAGES_PER_SECOND',
  maxPayload: 'SIMBIOSE_MAX_PAYLOAD',
};

/** Falha cedo se uma cota inválida desligaria a proteção por acidente. */
export function validateLimits(limits: ServerLimits): ServerLimits {
  for (const key of Object.keys(LIMIT_ENV) as (keyof ServerLimits)[]) {
    if (!Number.isSafeInteger(limits[key]) || limits[key] < 1) {
      throw new Error(`${LIMIT_ENV[key]} precisa ser um inteiro positivo`);
    }
  }
  return limits;
}

export function limitsFromEnv(env: Record<string, string | undefined>): ServerLimits {
  const limits = { ...DEFAULT_LIMITS };
  for (const key of Object.keys(LIMIT_ENV) as (keyof ServerLimits)[]) {
    const raw = env[LIMIT_ENV[key]];
    if (raw !== undefined && raw !== '') limits[key] = Number(raw);
  }
  return validateLimits(limits);
}

/** Contador por chave (IP) com teto. */
export class Quota {
  private readonly counts = new Map<string, number>();

  /** Soma 1 se ainda couber no teto; devolve se coube. */
  tryAdd(key: string, max: number): boolean {
    const n = this.counts.get(key) ?? 0;
    if (n >= max) return false;
    this.counts.set(key, n + 1);
    return true;
  }

  remove(key: string) {
    const n = (this.counts.get(key) ?? 0) - 1;
    if (n > 0) this.counts.set(key, n);
    else this.counts.delete(key);
  }

  count(key: string): number {
    return this.counts.get(key) ?? 0;
  }
}

/**
 * Ferramentas de teste do servidor (teleporte "debug-perto") só existem em desenvolvimento:
 * precisa da variável SIMBIOSE_DEBUG=1 E de NODE_ENV diferente de 'production'.
 */
export function debugAllowed(env: Record<string, string | undefined>): boolean {
  return env.SIMBIOSE_DEBUG === '1' && env.NODE_ENV !== 'production';
}

/** Configuração perigosa: debug pedido num servidor de produção. O servidor se recusa a subir. */
export function debugMisconfigured(env: Record<string, string | undefined>): boolean {
  return env.SIMBIOSE_DEBUG === '1' && env.NODE_ENV === 'production';
}
