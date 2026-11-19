// Monta o servidor Colyseus com a sala "arena" (usado pelo index.ts e pelos testes).
import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { debugAllowed, limitsFromEnv, validateLimits, type ServerLimits } from '../src/net/limits';
import { ROOM_NAME } from '../src/net/protocol';
import { ArenaRoom } from './arena-room';

export interface ServerConfig {
  limits?: Partial<ServerLimits>;
  /** Ferramentas de teste (teleporte). Padrão: só em desenvolvimento com SIMBIOSE_DEBUG=1. */
  debug?: boolean;
}

export function createServer(config: ServerConfig = {}) {
  const limits = validateLimits({ ...limitsFromEnv(process.env), ...config.limits });
  ArenaRoom.limits = limits;
  ArenaRoom.debug = process.env.NODE_ENV !== 'production' && (config.debug ?? debugAllowed(process.env));
  // maxPayload: mensagem maior que isso derruba a conexão (um comando tem < 30 bytes)
  const server = new Server({ transport: new WebSocketTransport({ maxPayload: limits.maxPayload }), greet: false });
  server.define(ROOM_NAME, ArenaRoom);
  return server;
}
