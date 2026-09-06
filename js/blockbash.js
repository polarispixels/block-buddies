// JUNKYARD BLOCK BASH — Arcade Mode #1 (v1.29.0). Breakout through Block
// Buddies: Jack's monster truck is the paddle, a faced rubber ball smashes
// junk blocks, misses are comedy, the JUNKBOT is the finale.
const BB = {
  L: 40, R: 1240, TOP: 90, FLOOR: 620, MISS_Y: 640,          // arena bounds
  COLS: 12, BW: 96, BH: 48, GX: 64, GY: 110,                 // block grid (col c → x = GX + c*BW; row r → y = GY + r*BH)
  BALL_R: 18, GIANT_R: 32,
  SPEED: [380, 430, 480, 520, 540], CAP: 620, MIN_VY: 0.35, MIN_VX: 0.08,
  PADDLE_ACC: 2600, PADDLE_MAX: 520, PADDLE_PAD: 6,
  HOP_T: 0.35, HOP_H: 60, BUMP: 1.25,
  LAUNCH_AUTO: 1.5, RESPAWN: 0.9,
  CAPSULE_VY: 220, CANDY_DRIFT: 140, FLOOR_CANDY_T: 6, MAX_BALLS: 6,
  MODS: { giant: 10, wide: 12, boom: 8, magnet: 10, slow: 6, net: 12, rainbow: 6 },
  PAR: [45, 55, 65, 75], STALL_EVERY: 2.5,
  BOSS: { HP: 12, W: 340, H: 260, XMIN: 200, XMAX: 1080, YMIN: 150, YMAX: 330, STALL: 60 }
};

class BlockBash {
  constructor(lv) {
    this.lv = lv; this.t = 0; this.state = 'play';
    this.hopT = 0; this.hopY0 = BB.FLOOR - 96; this.spinT = 0;
    this.wideK = 1; // paddle width multiplier (Task 6's wide mod)
  }
  paddleBox() {
    const pl = game.player, extra = (this.wideK - 1) * pl.w / 2;
    return { x: pl.x - BB.PADDLE_PAD - extra, y: pl.y, w: pl.w + 2 * (BB.PADDLE_PAD + extra), h: pl.h };
  }
  // the arcade owns the hero: snappy left/right, a hop, no gravity
  updatePlayer(pl, dt) {
    if (!this.booted) { this.booted = true; if (pl.vehicle !== 'truck') { pl.boardTruck(); } pl.x = 590 - 52; this.hopY0 = BB.FLOOR - pl.h; pl.y = this.hopY0; }
    pl.t += dt; pl.inv = 0; pl.onGround = true;
    if (pl.moodT > 0) { pl.moodT -= dt; if (pl.moodT <= 0) pl.mood = 'happy'; }
    const dir = this.spinT > 0 ? 0 : (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0);
    if (dir) { pl.vx = clamp(pl.vx + dir * BB.PADDLE_ACC * dt, -BB.PADDLE_MAX, BB.PADDLE_MAX); pl.facing = dir; }
    else pl.vx *= Math.exp(-14 * dt); // stops in ~0.15 s
    if (Math.abs(pl.vx) < 4 && !dir) pl.vx = 0;
    pl.x = clamp(pl.x + pl.vx * dt, BB.L, BB.R - pl.w);
    // HOP: a 0.35 s arc up 60 px and back, animated (no gravity)
    if (justP.ArrowUp && this.hopT <= 0 && this.spinT <= 0) { this.hopT = BB.HOP_T; AudioSys.sfx('boing'); }
    if (this.hopT > 0) { this.hopT -= dt; const k = 1 - this.hopT / BB.HOP_T; pl.y = this.hopY0 - Math.sin(k * Math.PI) * BB.HOP_H; }
    else pl.y = this.hopY0;
    pl.vy = 0; pl.squash = lerp(pl.squash, 1, 1 - Math.exp(-10 * dt));
    if (this.spinT > 0) { this.spinT -= dt; pl.rot = Math.sin(this.t * 40) * 0.25; } else pl.rot = 0;
  }
  hopRising() { return this.hopT > BB.HOP_T * 0.45; }
  update(dt, pl) {
    if (!this.booted) { this.booted = true; if (pl.vehicle !== 'truck') { pl.boardTruck(); } pl.x = 590 - 52; this.hopY0 = BB.FLOOR - pl.h; pl.y = this.hopY0; }
    this.t += dt;
  }
  drawBack(ctx, t) { ctx.fillStyle = '#3a3346'; ctx.fillRect(0, 0, W, H); }
  draw(ctx, t) {}
  drawFront(ctx, t) {}
}
