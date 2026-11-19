// Carga limitada, somente no endereço passado explicitamente. Usa o SDK do lockfile.
import { Client, type Room } from '@colyseus/sdk';
import { ArenaState, MoveInput } from '../src/net/schema';
import { ROOM_NAME } from '../src/net/protocol';
import { MSG } from '../src/net/feed';

const endpoint = process.argv[2];
const players = Number(process.argv[3] ?? 8);
const seconds = Number(process.argv[4] ?? 15);
if (!endpoint || !/^wss?:\/\//.test(endpoint) || !Number.isInteger(players) || players < 1 || players > 64 ||
  !Number.isInteger(seconds) || seconds < 1 || seconds > 120) {
  throw new Error('Uso: npx --no-install tsx scripts/load-online.ts ws://localhost:2568 [jogadores 1..64] [segundos 1..120]');
}
const rooms: Room<unknown, ArenaState>[] = [];
const client = new Client(endpoint, { timeout: 5000 });
let timer: ReturnType<typeof setInterval> | undefined;
// Mesmo se matchmaking ou saída travar, o processo nunca passa de 3 minutos.
const deadline = setTimeout(() => { console.error('Carga interrompida pelo teto de execução'); process.exit(1); }, 180_000);
try {
  for (let i = 0; i < players; i++) {
    const options = { nome: `Carga ${i + 1}`, mapa: 'arena', bots: 0 };
    const room = (i % 8 === 0
      ? await client.create(ROOM_NAME, options, ArenaState)
      : await client.joinById(rooms[Math.floor(i / 8) * 8].roomId, options, ArenaState)) as Room<unknown, ArenaState>;
    room.onMessage(MSG.sync, (n: unknown) => room.send(MSG.syncAck, n));
    room.onMessage('*', () => {});
    rooms.push(room);
  }
  const inputs = rooms.map((room) => room.input({ type: MoveInput, mode: 'reliable' }));
  let ticks = 0;
  const start = performance.now();
  timer = setInterval(() => {
    ticks++;
    for (const input of inputs) {
      input.data.moveX = ticks % 120 < 60 ? 1 : -1;
      input.data.moveZ = 0;
      input.data.yaw = 0;
      input.data.fire = true;
      input.send();
    }
  }, 1000 / 60);
  await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
  console.info(JSON.stringify({ endpoint, players, seconds, ticks, commandHz: ticks / ((performance.now() - start) / 1000),
    connected: rooms.filter((room) => room.connection.isOpen).length, rssMiB: Math.round(process.memoryUsage().rss / 1048576) }));
} finally {
  if (timer) clearInterval(timer);
  const timeout = new Promise<void>((resolve) => { const handle = setTimeout(resolve, 3000); handle.unref(); });
  await Promise.race([Promise.allSettled(rooms.map((room) => room.leave())), timeout]);
  clearTimeout(deadline);
}
// Não deixa um socket sem resposta manter o gerador vivo depois do teto de saída.
process.exit(0);
