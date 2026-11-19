import { PALETTE as C } from '../toon';
import { planeGeo } from '../world/textures';
import { Builder, place } from '../world/builder';
import { FAVELA_STAIRWAYS } from './favela';
import { FavelaArt } from './favela-art';

const deco = { solid: false, shoot: false, cast: false, outline: 0 };
/** Marcos e comércios ancorados na arquitetura: informação no alto, silhuetas limpas embaixo. */
export function favelaLandmarks(b: Builder, art: FavelaArt) {
  art.panel(art.mural(), -6, 3.15, 24.978, 12.4, 5.5, Math.PI);
  art.panel(art.sign('ASSOCIAÇÃO DO SOL', 'BIBLIOTECA • OFICINAS • FUTURO', C.clothTeal), -6, 6.55, 24.96, 12.2, 1.25, Math.PI);
  // Faixas entre janelas: a tipografia não fica cortada pelos caixilhos salientes.
  art.panel(art.sign('FAVELA DO SOL', 'NOSSA HISTÓRIA TEM FUTURO', C.ochre, C.inkSoft), 2, 9.3, -24.975, 11.4, 1.1);
  art.panel(art.sign('OFICINA DO NANDO', 'REPARO • REUSO • RESISTÊNCIA', C.colonialMoss), 0, 6.05, -14.975, 8.8, 1.1);
  art.panel(art.sign('MERCEARIA DA DONA LUZ', 'FIADO SÓ PRA QUEM DESLIGA O ALGORITMO', C.colonialMoss), -19, 6.05, -12.975, 8.8, 1.1);
  art.panel(art.sign('BARBEARIA RAIZ', 'CORTE NA RÉGUA • CONVERSA LIVRE', C.colonialRed), 5, 6.05, 14.972, 7.2, 1.1, Math.PI);
  art.panel(art.sign('SAMBA & RESISTÊNCIA', 'A CULTURA NÃO TEM DONO', C.ochre, C.inkSoft), 22.025, 6.05, -18.5, 7.8, 1.1, Math.PI / 2);
  art.panel(art.sign('ATELIÊ DA COMUNIDADE', 'COSTURANDO OUTRO FUTURO', C.clothTeal), -17, 6.05, 21.025, 10.5, 1.1);
  art.panel(art.sign('BICA', 'ÁGUA É DIREITO', C.colonialSky, C.glass), 20.975, 5.95, 0.5, 6.7, 1, -Math.PI / 2);
  art.panel(art.sign('QUADRA DO SOL', 'NA RAÇA • NO RESPEITO', C.clothTeal), -10.626, 1.45, 5.5, 4.7, 1.6, Math.PI / 2);
  art.panel(art.sign('OTIMIZA', 'O SEU TEMPO RENDE MAIS PARA NÓS.', C.glass), 30.97, 6.5, 7, 7.6, 1.4, -Math.PI / 2);

  // Azulejo geométrico da bica: identidade de trecho sem ocupar o corredor.
  for (let z = -3.7; z < 4.8; z += 0.42) for (let y = 0.2; y < 2.5; y += 0.42) {
    b.block(20.97, y, z, 20.985, y + 0.39, z + 0.39, C.cal, deco);
    b.block(20.945, y + 0.1, z + 0.1, 20.965, y + 0.29, z + 0.29, C.colonialSky, deco);
  }
  // Painéis no trecho plano da laje da oficina, ao lado do pavimento com telhado.
  b.block(2.1, 8.03, -21.5, 4.7, 8.12, -17, C.steel, deco);
  for (let x = 2.2; x < 4.5; x += 1.25) for (let z = -21.4; z < -17.2; z += 1.1) {
    b.block(x, 8.12, z, x + 1.1, 8.15, z + 0.98, C.glass, deco);
  }
}

/** Calçamento acompanha os circuitos quebrados; a cor da quadra marca a área de risco. */
export function favelaPaving(b: Builder, art: FavelaArt) {
  const flat = (x0: number, z0: number, x1: number, z1: number, color: number, y = 0.013) => b.block(x0, y, z0, x1, y + 0.006, z1, color, deco);
  // Cada retângulo é um trecho urbano; sobreposições de mesma altura são evitadas.
  for (const [x0, z0, x1, z1] of [
    [-30.5, -23.5, -24.5, -10.5], [-26.5, -10.5, -22.5, 2.5], [-31.5, 3.5, -28.5, 13.5],
    [-25.5, 14, -23.5, 26.5], [-23.5, 21.5, -13.5, 26.5], [-13.5, 21.5, 0.5, 24.5],
    [22.5, -18.5, 29.5, -8.5], [22.5, -6.5, 26.5, -4.5], [27.5, 2.5, 30.5, 11.5],
    [20.5, 11.5, 28.5, 23.5], [1.5, 23.5, 16.5, 27.5], [-10.5, -14.5, 11.5, -11.5],
  ]) flat(x0, z0, x1, z1, C.cobbleStone);
  // Quadra de cimento pintada à mão: linhas falhadas, tinta gasta onde mais se pisa e rachaduras.
  const court = planeGeo(20, 21, art.court).rotateX(-Math.PI / 2);
  b.add(place(court, 0, 0.021, 3.5), art.material, { cast: false });
  // Calçada portuguesa da associação com miolo claro e borda de duas cores.
  flat(-10.5, 20, 0.5, 24.5, C.cal, 0.022);
  for (let x = -10; x < 0; x += 0.8) for (const z of [20.1, 23.8]) flat(x, z, x + 0.38, z + 0.38, C.cantaria, 0.031);
  for (const stair of FAVELA_STAIRWAYS) for (let i = 0; i < stair.steps.length; i++) {
    const { min: p, max: q } = stair.steps[i].box;
    const alongX = q.x - p.x < q.z - p.z;
    flat(p.x + 0.05, p.z + 0.05, alongX ? p.x + 0.14 : q.x - 0.05, alongX ? q.z - 0.05 : p.z + 0.14, i % 2 ? C.cal : C.ochre, q.y + 0.009);
  }
  // Bueiros pequenos assentados no piso reforçam escala humana, sem volumes invisíveis.
  for (const [x, z] of [[-27.5, -16], [-24.5, 17], [26, -12], [25, 17], [-8, -17], [11, 25]]) {
    flat(x - 0.35, z - 0.3, x + 0.35, z + 0.3, C.steel, 0.026);
    for (let i = 0; i < 5; i++) flat(x - 0.28, z - 0.24 + i * 0.11, x + 0.28, z - 0.2 + i * 0.11, C.inkSoft, 0.033);
  }
}
