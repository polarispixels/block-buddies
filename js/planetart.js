// ============================================================================
// PLANET BLOCKS ART PACK (v1.30.0) — pure drawing for the Space Maze's learning
// room: planets in six skins (the ANSWER BLOCKS of Puzzle Blocks mode #5),
// moons, the rocket, its hovering launch pad, the thought bubble, the four
// no-reading cue pictograms, and the ringed-planet door. No game-state reads;
// `t` is an optional clock. Every piece was contact-sheet reviewed at in-game
// size (tools/screenshot.sh planet-sheet) — planets must read at 64, 96, 140.
// ============================================================================
const PL_SKINS = [
  { name: 'ringed',  c: '#ffb35c', c2: '#e08a3a', ring: '#ffe0a8' },
  { name: 'striped', c: '#7fd8ff', c2: '#4aa3ff', stripes: '#3f86d8' },
  { name: 'cratered', c: '#ff8fb0', c2: '#d95f86', craters: '#c24d72' },
  { name: 'swirl',   c: '#b06cf0', c2: '#8a4fd0', swirl: '#d9b3ff' },
  { name: 'capped',  c: '#57d357', c2: '#3aa53a', cap: '#e8ffe8' },
  { name: 'plain',   c: '#ffe156', c2: '#e8b93a' }
];
const PL_ART = (() => {
  function planet(ctx, cx, cy, d, skin, mood = 'happy', t = 0) {
    const r = d / 2;
    ctx.save();
    // ring BACK half (behind the ball)
    if (skin.ring) {
      ctx.strokeStyle = skin.ring; ctx.lineWidth = Math.max(5, d * 0.1);
      ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.1, r * 1.55, r * 0.42, -0.25, Math.PI, TAU); ctx.stroke();
    }
    // the ball
    const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.1, cx, cy, r);
    g.addColorStop(0, skin.c); g.addColorStop(1, skin.c2);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
    // skin detail, clipped to the ball
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.clip();
    if (skin.stripes) {
      ctx.fillStyle = skin.stripes; ctx.globalAlpha = 0.55;
      for (const k of [-0.62, -0.22, 0.5]) { ctx.beginPath(); ctx.ellipse(cx, cy + r * k, r * 1.1, r * 0.13, 0.15, 0, TAU); ctx.fill(); }
    }
    if (skin.craters) {
      ctx.fillStyle = skin.craters; ctx.globalAlpha = 0.85;
      for (const [ox, oy, k] of [[-0.5, -0.55, 0.2], [0.4, -0.6, 0.14], [0.55, 0.15, 0.17], [-0.3, 0.6, 0.13]]) {
        ctx.beginPath(); ctx.arc(cx + ox * r, cy + oy * r, r * k, 0, TAU); ctx.fill();
      }
    }
    if (skin.swirl) {
      // a tight spiral tucked in the bottom cap (below the mouth) so it never
      // smears into the face — the same safe zone the 'cap' skin uses up top
      ctx.strokeStyle = skin.swirl; ctx.lineWidth = Math.max(3.5, d * 0.075); ctx.lineCap = 'round'; ctx.globalAlpha = 0.95;
      const scx = cx, scy = cy + r * 0.72, turns = 2.3, steps = 22;
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const a = (i / steps) * turns * Math.PI;
        const rad = r * (0.06 + 0.24 * (i / steps));
        const px = scx + Math.cos(a) * rad, py = scy + Math.sin(a) * rad * 0.85;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    if (skin.cap) {
      ctx.fillStyle = skin.cap; ctx.globalAlpha = 0.92;
      ctx.beginPath(); ctx.ellipse(cx, cy - r * 0.86, r * 0.62, r * 0.3, 0, 0, TAU); ctx.fill();
    }
    ctx.restore();
    // outline + shine
    ctx.strokeStyle = 'rgba(30,20,60,0.5)'; ctx.lineWidth = Math.max(2.5, d * 0.04);
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.ellipse(cx - r * 0.4, cy - r * 0.45, r * 0.22, r * 0.12, -0.6, 0, TAU); ctx.fill();
    // ring FRONT half
    if (skin.ring) {
      ctx.strokeStyle = skin.ring; ctx.lineWidth = Math.max(5, d * 0.1);
      ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.1, r * 1.55, r * 0.42, -0.25, 0, Math.PI); ctx.stroke();
    }
    // the face: big, centred, like every Block Buddies thing
    drawFace(ctx, cx, cy + r * 0.05, d * 0.7, mood, t, Math.round(cx * 0.01));
    ctx.restore();
  }
  function moon(ctx, cx, cy, d = 22) {
    const r = d / 2;
    ctx.fillStyle = '#e8e8f2';
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
    ctx.fillStyle = '#a9a9bb';
    ctx.beginPath(); ctx.arc(cx - r * 0.32, cy - r * 0.22, r * 0.3, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + r * 0.38, cy + r * 0.32, r * 0.22, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(30,20,60,0.5)'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
  }
  // n moons in a gentle arch above a planet: the counting target must be
  // an obvious, uncluttered row (like qbLayout 'arc'), never a cloud
  function moonRow(ctx, cx, y, n, d = 22) {
    const cell = d + 5, w = (n - 1) * cell;
    for (let i = 0; i < n; i++) {
      const k = n === 1 ? 0.5 : i / (n - 1);
      moon(ctx, cx - w / 2 + k * w, y - Math.sin(k * Math.PI) * 14, d);
    }
  }
  function rocket(ctx, cx, baseY, s = 170, t = 0, flame = 0, showFace = true) {
    const w = s * 0.34;
    ctx.save();
    if (flame > 0) { // exhaust: a flickering teardrop under the nozzle
      ctx.save(); ctx.globalAlpha = 0.9;
      const fl = s * (0.25 + 0.2 * flame) * (0.85 + 0.15 * Math.sin(t * 40));
      ctx.fillStyle = '#ff9f43';
      ctx.beginPath(); ctx.moveTo(cx - w * 0.28, baseY); ctx.quadraticCurveTo(cx, baseY + fl * 1.3, cx + w * 0.28, baseY); ctx.fill();
      ctx.fillStyle = '#ffe156';
      ctx.beginPath(); ctx.moveTo(cx - w * 0.14, baseY); ctx.quadraticCurveTo(cx, baseY + fl * 0.7, cx + w * 0.14, baseY); ctx.fill();
      ctx.restore();
    }
    // fins
    ctx.fillStyle = '#d63a3a';
    ctx.beginPath(); ctx.moveTo(cx - w / 2, baseY - s * 0.3); ctx.lineTo(cx - w * 0.95, baseY); ctx.lineTo(cx - w / 2, baseY); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx + w / 2, baseY - s * 0.3); ctx.lineTo(cx + w * 0.95, baseY); ctx.lineTo(cx + w / 2, baseY); ctx.closePath(); ctx.fill();
    // body
    const g = ctx.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
    g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#d8dce8');
    ctx.fillStyle = g;
    rr(ctx, cx - w / 2, baseY - s * 0.72, w, s * 0.72, w * 0.2); ctx.fill();
    ctx.strokeStyle = '#6a6f88'; ctx.lineWidth = 3;
    rr(ctx, cx - w / 2, baseY - s * 0.72, w, s * 0.72, w * 0.2); ctx.stroke();
    // nose cone
    ctx.fillStyle = '#ff5a5a';
    ctx.beginPath(); ctx.moveTo(cx - w / 2, baseY - s * 0.7); ctx.quadraticCurveTo(cx, baseY - s * 1.12, cx + w / 2, baseY - s * 0.7); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#b82a2a'; ctx.stroke();
    // nozzle
    ctx.fillStyle = '#6a6f88';
    rr(ctx, cx - w * 0.3, baseY - 6, w * 0.6, 8, 3); ctx.fill();
    // round window with the pilot's face
    ctx.fillStyle = '#7fd8ff';
    ctx.beginPath(); ctx.arc(cx, baseY - s * 0.5, w * 0.36, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#3f86d8'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(cx, baseY - s * 0.5, w * 0.36, 0, TAU); ctx.stroke();
    if (showFace) drawFace(ctx, cx, baseY - s * 0.5, w * 0.58, flame > 0 ? 'grin' : 'happy', t, 17);
    ctx.restore();
  }
  function pad(ctx, cx, y, w = 220, t = 0) {
    ctx.save();
    ctx.fillStyle = '#3d3766';
    rr(ctx, cx - w / 2, y, w, 26, 10); ctx.fill();
    ctx.fillStyle = '#7fd8ff';
    rr(ctx, cx - w / 2, y - 4, w, 10, 5); ctx.fill();
    // two thrusters holding it up in the dark
    ctx.fillStyle = 'rgba(176,108,240,' + (0.35 + 0.25 * Math.sin(t * 8)) + ')';
    for (const ox of [-w * 0.32, w * 0.32]) { ctx.beginPath(); ctx.ellipse(cx + ox, y + 34, 16, 10 + Math.sin(t * 9 + ox) * 3, 0, 0, TAU); ctx.fill(); }
    // blinking edge lights
    for (let i = 0; i < 5; i++) {
      const on = Math.floor(t * 3 + i) % 2 === 0;
      ctx.fillStyle = on ? '#ffe156' : '#8a7fae';
      ctx.beginPath(); ctx.arc(cx - w / 2 + 18 + i * ((w - 36) / 4), y + 13, 5, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  function bubble(ctx, cx, cy, w, h, tailToX, tailToY) {
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.94)';
    ctx.strokeStyle = '#8a7fae'; ctx.lineWidth = 4;
    rr(ctx, cx - w / 2, cy - h / 2, w, h, 34); ctx.fill(); ctx.stroke();
    for (let i = 1; i <= 3; i++) { // trailing thought dots toward the rocket
      const k = i / 4, r = 14 - i * 3;
      const x = lerp(cx - w / 2, tailToX, k), y = lerp(cy + h * 0.2, tailToY, k);
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }
  // the no-reading cue: three gray silhouettes, the WANTED one gold with a
  // star — one fixed convention for all four questions
  function cue(ctx, cx, cy, kind, s = 150) {
    const sizes = kind === 'biggest' || kind === 'smallest' ? [0.15, 0.22, 0.3] : [0.22, 0.22, 0.22];
    const dots = kind === 'most' || kind === 'fewest' ? [1, 2, 3] : [0, 0, 0];
    const want = kind === 'biggest' || kind === 'most' ? 2 : 0;
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const x = cx + (i - 1) * s * 0.38, r = s * sizes[i];
      const gold = i === want;
      ctx.fillStyle = gold ? '#ffd24a' : '#b8b4c8';
      ctx.beginPath(); ctx.arc(x, cy + s * 0.1, r, 0, TAU); ctx.fill();
      ctx.strokeStyle = gold ? '#a86a10' : '#6a6680'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x, cy + s * 0.1, r, 0, TAU); ctx.stroke();
      for (let m = 0; m < dots[i]; m++) { // mini moons above the silhouette
        const mx = x + (m - (dots[i] - 1) / 2) * s * 0.14;
        ctx.fillStyle = gold ? '#ffd24a' : '#b8b4c8';
        ctx.beginPath(); ctx.arc(mx, cy - s * 0.24, s * 0.05, 0, TAU); ctx.fill();
        ctx.strokeStyle = gold ? '#a86a10' : '#6a6680'; ctx.lineWidth = 2; ctx.stroke();
      }
      if (gold) {
        ctx.fillStyle = '#ffe156';
        starPath(ctx, x, cy - s * (dots[i] ? 0.4 : 0.28) - r * (dots[i] ? 0 : 0.7), s * 0.09, s * 0.04); ctx.fill();
        ctx.strokeStyle = '#a86a10'; ctx.lineWidth = 2; ctx.stroke();
      }
    }
    ctx.restore();
  }
  function gravGen(ctx, cx, groundY, t = 0) { ST_SCENE.gravityMachine(ctx, cx, groundY, 130, t, 1); }
  // the door: a ringed planet hatch standing on the maze floor, purple glow
  // leaking from a round porthole in its middle
  function door(ctx, cx, groundY, t = 0, opts = {}) {
    const d = 96, cy = groundY - 62;
    ctx.save();
    if (opts.glow) {
      ctx.globalAlpha = 0.35 + 0.15 * Math.sin(t * 3);
      ctx.fillStyle = '#b06cf0';
      ctx.beginPath(); ctx.arc(cx, cy, d * 0.75, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }
    planet(ctx, cx, cy, d, PL_SKINS[0], 'happy', t);
    // the porthole, tucked below the chin clear of the smile curve so the
    // face stays fully readable (mood='happy' mouth bottoms out ~0.24d below cy)
    ctx.fillStyle = '#1c1836';
    ctx.beginPath(); ctx.arc(cx, cy + d * 0.37, d * 0.1, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(176,108,240,' + (0.5 + 0.4 * Math.sin(t * 4)) + ')';
    ctx.beginPath(); ctx.arc(cx, cy + d * 0.37, d * 0.06, 0, TAU); ctx.fill();
    ctx.restore();
  }
  return { planet, moon, moonRow, rocket, pad, bubble, cue, gravGen, door };
})();
