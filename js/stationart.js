'use strict';
// ST_ART: creature + cinematic art pack for THE ALIEN SPACE STATION
// (docs/superpowers/specs/2026-09-04-alien-space-station-design.md)
//
// Pure procedural drawing functions, same house style as drawFace/drawBlock
// (js/util.js) and the other secret-room art packs (js/flowerart.js,
// js/surfart.js): every function takes ctx + world/screen-space coordinates
// and reads nothing but its own arguments, save()/restore()s around its own
// work, and defaults t=0. No globalCompositeOperation, no game-state reads.
//
// Everything here is seen through a DARKNESS overlay for most of the level,
// so shapes carry their own light: dark charcoal bodies (#1c1e28 family)
// with strong neon self-lit accents — cyan #4dfcff, magenta #ff4df0, lime
// #a8ff3c — drawn as soft radial-gradient glows plus a bright core, never
// flat fills. This is a clearly DIFFERENT design language from the purple
// meadow spiders (js/entities.js Spider.draw): biomechanical plating and
// glowing seams instead of soft fuzzy limbs, six legs instead of eight.

// ---------------------------------------------------------------- helpers
const ST_CYAN = '#4dfcff', ST_MAGENTA = '#ff4df0', ST_LIME = '#a8ff3c', ST_VIOLET = '#9a6dff';
const ST_DARK = '#1c1e28', ST_DARK2 = '#2a2d40', ST_DARK3 = '#12131c';

// soft glow halo (no solid core) — for behind eyes/glands/lights
function stHalo(ctx, x, y, r, color, alpha = 1) {
  ctx.save();
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.restore();
}
// glow halo + bright solid core (a "lit dot": joints, beacon lights, gland tip)
function stGlowDot(ctx, x, y, r, color, alpha = 1) {
  stHalo(ctx, x, y, r * 2.4, color, alpha * 0.55);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.restore();
}
// two-pass segmented limb: dark outline pass, bright inner pass
function stLeg(ctx, hx, hy, kx, ky, fx, fy, wOut, colOut, colIn) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = colOut; ctx.lineWidth = wOut;
  ctx.beginPath(); ctx.moveTo(hx, hy); ctx.quadraticCurveTo(kx, ky, fx, fy); ctx.stroke();
  ctx.strokeStyle = colIn; ctx.lineWidth = wOut * 0.6;
  ctx.beginPath(); ctx.moveTo(hx, hy); ctx.quadraticCurveTo(kx, ky, fx, fy); ctx.stroke();
}
function stAntenna(ctx, x0, y0, x1, y1, w, tipColor, tipR) {
  ctx.strokeStyle = ST_DARK2; ctx.lineWidth = w; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(x0, (y0 + y1) / 2, x1, y1); ctx.stroke();
  stGlowDot(ctx, x1, y1, tipR, tipColor, 0.95);
}
// deterministic pseudo-random in [0,1) from an integer index (no per-frame Math.random)
function stHash(i) { const v = Math.sin(i * 12.9898) * 43758.5453; return v - Math.floor(v); }

// ---------------------------------------------------------------- spider core
// Shared body builder for both the small AlienSpider and the colossal boss —
// "same design as the small ones but colossal" per spec. Drawn already
// translated so (0,0) = (cx, groundY); returns LOCAL anchor points.
function stSpiderCore(ctx, s, t, o) {
  const facing = o.facing || 1;
  const mood = o.mood || 'crawl';
  const big = !!o.big;
  const antennaeN = o.antennaeN || 2;
  const puff = o.puff || 0;
  const h = s * 0.7;
  const stunned = mood === 'stun';
  const flying = mood === 'fly';
  const jumping = mood === 'jump';
  const shooting = mood === 'shoot';

  ctx.save();
  let rot = 0, lift = 0;
  if (stunned) rot = Math.PI;
  else if (shooting) { rot = -facing * 0.1; lift = -h * 0.06; }
  else if (flying) rot = Math.sin(t * 6) * 0.12;
  ctx.rotate(rot);
  ctx.translate(0, lift);

  // abdomen sits low/back, head sits forward/up and clearly separate from it
  const abX = -facing * s * 0.06, abY = -h * 0.46, abRX = s * (0.27 + puff * 0.15), abRY = s * (0.19 + puff * 0.09) * (big ? 1.05 : 1);
  const hdX = facing * s * 0.30, hdY = -h * 0.82, hdR = s * (big ? 0.24 : 0.20);

  // ---- six legs, three pairs, drawn behind the body — lighter than the
  // background so they read clearly even through the darkness overlay ----
  const legOut = big ? s * 0.08 : s * 0.075;
  const legIn = big ? '#565a7c' : '#454866';
  for (let i = 0; i < 3; i++) {
    for (const sd of [-1, 1]) {
      const hip = { x: abX + sd * (s * 0.10 + i * s * 0.06), y: abY + abRY * 0.7 + i * s * 0.02 };
      let knee, foot;
      if (jumping) {
        knee = { x: hip.x + sd * (s * 0.14), y: abY + s * 0.10 };
        foot = { x: hip.x + sd * (s * 0.10), y: abY + s * 0.24 };
      } else if (flying) {
        const spin = t * 9 + i * 2 + (sd > 0 ? 0 : 1.7);
        knee = { x: hip.x + sd * s * 0.30 * Math.cos(spin), y: abY + s * 0.22 + Math.sin(spin) * s * 0.10 };
        foot = { x: hip.x + sd * s * 0.28 * Math.cos(spin + 0.7), y: abY + s * 0.42 + Math.sin(spin + 1) * s * 0.12 };
      } else if (stunned) {
        const wig = Math.sin(t * 11 + i * 1.3 + sd) * s * 0.05;
        knee = { x: hip.x + sd * (s * 0.18) + wig, y: abY - s * 0.08 };
        foot = { x: hip.x + sd * (s * 0.26) + wig, y: abY - s * 0.24 };
      } else {
        const ph = Math.sin(t * 8 + i * 2.1 + (sd > 0 ? 0 : Math.PI)) * s * 0.05;
        knee = { x: hip.x + sd * (s * 0.24 + i * s * 0.04), y: abY + s * 0.18 + ph * 0.4 };
        foot = { x: hip.x + sd * (s * 0.19 + i * s * 0.05), y: Math.max(abY + s * 0.30, ph * 0.6) };
      }
      stLeg(ctx, hip.x, hip.y, knee.x, knee.y, foot.x, foot.y, legOut, ST_DARK3, legIn);
      stGlowDot(ctx, knee.x, knee.y, s * 0.034, ST_CYAN, 0.85);
    }
  }

  // ---- abdomen (dark armored plate) with glowing cyan seams ----
  const bg = ctx.createRadialGradient(abX - abRX * 0.3, abY - abRY * 0.3, 2, abX, abY, abRX * 1.3);
  bg.addColorStop(0, big ? '#3a3d58' : '#2e3049');
  bg.addColorStop(1, ST_DARK3);
  ctx.fillStyle = bg;
  ctx.beginPath(); ctx.ellipse(abX, abY, abRX, abRY, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = ST_DARK3; ctx.lineWidth = s * 0.02; ctx.stroke();
  ctx.strokeStyle = ST_CYAN; ctx.lineWidth = Math.max(1.5, s * 0.02); ctx.globalAlpha = 0.85;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.ellipse(abX, abY, abRX * (0.4 + i * 0.28 + 0.28), abRY * (0.4 + i * 0.28 + 0.28), 0, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  }
  if (big) { // a single glowing dorsal seam runs from the abdomen up onto the head
    ctx.beginPath();
    ctx.moveTo(abX, abY - abRY * 0.9);
    ctx.quadraticCurveTo((abX + hdX) / 2, Math.min(abY, hdY) - s * 0.05, hdX, hdY - hdR * 0.7);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // ---- web gland: a smaller bulb low on the REAR of the abdomen, well
  // clear of the head so the two never merge into one blob ----
  const gx = abX - facing * s * 0.30, gy = abY + abRY * 0.35;
  const glandR = s * (shooting ? 0.10 : 0.065) * (1 + Math.sin(t * (shooting ? 16 : 3)) * (shooting ? 0.12 : 0.05));
  stHalo(ctx, gx, gy, glandR * (shooting ? 3.2 : 1.8), ST_MAGENTA, shooting ? 0.55 : 0.28);
  ctx.fillStyle = ST_MAGENTA;
  ctx.beginPath(); ctx.arc(gx, gy, glandR, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#8a1f7a'; ctx.lineWidth = s * 0.012; ctx.stroke();

  // ---- head / cephalothorax — bigger, forward, and lighter than the
  // abdomen so it reads as its own "face plate" ----
  const hg = ctx.createRadialGradient(hdX - hdR * 0.3, hdY - hdR * 0.3, 1, hdX, hdY, hdR * 1.2);
  hg.addColorStop(0, big ? '#4a4e70' : '#3a3d58'); hg.addColorStop(1, big ? '#282a3c' : ST_DARK3);
  ctx.fillStyle = hg;
  ctx.beginPath(); ctx.ellipse(hdX, hdY, hdR, hdR * 0.9, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = ST_DARK3; ctx.lineWidth = s * 0.015; ctx.stroke();

  // ---- antennae (a crown of them for the boss) ----
  for (let i = 0; i < antennaeN; i++) {
    const spread = antennaeN > 1 ? lerp(-0.8, 0.8, i / (antennaeN - 1)) : 0;
    const sway = Math.sin(t * 5 + i * 1.3) * 0.12;
    const x1 = hdX + facing * s * 0.10 + Math.sin(spread + sway) * s * 0.18;
    const y1 = hdY - s * (0.32 + Math.abs(spread) * 0.07);
    stAntenna(ctx, hdX + spread * s * 0.06, hdY - hdR * 0.75, x1, y1, s * 0.022, i % 2 ? ST_LIME : ST_CYAN, s * 0.03);
  }

  ctx.restore();
  return { headX: hdX, headY: hdY, headR: hdR, backX: gx, backY: gy, abX, abY, abRX, abRY, rot, lift };
}

const ST_ART = {

  // ---------------------------------------------------------------- 1
  // Biomechanical alien spider. Feet at groundY, body centered on cx.
  // width ~= s, height ~= s*0.7.
  alienSpider(ctx, cx, groundY, s, t = 0, o = {}) {
    const mood = o.mood || 'crawl';
    const size = o.size || 'small';
    const facing = o.facing || 1;
    const wob = o.wob || 0;
    ctx.save();
    ctx.translate(cx + wob, groundY);
    const core = stSpiderCore(ctx, s, t, { facing, mood, big: size === 'big', puff: 0 });

    // three glowing eyes, reused standalone helper — the small alien look
    // (the boss uses a big drawFace instead, for readability at scale)
    if (mood === 'stun') {
      drawFace(ctx, core.headX, core.headY, s * 0.34, 'dizzy', t, cx * 0.01 + 3);
    } else {
      ctx.save();
      ctx.rotate(core.rot);
      ctx.translate(0, core.lift);
      ST_ART.spiderEyes(ctx, core.headX, core.headY - s * 0.02, s * 0.46, t, { blink: mood !== 'shoot' });
      // small silly grin
      ctx.strokeStyle = '#3a2a3a'; ctx.lineWidth = Math.max(1.5, s * 0.018); ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(core.headX, core.headY + s * 0.11, s * 0.07, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  },

  // ---------------------------------------------------------------- 2
  // Just the three glowing eyes (with soft halos), for a lurking spider
  // seen through the darkness. s ~= 40 wide cluster.
  spiderEyes(ctx, cx, cy, s, t = 0, o = {}) {
    const blink = o.blink !== false;
    const seed = (cx * 0.017 + cy * 0.011) % 10;
    const closed = blink && ((t + seed * 3.7) % 3.6) < 0.12;
    const bigR = s * 0.24, smallR = s * 0.15;
    const pts = [
      { x: cx, y: cy - s * 0.14, r: bigR, c: ST_CYAN },
      { x: cx - s * 0.30, y: cy + s * 0.10, r: smallR, c: ST_MAGENTA },
      { x: cx + s * 0.30, y: cy + s * 0.10, r: smallR, c: ST_MAGENTA },
    ];
    ctx.save();
    for (const p of pts) {
      if (closed) {
        stHalo(ctx, p.x, p.y, p.r * 1.6, p.c, 0.5);
        ctx.strokeStyle = p.c; ctx.lineWidth = Math.max(1.5, p.r * 0.35); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(p.x - p.r * 0.7, p.y); ctx.quadraticCurveTo(p.x, p.y + p.r * 0.5, p.x + p.r * 0.7, p.y); ctx.stroke();
        continue;
      }
      stHalo(ctx, p.x, p.y, p.r * 2.3, p.c, 0.55);
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
      ctx.fillStyle = p.c;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 0.55, 0, TAU); ctx.fill();
      ctx.fillStyle = ST_DARK3;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 0.26, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.85;
      ctx.beginPath(); ctx.arc(p.x - p.r * 0.28, p.y - p.r * 0.28, p.r * 0.16, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  },

  // ---------------------------------------------------------------- 3
  // A flying ball of sticky web. r ~= 14.
  webGlob(ctx, cx, cy, r, t = 0) {
    ctx.save();
    stHalo(ctx, cx, cy, r * 2.2, ST_MAGENTA, 0.4);
    ctx.translate(cx, cy);
    ctx.rotate(t * 6);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(210,220,235,0.9)'; ctx.lineWidth = Math.max(1, r * 0.12);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU;
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.95, r * 0.4, a, 0, TAU);
      ctx.stroke();
    }
    ctx.fillStyle = ST_MAGENTA; ctx.globalAlpha = 0.8;
    ctx.beginPath(); ctx.arc(-r * 0.2, -r * 0.2, r * 0.22, 0, TAU); ctx.fill();
    ctx.restore();
  },

  // ---------------------------------------------------------------- 4
  // The sticky web stuck on the hero. w,h ~= 70x100 around the hero's
  // center. alpha scales with k (0..1, how "stuck" it still is).
  webWrap(ctx, cx, cy, w, h, t = 0, k = 1) {
    if (k <= 0.001) return;
    ctx.save();
    ctx.globalAlpha = clamp(k, 0, 1);
    ctx.translate(cx, cy);
    ctx.strokeStyle = 'rgba(255,255,255,0.88)';
    ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    const x0 = -w / 2, y0 = -h / 2;
    for (let i = 0; i <= 3; i++) {
      const y = y0 + (h * i) / 3;
      ctx.beginPath(); ctx.moveTo(x0, y + Math.sin(t * 3 + i) * 2); ctx.lineTo(x0 + w, y - Math.sin(t * 3 + i) * 2); ctx.stroke();
    }
    for (let i = 0; i <= 3; i++) {
      const x = x0 + (w * i) / 3;
      ctx.beginPath(); ctx.moveTo(x + Math.cos(t * 2 + i) * 2, y0); ctx.lineTo(x - Math.cos(t * 2 + i) * 2, y0 + h); ctx.stroke();
    }
    rr(ctx, x0, y0, w, h, 14); ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2; ctx.stroke();
    // dangling bits below
    for (let i = 0; i < 3; i++) {
      const dx = lerp(x0 + 8, x0 + w - 8, i / 2);
      const dl = 10 + Math.sin(t * 4 + i) * 3;
      ctx.beginPath(); ctx.moveTo(dx, y0 + h); ctx.lineTo(dx + Math.sin(t * 5 + i) * 4, y0 + h + dl); ctx.stroke();
    }
    stHalo(ctx, 0, 0, w * 0.6, ST_MAGENTA, 0.12);
    ctx.restore();
  },

  // ---------------------------------------------------------------- 5
  // THE GIANT alien spider. s ~= 420 wide, ~= 300 tall, feet at groundY,
  // centered at cx. Returns { throwPt: {x,y} }.
  bossSpider(ctx, cx, groundY, s, t = 0, o = {}) {
    const mood = o.mood || 'angry';
    const shield = o.shield != null ? o.shield : 1;
    const shieldHit = o.shieldHit || 0;
    const spawnK = o.spawnK || 0;
    const facing = o.facing != null ? o.facing : -1;
    const h = s * 0.7;
    const throwPt = { x: cx + facing * s * 0.35, y: groundY - s * 0.75 };
    const pop = mood === 'pop';
    const coreMood = 'crawl'; // the boss never flips/tucks — only its face sells the mood

    ctx.save();
    ctx.translate(cx, groundY);
    const core = stSpiderCore(ctx, s, t, {
      facing, mood: coreMood, big: true, antennaeN: 4, puff: pop ? 0.6 : 0
    });
    ctx.save();
    ctx.rotate(core.rot); ctx.translate(0, core.lift);
    const faceMood = pop || mood === 'hurt' || mood === 'dizzy' ? 'dizzy'
      : mood === 'party' ? 'grin'
      : mood === 'angry' ? 'angry' : 'happy';
    drawFace(ctx, core.headX, core.headY, s * 0.29, faceMood, t, 7);
    if (pop) {
      ctx.save(); ctx.globalAlpha = 0.7; ctx.fillStyle = '#ff8fc0';
      for (const sd of [-1, 1]) {
        ctx.beginPath(); ctx.ellipse(core.headX + sd * s * 0.16, core.headY + s * 0.05, s * 0.055, s * 0.04, 0, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
    ctx.restore();

    // shield: translucent hexagonal energy-web dome, snug around the body
    if (shield > 0.001) {
      const scx = cx, scy = groundY - h * 0.55;
      stHexShield(ctx, scx, scy, s * 0.5, h * 0.68, shield, shieldHit, t);
    }

    const result = { throwPt };
    if (mood === 'spawn' && spawnK > 0.001) {
      const backWorld = { x: cx + core.backX, y: groundY + core.backY };
      const liftX = lerp(backWorld.x, throwPt.x, spawnK);
      const liftY = lerp(backWorld.y, throwPt.y, spawnK);
      ctx.save();
      ctx.strokeStyle = ST_DARK2; ctx.lineWidth = s * 0.045; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(backWorld.x, backWorld.y);
      ctx.quadraticCurveTo((backWorld.x + liftX) / 2, Math.min(backWorld.y, liftY) - s * 0.1, liftX, liftY);
      ctx.stroke();
      ctx.strokeStyle = ST_CYAN; ctx.lineWidth = s * 0.016; ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.moveTo(backWorld.x, backWorld.y);
      ctx.quadraticCurveTo((backWorld.x + liftX) / 2, Math.min(backWorld.y, liftY) - s * 0.1, liftX, liftY);
      ctx.stroke();
      ctx.restore();
      ST_ART.alienSpider(ctx, liftX, liftY, s * 0.2, t, { mood: spawnK < 0.65 ? 'jump' : 'fly', size: 'small', facing });
    }
    return result;
  },

  // ---------------------------------------------------------------- 6
  // Chubby retro escape pod. s ~= 180 tall.
  escapePod(ctx, cx, groundY, s, t = 0, o = {}) {
    const open = o.open !== false;
    const lights = o.lights || 0;
    ctx.save();
    ctx.translate(cx, groundY);
    stPodBody(ctx, s, { open, lights, t, tilt: 0, scorched: false, dented: false });
    ctx.restore();
  },

  // ---------------------------------------------------------------- 7
  // The pod after the crash in the jungle, tilted into a crater. ~=240 wide.
  crashedPod(ctx, x, groundY, t = 0) {
    ctx.save();
    ctx.translate(x, groundY);
    // crater
    ctx.fillStyle = 'rgba(60,40,25,0.55)';
    ctx.beginPath(); ctx.ellipse(10, 4, 140, 30, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(40,26,16,0.7)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.ellipse(10, 4, 140, 30, 0, 0, TAU); ctx.stroke();
    stPodBody(ctx, 210, { open: true, lights: 0, t, tilt: 0.32, scorched: true, dented: true });
    // bent jungle leaves around the base
    ctx.fillStyle = '#3a8f4a';
    for (let i = 0; i < 4; i++) {
      const a = -0.4 + i * 0.5, lx = -120 + i * 80, ly = 10 + Math.sin(i) * 6;
      ctx.save();
      ctx.translate(lx, ly); ctx.rotate(a + Math.sin(t * 1.5 + i) * 0.05);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(24, -34, 6, -50);
      ctx.quadraticCurveTo(-10, -30, 0, 0);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#2a6a38'; ctx.lineWidth = 2; ctx.stroke();
      ctx.restore();
    }
    // rising smoke
    for (let i = 0; i < 3; i++) {
      const ph = (t * 0.35 + i * 0.33) % 1;
      stHalo(ctx, -20 + i * 30, -170 - ph * 130, 16 + ph * 30, 'rgba(120,120,130,0.5)', (1 - ph) * 0.5);
    }
    ctx.restore();
  },

  // ---------------------------------------------------------------- 8
  // Fullscreen cinematic frames, drawn in SCREEN space (0,0)-(1280,720).
  // Returns { jack: {x,y,s} | null }.
  escapeScene(ctx, phase, k, t = 0) {
    k = clamp(k, 0, 1);
    if (phase === 'hatch') return stScenePodHatch(ctx, k, t);
    if (phase === 'launch') return stSceneLaunch(ctx, k, t);
    if (phase === 'space') return stSceneSpace(ctx, k, t);
    if (phase === 'reentry') return stSceneReentry(ctx, k, t);
    if (phase === 'crash') return stSceneCrash(ctx, k, t);
    if (phase === 'teaser') return stSceneTeaser(ctx, k, t);
    return { jack: null };
  },

  // ---------------------------------------------------------------- 9
  // A puddle of glowing green alien goo. ~= w wide.
  gooBlob(ctx, cx, groundY, w, t = 0) {
    ctx.save();
    ctx.translate(cx, groundY);
    stHalo(ctx, 0, -w * 0.06, w * 0.7, '#5cff6a', 0.28);
    const g = ctx.createRadialGradient(-w * 0.15, -w * 0.12, 2, 0, -w * 0.06, w * 0.55);
    g.addColorStop(0, '#a8ff3c'); g.addColorStop(0.6, '#4fc93f'); g.addColorStop(1, '#215c22');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(0, -w * 0.06, w * 0.5, w * 0.16, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#2a7a2c'; ctx.lineWidth = 2.5; ctx.stroke();
    // slow bubbles
    for (let i = 0; i < 3; i++) {
      const ph = (t * 0.4 + i * 0.31) % 1;
      const bx = -w * 0.22 + i * w * 0.22, by = -w * 0.06 - ph * w * 0.02;
      ctx.globalAlpha = (1 - ph) * 0.8;
      ctx.strokeStyle = '#eaffb0'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(bx, by, 4 + ph * 5, 0, TAU); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    drawFace(ctx, 0, -w * 0.1, w * 0.16, 'sleepy', t, cx * 0.01);
    ctx.restore();
  },
};

// ---------------------------------------------------------------- pod body
// Shared by escapePod / crashedPod. Drawn already translated so (0,0) sits
// at the pod's ground-contact point; the body rises upward (negative y).
function stPodBody(ctx, s, o) {
  const w = s * 0.78;
  ctx.save();
  ctx.rotate(o.tilt || 0);
  // three little landing legs
  ctx.strokeStyle = '#8a8f9c'; ctx.lineWidth = s * 0.05; ctx.lineCap = 'round';
  for (const dx of [-w * 0.42, 0, w * 0.42]) {
    ctx.beginPath(); ctx.moveTo(dx * 0.5, -s * 0.18); ctx.lineTo(dx, 0); ctx.stroke();
    ctx.fillStyle = '#5a5f6c';
    ctx.beginPath(); ctx.ellipse(dx, 2, s * 0.06, s * 0.025, 0, 0, TAU); ctx.fill();
  }
  // body
  const bodyTop = -s, bodyBot = -s * 0.16;
  const g = ctx.createLinearGradient(0, bodyTop, 0, bodyBot);
  if (o.scorched) { g.addColorStop(0, '#5a5248'); g.addColorStop(1, '#7a6a52'); }
  else { g.addColorStop(0, '#fff7ea'); g.addColorStop(1, '#ffd9a0'); }
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-w * 0.5, bodyBot);
  ctx.quadraticCurveTo(-w * 0.62, -s * 0.55, -w * 0.22, bodyTop);
  ctx.quadraticCurveTo(0, bodyTop - s * 0.06, w * 0.22, bodyTop);
  ctx.quadraticCurveTo(w * 0.62, -s * 0.55, w * 0.5, bodyBot);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = o.scorched ? '#2e2a24' : '#e8862f'; ctx.lineWidth = s * 0.022; ctx.stroke();
  // orange stripe band
  if (!o.scorched) {
    ctx.fillStyle = '#ff9f43';
    ctx.beginPath(); ctx.ellipse(0, -s * 0.34, w * 0.5, s * 0.05, 0, 0, TAU); ctx.fill();
  } else {
    ctx.fillStyle = 'rgba(30,24,18,0.55)';
    ctx.beginPath(); ctx.ellipse(-w * 0.1, -s * 0.6, w * 0.22, s * 0.16, 0.3, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(w * 0.18, -s * 0.28, w * 0.14, s * 0.1, -0.2, 0, TAU); ctx.fill();
  }
  if (o.dented) {
    ctx.strokeStyle = 'rgba(40,34,28,0.6)'; ctx.lineWidth = s * 0.02;
    ctx.beginPath(); ctx.ellipse(-w * 0.28, -s * 0.42, s * 0.09, s * 0.05, 0.4, 0, TAU); ctx.stroke();
  }
  // porthole — kept high on the body, clear of the hatch ramp below
  const py = -s * 0.7, pr = s * 0.18;
  ctx.fillStyle = '#12131c';
  ctx.beginPath(); ctx.arc(0, py, pr, 0, TAU); ctx.fill();
  ctx.fillStyle = o.scorched ? 'rgba(255,140,80,0.25)' : 'rgba(160,225,255,0.5)';
  ctx.beginPath(); ctx.arc(-pr * 0.25, py - pr * 0.25, pr * 0.55, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#c98a3a'; ctx.lineWidth = s * 0.035; ctx.stroke();
  drawFace(ctx, 0, py + pr * 1.3, pr * 0.5, 'happy', o.t || 0, 4);
  // hatch: open ramp, or closed seam — a lighter, clearly-outlined panel so
  // it never reads as part of the face above it
  if (o.open) {
    const rampY = bodyBot;
    ctx.fillStyle = o.scorched ? '#8a8078' : '#d8c8a8';
    ctx.beginPath();
    ctx.moveTo(-w * 0.3, rampY); ctx.lineTo(w * 0.3, rampY);
    ctx.lineTo(w * 0.44, rampY + s * 0.5); ctx.lineTo(-w * 0.44, rampY + s * 0.5);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = o.scorched ? '#2a241e' : '#8a7a5c'; ctx.lineWidth = s * 0.022; ctx.stroke();
    ctx.fillStyle = o.scorched ? 'rgba(255,150,90,0.35)' : 'rgba(255,238,180,0.55)';
    ctx.beginPath(); ctx.ellipse(0, rampY + s * 0.02, w * 0.24, s * 0.06, 0, 0, TAU); ctx.fill();
  } else {
    ctx.strokeStyle = '#c98a3a'; ctx.lineWidth = s * 0.02;
    ctx.beginPath(); ctx.moveTo(-w * 0.34, bodyBot - s * 0.02); ctx.lineTo(w * 0.34, bodyBot - s * 0.02); ctx.stroke();
  }
  // warning beacons
  if (o.lights > 0.001) {
    const blink = 0.5 + 0.5 * Math.sin((o.t || 0) * 7);
    for (const sd of [-1, 1]) {
      stGlowDot(ctx, sd * w * 0.46, -s * 0.5, s * 0.03, '#ff3b3b', o.lights * (0.4 + 0.6 * blink));
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------- shield
function stHexShield(ctx, cx, cy, rx, ry, shield, hit, t) {
  ctx.save();
  ctx.translate(cx, cy);
  const a = clamp(shield, 0, 1) * 0.45;
  ctx.globalAlpha = a;
  const g = ctx.createRadialGradient(0, 0, rx * 0.2, 0, 0, rx);
  const col = hit > 0.001 ? '#ffffff' : ST_CYAN;
  g.addColorStop(0, 'rgba(255,255,255,0.05)');
  g.addColorStop(1, col);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, TAU); ctx.fill();
  ctx.globalAlpha = a + hit * 0.5;
  ctx.strokeStyle = hit > 0.001 ? '#ffffff' : ST_CYAN; ctx.lineWidth = 2.5;
  // hexagonal lattice, projected onto the dome ellipse
  const rows = 4, cols = 7;
  for (let r = 0; r <= rows; r++) {
    const ry2 = lerp(-ry, ry, r / rows);
    const rowScale = Math.sqrt(Math.max(0, 1 - (ry2 / ry) * (ry2 / ry)));
    ctx.beginPath();
    for (let c = 0; c <= cols; c++) {
      const ang = lerp(-1, 1, c / cols) * Math.PI * 0.5 * rowScale;
      const x = Math.sin(ang) * rx * rowScale, y = ry2;
      if (c === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  for (let c = 0; c <= cols; c++) {
    ctx.beginPath();
    for (let r = 0; r <= rows; r++) {
      const ry2 = lerp(-ry, ry, r / rows);
      const rowScale = Math.sqrt(Math.max(0, 1 - (ry2 / ry) * (ry2 / ry)));
      const ang = lerp(-1, 1, c / cols) * Math.PI * 0.5 * rowScale;
      const x = Math.sin(ang) * rx * rowScale, y = ry2;
      if (r === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- stars
function stStarField(ctx, x0, y0, w, h, n, t, alpha, seedBase) {
  ctx.save();
  ctx.fillStyle = '#fff';
  for (let i = 0; i < n; i++) {
    const hx = stHash(i + seedBase), hy = stHash(i + seedBase + 777);
    const sx = x0 + hx * w, sy = y0 + hy * h;
    const tw = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * 2 + i * 1.7));
    ctx.globalAlpha = alpha * tw;
    const sz = 1 + (i % 3 === 0 ? 1.4 : 0);
    ctx.fillRect(sx, sy, sz, sz);
  }
  ctx.restore();
}
function stSmoke(ctx, x, y, r, alpha, color) {
  stHalo(ctx, x, y, r, color || 'rgba(160,165,180,0.9)', alpha);
}

// ---------------------------------------------------------------- pod interior (hatch)
function stScenePodHatch(ctx, k, t) {
  ctx.fillStyle = '#1a1d2c'; ctx.fillRect(0, 0, W, H);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#232842'); g.addColorStop(1, '#12141f');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // porthole showing the dark station bay outside — dim silhouettes, not
  // stars (they haven't launched yet)
  const px = 860, py = 260, pr = 130;
  ctx.save();
  ctx.beginPath(); ctx.arc(px, py, pr, 0, TAU); ctx.clip();
  ctx.fillStyle = '#0a0c18'; ctx.fillRect(px - pr, py - pr, pr * 2, pr * 2);
  ctx.fillStyle = 'rgba(50,56,84,0.7)';
  ctx.beginPath(); ctx.ellipse(px - 60, py + 100, 90, 60, 0, 0, TAU); ctx.fill();
  ctx.fillRect(px + 20, py - 40, 60, 140);
  stHalo(ctx, px - 40, py + 20, 60, ST_MAGENTA, 0.12);
  stHalo(ctx, px + 60, py - 60, 10, ST_CYAN, 0.5);
  ctx.restore();
  ctx.strokeStyle = '#4a5170'; ctx.lineWidth = 14;
  ctx.beginPath(); ctx.arc(px, py, pr, 0, TAU); ctx.stroke();
  ctx.strokeStyle = '#8891b8'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(px, py, pr, 0, TAU); ctx.stroke();
  // console with blinking lights
  ctx.fillStyle = '#2b3050';
  rr(ctx, 60, 520, 420, 160, 18); ctx.fill();
  ctx.strokeStyle = '#4a5170'; ctx.lineWidth = 5;
  rr(ctx, 60, 520, 420, 160, 18); ctx.stroke();
  for (let r = 0; r < 3; r++) for (let c = 0; c < 8; c++) {
    const i = r * 8 + c;
    const on = ((Math.floor(t * 3) + i) % 5) < 2;
    const col = i % 3 === 0 ? ST_CYAN : i % 3 === 1 ? ST_LIME : ST_MAGENTA;
    stGlowDot(ctx, 90 + c * 48, 550 + r * 46, 7, on ? col : '#3a3f5c', on ? 0.9 : 0.5);
  }
  // red warning beacons flashing
  const blink = 0.4 + 0.6 * Math.max(0, Math.sin(t * 8));
  for (const bx of [40, W - 40]) stGlowDot(ctx, bx, 90, 16, '#ff3b3b', blink);
  ctx.save();
  ctx.fillStyle = `rgba(255,60,60,${0.05 + blink * 0.05})`;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  // hatch door sliding closed, from the left
  const doorW = 560;
  const doorX = -doorW + k * doorW;
  ctx.fillStyle = '#3a3f5c';
  ctx.fillRect(doorX, 0, doorW, H);
  ctx.strokeStyle = '#63699a'; ctx.lineWidth = 6;
  ctx.strokeRect(doorX, 0, doorW, H);
  for (let i = 1; i < 5; i++) {
    ctx.strokeStyle = 'rgba(150,160,200,0.3)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(doorX, (H / 5) * i); ctx.lineTo(doorX + doorW, (H / 5) * i); ctx.stroke();
  }
  stGlowDot(ctx, doorX + doorW - 20, H / 2, 10, '#ffd24a', 0.9);
  return { jack: { x: 780, y: 540, s: 1 } };
}

// ---------------------------------------------------------------- launch
function stSceneLaunch(ctx, k, t) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0a0c18'); g.addColorStop(1, '#242840');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  stStarField(ctx, 0, 0, W, H * 0.6, 60, t, 0.5, 40);
  // bay floor + walls
  ctx.fillStyle = '#2c3048'; ctx.fillRect(0, 600, W, H - 600);
  ctx.strokeStyle = '#4a5170'; ctx.lineWidth = 3;
  for (let x = 0; x < W; x += 90) { ctx.beginPath(); ctx.moveTo(x, 600); ctx.lineTo(x, H); ctx.stroke(); }
  const ignite = clamp(k / 0.3, 0, 1);
  const rise = clamp((k - 0.25) / 0.75, 0, 1);
  const podY = 600 - rise * rise * (H + 300); // world y of the pod's ground-contact point
  const cx = W / 2;
  const wobble = Math.sin(t * 25) * (1 - rise) * 2;
  // pod + attached flame column, drawn together in one local frame so the
  // flame always stays glued to the pod's feet regardless of podY
  ctx.save();
  ctx.translate(cx + wobble, podY);
  if (ignite > 0.01) {
    const fh = (150 + ignite * 70) * (0.75 + 0.25 * Math.sin(t * 30));
    const fg = ctx.createLinearGradient(0, 4, 0, 4 + fh);
    fg.addColorStop(0, '#fff3c2'); fg.addColorStop(0.35, '#ffb35c'); fg.addColorStop(1, 'rgba(255,80,30,0)');
    ctx.fillStyle = fg; ctx.globalAlpha = ignite;
    ctx.beginPath();
    ctx.moveTo(-30, 6);
    ctx.quadraticCurveTo(-40, 4 + fh * 0.6, 0, 4 + fh);
    ctx.quadraticCurveTo(40, 4 + fh * 0.6, 30, 6);
    ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
  }
  stPodBody(ctx, 170, { open: false, lights: 0.9, t, tilt: 0 });
  ctx.restore();
  // rolling smoke once airborne
  if (rise > 0.02) {
    for (let i = 0; i < 8; i++) {
      const hh = stHash(i + 900);
      stSmoke(ctx, cx + (hh - 0.5) * 260, Math.min(H - 20, podY + 90 + i * 22 + rise * 60), 40 + hh * 50, (1 - rise) * 0.5 + 0.15);
    }
  }
  return { jack: null };
}

// ---------------------------------------------------------------- space
function stSceneSpace(ctx, k, t) {
  ctx.fillStyle = '#05060f'; ctx.fillRect(0, 0, W, H);
  stStarField(ctx, 0, 0, W, H, 220, t, 0.85, 200);
  // station receding, lower-left
  const stScale = lerp(0.9, 0.22, k);
  const sx = lerp(260, 120, k), sy = lerp(500, 610, k);
  ctx.save();
  ctx.translate(sx, sy); ctx.scale(stScale, stScale);
  ctx.globalAlpha = lerp(1, 0.55, k);
  ctx.strokeStyle = ST_VIOLET; ctx.lineWidth = 8;
  ctx.beginPath(); ctx.ellipse(0, 0, 110, 40, 0.15, 0, TAU); ctx.stroke();
  ctx.fillStyle = '#3a3d58';
  ctx.beginPath(); ctx.arc(0, 0, 34, 0, TAU); ctx.fill();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + t * 0.2;
    ctx.strokeStyle = '#5a5f8c'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(Math.cos(a) * 34, Math.sin(a) * 34 * 0.4); ctx.lineTo(Math.cos(a) * 105, Math.sin(a) * 105 * 0.4); ctx.stroke();
    stGlowDot(ctx, Math.cos(a) * 105, Math.sin(a) * 105 * 0.4, 5, ST_CYAN, 0.7);
  }
  ctx.restore();
  // green jungle planet growing at upper-right
  const pk = k * k * (3 - 2 * k);
  const pr = lerp(4, 260, pk);
  const px = W - 150, py = 150;
  if (pr > 1) {
    const pg = ctx.createRadialGradient(px - pr * 0.3, py - pr * 0.3, pr * 0.1, px, py, pr);
    pg.addColorStop(0, '#8fe86a'); pg.addColorStop(0.55, '#3fae4a'); pg.addColorStop(1, '#1f6a2e');
    ctx.fillStyle = pg;
    ctx.beginPath(); ctx.arc(px, py, pr, 0, TAU); ctx.fill();
    if (pr > 20) {
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath(); ctx.ellipse(px - pr * 0.2, py + pr * 0.1, pr * 0.5, pr * 0.16, 0.3, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(px + pr * 0.25, py - pr * 0.3, pr * 0.32, pr * 0.11, -0.2, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(200,255,220,0.35)'; ctx.lineWidth = pr * 0.05;
      ctx.beginPath(); ctx.ellipse(px, py, pr * 1.22, pr * 0.3, -0.3, 0, TAU); ctx.stroke();
    }
  }
  // the pod, mid-screen, rocket flame trailing left, slight wobble
  const podX = W * 0.42, podY = H * 0.5 + Math.sin(t * 4) * 6;
  ctx.save();
  ctx.translate(podX, podY); ctx.rotate(-0.15);
  const fmy = -65;
  const fg = ctx.createLinearGradient(-15, fmy, -95, fmy);
  fg.addColorStop(0, '#ffdf8a'); fg.addColorStop(1, 'rgba(255,120,40,0)');
  ctx.fillStyle = fg;
  ctx.beginPath();
  ctx.moveTo(-18, fmy - 14);
  ctx.quadraticCurveTo(-70 - Math.sin(t * 20) * 10, fmy, -18, fmy + 14);
  ctx.closePath(); ctx.fill();
  stPodBody(ctx, 130, { open: false, lights: 0.8, t, tilt: 0 });
  ctx.restore();
  return { jack: null };
}

// ---------------------------------------------------------------- reentry
function stSceneReentry(ctx, k, t) {
  const cx = W / 2, cy = H * 0.52;
  const intensity = Math.sin(clamp(k, 0, 1) * Math.PI);
  // the planet fills the frame: one clean solid gradient (no stacked
  // translucent shapes — keeps it reading as "planet", not a lava lamp)
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#bdeaff'); g.addColorStop(0.4, '#5fc7dc'); g.addColorStop(1, '#2f8f52');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // a few solid, well-separated continents + cloud wisps
  ctx.fillStyle = '#3aa15c';
  ctx.beginPath(); ctx.ellipse(220, H - 60, 320, 140, 0.1, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(W - 260, H - 20, 300, 150, -0.15, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(W * 0.5, H + 40, 260, 130, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath(); ctx.ellipse(200, 130, 150, 32, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(W - 220, 90, 170, 30, 0, 0, TAU); ctx.fill();

  // the pod, glowing hot, a plasma trail streaming behind it (up-and-back —
  // opposite the direction of travel) instead of a starburst
  ctx.save();
  ctx.translate(cx, cy);
  stHalo(ctx, 0, -30, 210 + intensity * 90, '#fff3d0', 0.6 * intensity);
  const tg = ctx.createLinearGradient(0, -10, -30, -220);
  tg.addColorStop(0, `rgba(255,220,150,${0.85 * intensity})`);
  tg.addColorStop(0.5, `rgba(255,150,60,${0.5 * intensity})`);
  tg.addColorStop(1, 'rgba(255,120,40,0)');
  ctx.fillStyle = tg;
  ctx.beginPath();
  ctx.moveTo(-42, -10); ctx.quadraticCurveTo(-95, -120, -34, -225);
  ctx.quadraticCurveTo(10, -120, 36, -10);
  ctx.closePath(); ctx.fill();
  stPodBody(ctx, 190, { open: false, lights: 0.6, t, tilt: 0 });
  ctx.globalAlpha = 0.4 * intensity;
  ctx.fillStyle = '#ff8a3a';
  ctx.beginPath(); ctx.ellipse(0, -86, 84, 108, 0, 0, TAU); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();

  // orange edge vignette, subtle and edges-only
  const vg = ctx.createRadialGradient(cx, cy, H * 0.5, cx, cy, H * 0.95);
  vg.addColorStop(0, 'rgba(255,120,40,0)'); vg.addColorStop(1, `rgba(255,90,20,${0.35 * intensity})`);
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  return { jack: null };
}

// ---------------------------------------------------------------- crash
function stSceneCrash(ctx, k, t) {
  const groundY = 600;
  const g = ctx.createLinearGradient(0, 0, 0, groundY);
  g.addColorStop(0, '#7fc9d6'); g.addColorStop(1, '#bfe6c8');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, groundY);
  ctx.fillStyle = '#3a8f4a'; ctx.fillRect(0, groundY, W, H - groundY);
  // layered tree silhouettes
  const rows = [
    { y: groundY - 40, c: '#1c4a2a', n: 6 },
    { y: groundY - 10, c: '#123a1e', n: 8 },
  ];
  for (const row of rows) {
    ctx.fillStyle = row.c;
    for (let i = 0; i < row.n; i++) {
      const hh = stHash(i * 3 + row.n);
      const tx = (i / row.n) * (W + 200) - 100 + hh * 40 + Math.sin(t * 1.2 + i) * 3;
      const th = 160 + hh * 120;
      ctx.beginPath(); ctx.ellipse(tx, row.y - th * 0.6, 60 + hh * 30, th * 0.6, 0, 0, TAU); ctx.fill();
      ctx.fillRect(tx - 8, row.y - 20, 16, 30);
    }
  }
  // pod falling / settled
  const cx = W / 2;
  const fallK = clamp(k / 0.4, 0, 1);
  const podY = lerp(-160, groundY, fallK * fallK);
  const settled = k >= 0.4;
  ctx.save();
  ctx.translate(cx, podY);
  if (!settled) stPodBody(ctx, 190, { open: false, lights: 0.9, t, tilt: 0.4 });
  else stPodBody(ctx, 190, { open: true, lights: 0, t, tilt: 0.34, scorched: true, dented: true });
  ctx.restore();
  // dirt spray at impact
  if (k > 0.34 && k < 0.55) {
    const sk = 1 - Math.abs(k - 0.42) / 0.13;
    ctx.fillStyle = '#6a4a2e'; ctx.globalAlpha = clamp(sk, 0, 1) * 0.8;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI - Math.PI / 2 - Math.PI / 2;
      ctx.beginPath(); ctx.arc(cx + Math.cos(a) * 90 * sk, groundY - Math.abs(Math.sin(a)) * 40 * sk, 7, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  // smoke rising after settling
  if (settled) {
    for (let i = 0; i < 4; i++) {
      const ph = (t * 0.3 + i * 0.28) % 1;
      stSmoke(ctx, cx - 10 + i * 12, groundY - 150 - ph * 160, 20 + ph * 40, (1 - ph) * 0.5);
    }
  }
  // fluttering leaves
  ctx.fillStyle = '#2f7a3c';
  for (let i = 0; i < 6; i++) {
    const hh = stHash(i + 500);
    const lx = hh * W, ly = groundY - 60 + Math.sin(t * 2 + i) * 30;
    ctx.beginPath(); ctx.ellipse(lx, ly, 8, 4, t + i, 0, TAU); ctx.fill();
  }
  return { jack: null };
}

// ---------------------------------------------------------------- teaser
function stSceneTeaser(ctx, k, t) {
  const groundY = 600, cx = 640;
  const g = ctx.createLinearGradient(0, 0, 0, groundY);
  g.addColorStop(0, '#9fd9e0'); g.addColorStop(1, '#cdeccb');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, groundY);
  ctx.fillStyle = '#4a9a52'; ctx.fillRect(0, groundY, W, H - groundY);

  // huge dino silhouette walking far background, 0.45-0.85 — dark and solid
  // so it reads clearly against the pale sky before the trees occlude it
  if (k > 0.45 && k < 0.85) {
    const p = (k - 0.45) / 0.4;
    const dx = lerp(W + 220, -260, p);
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#12341c';
    ctx.translate(dx, groundY);
    for (const lx of [-70, -15, 50, 105]) ctx.fillRect(lx - 13, -85, 26, 85 + Math.sin(t * 4 + lx) * 4);
    ctx.beginPath(); ctx.ellipse(20, -150, 150, 70, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); // tail, sweeping back
    ctx.moveTo(150, -150); ctx.quadraticCurveTo(260, -130, 300, -90); ctx.quadraticCurveTo(250, -140, 150, -170);
    ctx.closePath(); ctx.fill();
    ctx.beginPath(); // long neck + small head, sweeping up
    ctx.moveTo(-110, -180); ctx.quadraticCurveTo(-190, -260, -165, -330); ctx.quadraticCurveTo(-140, -260, -80, -190);
    ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-168, -335, 26, 18, 0.2, 0, TAU); ctx.fill();
    ctx.restore();
  }

  // trees (shake when a shake factor is active)
  const shakeK = clamp((k - 0.3) / 0.15, 0, 1) * (1 - clamp((k - 0.85) / 0.15, 0, 1));
  const shakeAmp = shakeK * 6;
  ctx.fillStyle = '#245c2e';
  for (let i = 0; i < 7; i++) {
    const hh = stHash(i + 60);
    const tx = (i / 7) * (W + 160) - 80 + hh * 40 + Math.sin(t * 30 + i) * shakeAmp;
    const th = 140 + hh * 90;
    ctx.beginPath(); ctx.ellipse(tx, groundY - 30 - th * 0.55, 55 + hh * 20, th * 0.55, 0, 0, TAU); ctx.fill();
    ctx.fillRect(tx - 7, groundY - 40, 14, 26);
  }

  // crashed pod at rest
  ST_ART.crashedPod(ctx, cx, groundY, t);

  // baby dino peeking from a bush at right, k>0.7
  if (k > 0.7) {
    const bp = clamp((k - 0.7) / 0.2, 0, 1);
    const bx = 1100, by = groundY - 10;
    ctx.fillStyle = '#3a8f4a';
    ctx.beginPath(); ctx.ellipse(bx, by, 70, 44, 0, 0, TAU); ctx.fill();
    ctx.save();
    ctx.globalAlpha = bp;
    ctx.translate(bx + 40, by - 30);
    ctx.fillStyle = '#8fd85a';
    ctx.beginPath(); ctx.ellipse(0, 0, 34, 30, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#3f8c35'; ctx.lineWidth = 3; ctx.stroke();
    drawFace(ctx, -4, -4, 26, 'happy', t, 8);
    const wa = Math.sin(t * 7) * 0.6;
    ctx.strokeStyle = '#8fd85a'; ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(24, 14);
    ctx.lineTo(38 + Math.cos(wa) * 12, -10 + Math.sin(wa) * 10);
    ctx.stroke();
    ctx.restore();
  }

  // fireflies
  for (let i = 0; i < 8; i++) {
    const hh = stHash(i + 800), hh2 = stHash(i + 801);
    const fx = hh * W + Math.sin(t * 1.3 + i) * 30;
    const fy = groundY - 40 - hh2 * 220 + Math.cos(t * 1.7 + i) * 20;
    stGlowDot(ctx, fx, fy, 3, ST_LIME, 0.4 + 0.5 * Math.sin(t * 4 + i));
  }

  return { jack: { x: cx + 110, y: groundY, s: 1 } };
}
