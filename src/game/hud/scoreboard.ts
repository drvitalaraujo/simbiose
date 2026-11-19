// Placar (segurar Tab): jogadores por time, abates, mortes, (assist.), pontos, ping.
// A tabela só é refeita quando os dados mudam E o placar está aberto.
import { el, nameTag, Toggle } from './dom';
import { groupByTeam, kdRatio, type LocalView, pingLabel, relation } from './format';
import type { ScoreRow, TeamId } from './types';

export class Scoreboard {
  readonly root = el('div', 'ch-scoreboard');
  private readonly body = el('div', 'sb-body');
  private readonly title = el('div', 'sb-title');
  private readonly shown: Toggle;
  private rows: ScoreRow[] = [];
  private signature = '';
  private dirty = false;
  private visible = false;
  private teamNames: Record<TeamId, string> = { a: 'RESISTÊNCIA', b: 'GANGUE DA OTIMIZA' };

  constructor(private readonly local: () => LocalView) {
    this.root.append(el('div', 'sb-panel', this.title, this.body));
    this.shown = new Toggle(this.root, 'show');
    this.title.textContent = 'PLACAR';
  }

  setTitle(text: string) {
    this.title.textContent = text;
  }

  setTeamNames(a: string, b: string) {
    this.teamNames = { a, b };
    this.dirty = true;
  }

  setRows(rows: ScoreRow[]) {
    // Assinatura barata para saber se mudou (o placar costuma chegar a cada pacote da rede)
    let sig = '';
    for (const r of rows) sig += `${r.id}|${r.name}|${r.team}|${r.bot}|${r.kills}|${r.deaths}|${r.assists}|${r.ping}|${r.score};`;
    if (sig === this.signature) return;
    this.signature = sig;
    this.rows = rows.map((r) => ({ ...r }));
    this.dirty = true;
    if (this.visible) this.render();
  }

  show(on: boolean) {
    this.visible = on;
    this.shown.set(on);
    if (on && this.dirty) this.render();
  }

  get isShown() {
    return this.visible;
  }

  private render() {
    this.dirty = false;
    const me = this.local();
    const withAssists = this.rows.some((r) => r.assists !== undefined);
    const withScore = this.rows.some((r) => r.score !== undefined);
    const groups = groupByTeam(this.rows);
    const frag = document.createDocumentFragment();
    for (const g of groups) {
      const table = el('table', `sb-table${g.team ? ` team-${g.team === me.team ? 'ally' : 'enemy'}` : ''}`);
      const head = el('tr', '', el('th', 'pos', '#'), el('th', 'who', g.team ? this.teamNames[g.team] : 'JOGADOR'));
      if (withScore) head.append(el('th', '', 'PTS'));
      head.append(el('th', '', 'ABATES'), el('th', '', 'MORTES'));
      if (withAssists) head.append(el('th', '', 'ASSIST.'));
      head.append(el('th', '', 'K/D'), el('th', '', 'PING'));
      table.append(el('thead', '', head));
      const body = el('tbody');
      g.rows.forEach((r, i) => {
        const rel = relation(r, me);
        const ping = pingLabel(r);
        const tr = el('tr', `rel-${rel}`, el('td', 'pos', String(i + 1)), el('td', 'who', nameTag(r, rel)));
        if (withScore) tr.append(el('td', 'num', String(r.score ?? 0)));
        tr.append(el('td', 'num', String(r.kills)), el('td', 'num', String(r.deaths)));
        if (withAssists) tr.append(el('td', 'num', String(r.assists ?? 0)));
        tr.append(el('td', 'num', kdRatio(r.kills, r.deaths)), el('td', `num ping ping-${ping.level}`, ping.text));
        body.append(tr);
      });
      table.append(body);
      frag.append(table);
    }
    this.body.replaceChildren(frag);
  }
}
