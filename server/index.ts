// Servidor do modo online (Colyseus 0.18). Rode com `npm run server`.
// Porta: 2567 (ou a variável de ambiente PORT).
import { debugAllowed, debugMisconfigured } from '../src/net/limits';
import { DEFAULT_PORT, ROOM_NAME } from '../src/net/protocol';
import { createServer } from './server';

// Ferramenta de teste ligada em produção é furo: recusa subir em vez de só avisar
if (debugMisconfigured(process.env)) {
  console.error('[SIMBIOSE] SIMBIOSE_DEBUG=1 com NODE_ENV=production: recusando subir o servidor.');
  process.exit(1);
}
const port = Number(process.env.PORT) || DEFAULT_PORT;
await createServer().listen(port);
console.info(`[SIMBIOSE] servidor online em ws://localhost:${port} (sala "${ROOM_NAME}")`);
if (debugAllowed(process.env)) console.info('[SIMBIOSE] modo de teste: mensagem "debug-perto" ligada (só desenvolvimento)');
