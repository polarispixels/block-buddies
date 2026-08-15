'use strict';
// Simple pooled particle system. Drawn in world space (inside camera transform).
const Particles = {
  list: [],
  add(p) { p.age = 0; p.rot = p.rot || 0; this.list.push(p); },
  burst(x, y, n, opts = {}) {
    for (let i = 0; i < n; i++) {
      const a = opts.a0 !== undefined ? rand(opts.a0, opts.a1) : rand(TAU);
      const sp = rand(opts.sp0 ?? 60, opts.sp1 ?? 280);
      this.add({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - (opts.up ?? 60),
        life: rand(opts.l0 ?? 0.4, opts.l1 ?? 0.9),
        size: rand(opts.s0 ?? 5, opts.s1 ?? 11),
        color: opts.colors ? opts.colors[randi(0, opts.colors.length - 1)] : (opts.color || '#fff'),
        type: opts.type || 'circle',
        grav: opts.grav ?? 500,
        spin: rand(-6, 6)
      });
    }
  },
  candyBurst(x, y, n) {
    for (let i = 0; i < n; i++) {
      this.add({
        x, y,
        vx: rand(-320, 320), vy: rand(-620, -180),
        life: rand(1.2, 2.2), size: rand(12, 22),
        color: '#ffd24a', type: 'candy', kind: randi(0, 2),
        grav: 800, spin: rand(-7, 7)
      });
    }
  },
  update(dt) {
    const L = this.list;
    for (let i = L.length - 1; i >= 0; i--) {
      const p = L[i];
      p.age += dt;
      if (p.age >= p.life) { L.splice(i, 1); continue; }
      p.vy += (p.grav || 0) * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.rot += (p.spin || 0) * dt;
    }
    if (L.length > 900) L.splice(0, L.length - 900);
  },
  draw(ctx) {
    for (const p of this.list) {
      const k = 1 - p.age / p.life;
      ctx.save();
      ctx.globalAlpha = Math.min(1, k * 1.6);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      const s = p.size * (0.5 + k * 0.5);
      switch (p.type) {
        case 'star':
          ctx.fillStyle = p.color;
          starPath(ctx, 0, 0, s, s * 0.45);
          ctx.fill();
          break;
        case 'sparkle':
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.moveTo(0, -s); ctx.quadraticCurveTo(s * 0.18, -s * 0.18, s, 0);
          ctx.quadraticCurveTo(s * 0.18, s * 0.18, 0, s);
          ctx.quadraticCurveTo(-s * 0.18, s * 0.18, -s, 0);
          ctx.quadraticCurveTo(-s * 0.18, -s * 0.18, 0, -s);
          ctx.fill();
          break;
        case 'heart':
          heartPath(ctx, 0, -s * 0.3, s);
          ctx.fillStyle = p.color;
          ctx.fill();
          break;
        case 'block':
          ctx.fillStyle = p.color;
          rr(ctx, -s * 0.7, -s * 0.7, s * 1.4, s * 1.4, s * 0.3); ctx.fill();
          ctx.strokeStyle = 'rgba(40,25,50,0.4)'; ctx.lineWidth = 2;
          rr(ctx, -s * 0.7, -s * 0.7, s * 1.4, s * 1.4, s * 0.3); ctx.stroke();
          break;
        case 'confetti':
          ctx.fillStyle = p.color;
          ctx.fillRect(-s * 0.5, -s * 0.25, s, s * 0.5);
          break;
        case 'candy':
          drawCandy(ctx, 0, 0, s, p.kind || 0, p.age * 3);
          break;
        case 'flame': {
          ctx.fillStyle = p.color;
          ctx.beginPath(); ctx.arc(0, 0, s * 0.6, 0, TAU); ctx.fill();
          break;
        }
        case 'bubble':
          ctx.strokeStyle = p.color; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(0, 0, s * 0.6, 0, TAU); ctx.stroke();
          break;
        default:
          ctx.fillStyle = p.color;
          ctx.beginPath(); ctx.arc(0, 0, s * 0.6, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }
  }
};
