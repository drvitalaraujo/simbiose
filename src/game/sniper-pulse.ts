/** Pulso visual disparado por munição consumida, nunca por cadência herdada na troca. */
export class SniperPulse {
  private index = -1;
  private ammo = -1;
  private left = 0;
  update(dt: number, state: { weaponIndex: number; ammo: number }, alive: boolean): number {
    if (!alive || state.weaponIndex !== this.index) this.left = 0;
    else if (state.weaponIndex === 2 && state.ammo === this.ammo - 1) this.left = 0.18;
    this.index = state.weaponIndex;
    this.ammo = state.ammo;
    this.left = Math.max(0, this.left - dt);
    return Math.sin(Math.PI * this.left / 0.18) * 1.8;
  }
}
