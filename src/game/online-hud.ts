// Estado autoritativo para o HUD; conexão abaixo do minimapa, diagnósticos só no debug.
import type { KillFeedEvent } from '../net/feed';
import { MAGAZINE_SIZE, RESERVE_AMMO } from '../sim/ammo';
import type { WeaponState } from '../sim/weapon';
import { gunSpec } from '../sim/weapons';
import { CompetitiveHud, setCompetitiveMode, type MinimapDot, type MinimapSelf, type MinimapSolid } from './hud/index';
import { hudTeam, killView, matchEndView, type MatchPresentation, scoreView } from './online/hud-data';
import { hex, PALETTE } from './toon';

export interface NetStats {
  ping: number;
  errorCm: number;
  peakCm: number;
  players: number;
  pending: number;
  lag: string;
}

export interface MatchInfo extends MatchPresentation {
  phase: string;
  timeLeft: number;
  killLimit: number;
  winnerId: string;
  winnerName: string;
  match: number;
  me: string;
}

export class OnlineHud {
  readonly competitive = new CompetitiveHud();
  private readonly root = document.createElement('div');
  private readonly status = document.createElement('div');
  private readonly link = document.createElement('input');
  private readonly stats = document.createElement('div');
  private readonly next = document.createElement('div');
  private readonly controls = document.createElement('div');
  private readonly objective = document.createElement('div');
  private match = -1;
  private phase = '';
  private deathId = '';
  private readyAgain = false;
  private readonly debug = import.meta.env.DEV && new URLSearchParams(location.search).has('debug');

  constructor() {
    setCompetitiveMode(true);
    this.root.className = 'online-connection';
    this.root.style.cssText = `position:fixed;top:210px;left:12px;z-index:6;padding:6px 8px;max-width:180px;font:11px system-ui;color:${hex(PALETTE.paper)};background:${hex(PALETTE.ink)}cc;border-radius:4px;overflow-wrap:anywhere`;
    this.status.textContent = 'Conectando…';
    this.link.readOnly = true;
    this.link.hidden = true;
    this.link.style.cssText = `box-sizing:border-box;width:100%;margin:5px 0;font:inherit;color:${hex(PALETTE.ink)};background:${hex(PALETTE.paper)};border:0;padding:3px`;
    this.link.title = 'Copie o link da sala para convidar amigos';
    this.link.setAttribute('aria-label', 'Link de convite da sala');
    this.link.addEventListener('focus', () => this.link.select());
    this.controls.textContent = 'Segure C: agachar · Shift: andar em silêncio · V: Chinelada · G: arremessar · Q: granada HE';
    this.root.append(this.status, this.link, this.stats, this.controls, this.objective);
    this.next.className = 'online-next';
    this.next.style.cssText = 'position:fixed;bottom:12px;left:50%;transform:translateX(-50%);z-index:7;color:var(--paper);font:700 14px system-ui;pointer-events:none';
    this.next.hidden = true;
    document.body.append(this.root, this.next);
    this.competitive.setWeapon('Gambiarra MK-2');
    this.competitive.setAmmo(MAGAZINE_SIZE, RESERVE_AMMO, MAGAZINE_SIZE);
    this.competitive.setScoreboardTitle('PLACAR · TODOS CONTRA TODOS');
  }

  setStatus(text: string) { this.status.textContent = text; }
  setLink(url: string) { this.link.value = url; this.link.hidden = false; }

  setStats(n: NetStats) {
    const basic = `${Math.round(n.ping)} ms · ${n.players} jogadores`;
    this.stats.textContent = this.debug
      ? `${basic} · correção ${n.errorCm.toFixed(1)} cm (pico ${n.peakCm.toFixed(1)}) · ${n.pending} comandos${n.lag ? ` · atraso simulado ${n.lag}` : ''}`
      : basic;
  }

  setHp(hp: number, max: number) { this.competitive.setVitals(hp, max); }
  setAmmo(w: WeaponState) {
    const spec = gunSpec(w.weaponIndex);
    this.competitive.setWeapon(spec.name);
    this.competitive.setAmmo(w.ammo, w.reserveAmmo, spec.magazineSize, w.reloadRemaining > 0, 1 - w.reloadRemaining / spec.reloadTime);
  }
  setSlipper(ready: boolean) { this.controls.textContent = `Direito: mirar · 1–4: trocar arma · R: recarregar · E: hack · C: agachar · Shift: andar em silêncio · Q: granada HE · V/G: Chinelada · ${ready ? 'chinelo na mão' : 'recolha seu chinelo'}`; }
  setHackStatus(text: string) { this.objective.textContent = text; this.objective.hidden = !text; }
  setMap(solids: readonly MinimapSolid[]) { this.competitive.setMinimap(solids); }
  setPosition(self: MinimapSelf, others: MinimapDot[] = []) {
    // Receber todos na rede não concede visão dos inimigos pelo minimapa (só o drone aliado marca).
    this.competitive.setMinimapPlayers(self, others);
  }
  hit(headshot: boolean, killed: boolean) { this.competitive.hitMarker(killed ? 'kill' : headshot ? 'head' : 'body'); }
  hurt(angle = 0, damage = 25) { this.competitive.damageFrom(angle, damage / 50); }

  kill(e: KillFeedEvent, me: string) {
    const event = killView(e);
    this.competitive.pushKill(event);
    if (e.killerId === me && e.victimId !== me) this.competitive.killMarker(event.victim, e.headshot);
  }

  setDeath(info: { event: KillFeedEvent | null; respawnIn: number; killerHp?: number } | null) {
    if (!info) {
      this.deathId = '';
      this.competitive.hideDeath();
      return;
    }
    const id = info.event ? `${info.event.killerId}/${info.event.victimId}` : 'environment';
    if (id === this.deathId) return;
    this.deathId = id;
    const kill = info.event ? killView(info.event) : null;
    this.competitive.showDeath({ killer: kill?.killer ?? null, weapon: kill?.weapon ?? 'Ambiente', headshot: info.event?.headshot, respawnIn: info.respawnIn, killerHp: info.killerHp });
  }

  setMatch(m: MatchInfo, dt: number) {
    const mine = m.rows.find((r) => r.id === m.me);
    const teams = m.mode === 'tdm' || m.mode === 'hack';
    const modeLabel = m.mode === 'hack' ? 'HACKEIA E SEGURA' : m.mode === 'tdm' ? 'TDM 3v3' : m.mode === 'duel' ? 'DUELO 1v1' : 'TODOS CONTRA TODOS';
    this.competitive.setLocalPlayer({ id: m.me, team: hudTeam(mine?.team) });
    if (m.match !== this.match) {
      this.match = m.match;
      this.competitive.reset();
      this.deathId = '';
      this.phase = '';
      this.readyAgain = false;
    }
    if (m.phase !== this.phase) {
      this.phase = m.phase;
      if (m.phase === 'ended') {
        if (document.pointerLockElement) document.exitPointerLock();
        this.competitive.showMatchEnd(matchEndView(m), {
          // A revanche pertence à sala: não reconecta nem abandona os amigos.
          onPlayAgain: () => { this.readyAgain = true; },
          onMenu: () => { location.assign(location.pathname); },
        });
      } else {
        this.competitive.hideMatchEnd();
        this.competitive.announce(m.phase === 'waiting' ? 'CHAME UM RIVAL!' : 'VALENDO!', m.phase === 'waiting' ? 'Compartilhe o link · a partida começa com dois jogadores' : `Primeiro a ${m.killLimit} ${m.mode === 'hack' ? 'pontos' : 'abates'}`, 'otimiza', 2);
      }
    }
    const ended = m.phase === 'ended';
    this.next.hidden = !ended;
    this.root.hidden = ended;
    if (ended) this.next.textContent = `${this.readyAgain ? 'Você está na revanche · ' : ''}Revanche em ${Math.max(0, Math.ceil(m.timeLeft))} s · mesma sala`;
    const lead = m.mode === 'duel' ? m.rows.find(r => r.id !== m.me) : m.rows[0];
    this.competitive.setScoreboard(scoreView(m.rows));
    this.competitive.setScoreboardTitle(`PLACAR · ${modeLabel}`);
    this.competitive.setTimer(m.timeLeft, false);
    this.competitive.setRound(m.phase === 'waiting' ? 'AGUARDANDO RIVAL' : `PARTIDA ${m.match}`);
    this.competitive.setModeLabel(`${modeLabel} · ${m.killLimit} ${m.mode === 'hack' ? 'PONTOS' : 'ABATES'}`);
    if (teams) {
      const b = mine?.team === 'b';
      this.competitive.setTopScores({ value: (b ? m.scoreB : m.scoreA) ?? 0, label: 'SEU TIME' }, { value: (b ? m.scoreA : m.scoreB) ?? 0, label: 'RIVAIS' });
    } else this.competitive.setTopScores({ value: mine?.kills ?? 0, label: 'VOCÊ' }, { value: lead?.kills ?? 0, label: m.mode === 'duel' ? 'RIVAL' : 'LÍDER' });
    this.competitive.update(dt);
  }

  destroy() {
    this.competitive.destroy();
    this.root.remove();
    this.next.remove();
    setCompetitiveMode(false);
  }
}
