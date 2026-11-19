// Estilo do Modo Live/espectador (injetado uma vez). Cores só da PALETTE.
import { hex, PALETTE } from '../toon';

const ink = hex(PALETTE.ink);
const paper = hex(PALETTE.paper);
const pink = hex(PALETTE.pink);
const cyan = hex(PALETTE.cyan);
const yellow = hex(PALETTE.yellow);
const lilac = hex(PALETTE.lilac);
const skyDeep = hex(PALETTE.skyDeep);

const CSS = `
body.mode-spectator #hud, body.mode-spectator #death { display: none !important; }
.chud.spectating .ch-bottom, .chud.spectating .ch-markers, .chud.spectating .ch-minimap { display: none; }
.sp-bar { position: fixed; left: 50%; bottom: 14px; transform: translateX(-50%); z-index: 8; display: flex; gap: 10px; align-items: center;
  font: 700 13px system-ui; color: ${paper}; pointer-events: none; text-shadow: 0 2px 0 ${ink}; white-space: nowrap; }
.sp-who { padding: 6px 14px; background: ${ink}e6; border: 2px solid ${yellow}; border-radius: 4px; font-size: 18px; letter-spacing: .04em; }
.sp-who em { font-style: normal; color: ${yellow}; margin-right: 8px; font-size: 12px; }
.sp-who .bot { color: ${lilac}; font-size: 12px; margin-left: 6px; }
.sp-who .hp { color: ${cyan}; font-size: 13px; margin-left: 10px; }
.sp-who .hp.low { color: ${pink}; }
.sp-mode { padding: 5px 10px; background: ${pink}; color: ${ink}; border-radius: 3px; text-shadow: none; }
.sp-help { position: fixed; left: 12px; bottom: 12px; z-index: 8; font: 600 11px system-ui; color: ${paper}; background: ${ink}cc; padding: 6px 8px;
  border-radius: 4px; pointer-events: none; max-width: 300px; line-height: 1.5; }
.sp-help b { color: ${yellow}; }
.sp-wait { position: fixed; top: 108px; left: 50%; transform: translateX(-50%); z-index: 9; padding: 10px 18px; background: ${ink}ee;
  border: 2px solid ${cyan}; border-radius: 4px; color: ${paper}; font: 800 18px system-ui; letter-spacing: .03em; text-align: center; pointer-events: none; }
.sp-wait small { display: block; font: 600 12px system-ui; color: ${cyan}; margin-top: 3px; letter-spacing: 0; }
.sp-status { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 9; padding: 12px 18px; background: ${ink}ee;
  color: ${paper}; font: 600 14px system-ui; border-radius: 4px; max-width: 70vw; text-align: center; }

.lv-invite { position: fixed; bottom: 16px; right: 16px; z-index: 9; width: min(320px, 34vw); padding: 14px; background: ${ink}f0;
  border: 3px solid ${yellow}; border-radius: 6px; color: ${paper}; font: 600 13px system-ui; text-align: center; box-shadow: 6px 6px 0 ${pink}; }
.lv-invite.off { display: none; }
.lv-invite h2 { margin: 0 0 8px; font: 900 34px system-ui; letter-spacing: .06em; color: ${yellow}; text-shadow: 3px 3px 0 ${pink}; }
.lv-qr { background: ${paper}; border-radius: 4px; line-height: 0; }
.lv-qr svg { width: 100%; height: auto; display: block; }
.lv-code { margin-top: 10px; font: 900 22px ui-monospace, monospace; letter-spacing: .12em; color: ${cyan}; }
.lv-link { margin-top: 6px; font: 600 11px ui-monospace, monospace; color: ${paper}; overflow-wrap: anywhere; opacity: .85; }
.lv-hint { margin-top: 8px; font-size: 11px; color: ${lilac}; }
.lv-source { display: inline-block; margin-top: 6px; font-size: 10px; letter-spacing: .12em; color: ${lilac}; opacity: .8; }
.lv-count { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; font: 800 12px system-ui; }
.lv-count span { padding: 4px 8px; background: ${skyDeep}; color: ${paper}; border-radius: 3px; border-bottom: 3px solid ${cyan}; }
.lv-count span:first-child { border-color: ${yellow}; }
.lv-session { position: fixed; left: 12px; top: 12px; z-index: 8; width: 240px; padding: 8px 10px; background: ${ink}e0; color: ${paper};
  border-left: 4px solid ${yellow}; border-radius: 4px; font: 600 12px system-ui; pointer-events: none; }
.lv-session h3 { margin: 4px 0 6px; font: 900 13px system-ui; letter-spacing: .08em; color: ${yellow}; }
.lv-session ol { margin: 0; padding: 0; list-style: none; }
.lv-session li { display: grid; grid-template-columns: 18px 1fr auto; gap: 6px; padding: 2px 0; }
.lv-session li i { font-style: normal; color: ${lilac}; }
.lv-session li b { color: ${cyan}; font-weight: 800; }
.lv-session .empty { color: ${lilac}; font-weight: 500; }
.lv-podium { position: fixed; inset: 0; z-index: 12; display: flex; flex-direction: column; align-items: center; justify-content: center;
  background: ${skyDeep}f0; color: ${paper}; font: 600 14px system-ui; }
.lv-podium.off { display: none; }
.lv-podium h1 { margin: 0; font: 900 52px system-ui; letter-spacing: .08em; color: ${yellow}; text-shadow: 4px 4px 0 ${pink}; }
.lv-podium .winner { margin: 6px 0 24px; font: 800 20px system-ui; color: ${cyan}; }
.lv-steps { display: flex; align-items: flex-end; gap: 14px; }
.lv-step { width: 190px; text-align: center; }
.lv-step .name { font: 900 22px system-ui; margin-bottom: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lv-step .line { font: 600 12px system-ui; color: ${paper}; margin-bottom: 8px; }
.lv-step .block { background: ${ink}; border: 3px solid ${paper}; border-bottom: 0; font: 900 46px system-ui; display: flex; align-items: flex-start;
  justify-content: center; padding-top: 10px; }
.lv-step.p1 .block { height: 170px; border-color: ${yellow}; color: ${yellow}; }
.lv-step.p2 .block { height: 120px; border-color: ${cyan}; color: ${cyan}; }
.lv-step.p3 .block { height: 85px; border-color: ${pink}; color: ${pink}; }
.lv-podium .next { margin-top: 22px; font: 700 15px system-ui; color: ${paper}; }
`;

let injected = false;

export function injectSpectatorStyle() {
  if (injected) return;
  injected = true;
  const style = document.createElement('style');
  style.dataset.simbiose = 'spectator';
  style.textContent = CSS;
  document.head.append(style);
}
