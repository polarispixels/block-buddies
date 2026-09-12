// ============================================================================
// WORLD MAP LAYER (v1.31.0) — a reusable, data-driven star chart between the
// title and a world's destinations. Three layers, like Puzzle Blocks:
//   DATA      WORLD_MAPS[w] = { theme, nodes, paths }   (Space World = 9)
//   PROGRESS  MapProgress: unlocked / discovered / completed / last, in ONE
//             additive save key `ffbg_map`; legacy saves are inferred once
//   SCREEN    MAP_THEMES[theme] art + the WorldMap controller (game.state 'map')
// The controller never knows about space: a new biome = one WORLD_MAPS entry
// + one MAP_THEMES entry.
// ============================================================================
const WORLD_MAPS = {
  9: { // SPACE WORLD (displayed "8"): the maze, its two secret rooms, the station
    theme: 'space',
    nodes: [
      { id: 'maze',    level: 9,              kind: 'stage',    x: 250,  y: 470, icon: 'maze',     label: '8-1' },
      { id: 'zerog',   level: 'zerog',        kind: 'optional', x: 470,  y: 250, icon: 'asteroid' },
      { id: 'planets', level: 'planetblocks', kind: 'optional', x: 700,  y: 520, icon: 'planet' },
      { id: 'station', level: 'space2',       kind: 'stage',    x: 1010, y: 300, icon: 'station',  label: '8-2', requires: ['maze'] }
    ],
    paths: [['maze', 'zerog'], ['maze', 'planets'], ['maze', 'station']]
  }
};

const MapProgress = {
  data: {},          // w -> { u: [...], d: [...], c: [...], l: id }
  pendingReveal: {}, // w -> [ids unlocked since the map was last shown]
  load() {
    this.data = {};
    this.pendingReveal = {}; // in-memory only, never disk-backed — a fresh load has nothing pending
    try {
      const raw = localStorage.getItem('ffbg_map');
      if (raw) {
        const obj = JSON.parse(raw);
        for (const w in obj) {
          const e = obj[w];
          if (e && Array.isArray(e.u)) this.data[w] = { u: e.u.slice(), d: (e.d || []).slice(), c: (e.c || []).slice(), l: e.l || null };
        }
      }
    } catch (e) { this.data = {}; }
  },
  save() {
    try {
      if (Object.keys(this.data).length) localStorage.setItem('ffbg_map', JSON.stringify(this.data));
      else localStorage.removeItem('ffbg_map');
    } catch (e) {}
  },
  reset() { this.data = {}; this.pendingReveal = {}; try { localStorage.removeItem('ffbg_map'); } catch (e) {} },
  has(w) { return !!this.data[w]; },
  // first sight of a world's map: infer its entry from the saves that
  // already exist (ffbg_stage / ffbg_unlocked / ffbg_mini), then persist
  get(w) {
    if (this.data[w]) return this.data[w];
    const m = WORLD_MAPS[w];
    if (!m) return null;
    const e = { u: [], d: [], c: [], l: null };
    const chain = (typeof stageChain === 'function') ? stageChain(w) : [w];
    const prog = (game.stageProg && game.stageProg[w]) || 0;
    const beaten = game.unlocked > w;
    for (const n of m.nodes) {
      if (n.kind === 'stage') {
        const i = chain.indexOf(n.level);
        if (i === 0 || prog >= i || beaten) e.u.push(n.id);
        if ((i >= 0 && prog > i) || beaten) e.c.push(n.id);
      } else if (game.miniDone && game.miniDone[n.level]) { e.d.push(n.id); e.c.push(n.id); }
    }
    e.l = (m.nodes.find(n => n.kind === 'stage') || m.nodes[0]).id;
    this.data[w] = e;
    this.save();
    return e;
  },
  node(w, id) { const m = WORLD_MAPS[w]; return m ? m.nodes.find(n => n.id === id) : null; },
  isUnlocked(w, id) { const e = this.get(w); return !!e && e.u.includes(id); },
  isDiscovered(w, id) { const e = this.get(w); return !!e && e.d.includes(id); },
  isCompleted(w, id) { const e = this.get(w); return !!e && e.c.includes(id); },
  isSelectable(w, node) { return node.kind === 'stage' ? this.isUnlocked(w, node.id) : this.isDiscovered(w, node.id); },
  nodeState(w, node) {
    if (this.isCompleted(w, node.id) && this.isSelectable(w, node)) return 'done';
    if (this.isSelectable(w, node)) return 'open';
    return node.kind === 'stage' ? 'locked' : 'hidden';
  },
  recent(w) { const e = this.get(w); return e ? e.l : null; },
  setRecent(w, id) { const e = this.get(w); if (e && e.l !== id) { e.l = id; this.save(); } },
  unlock(w, id) { const e = this.get(w); if (e && !e.u.includes(id)) { e.u.push(id); this.save(); return true; } return false; },
  discover(w, id) { const e = this.get(w); if (e && !e.d.includes(id)) { e.d.push(id); this.save(); return true; } return false; },
  // mark a node completed and unlock every stage whose requirements are now
  // all complete; returns the newly unlocked ids (queued for the reveal)
  complete(w, id) {
    const e = this.get(w), m = WORLD_MAPS[w];
    if (!e) return [];
    if (!e.c.includes(id)) e.c.push(id);
    const fresh = [];
    for (const n of m.nodes) {
      if (n.kind !== 'stage' || e.u.includes(n.id)) continue;
      if ((n.requires || []).every(r => e.c.includes(r))) { e.u.push(n.id); fresh.push(n.id); }
    }
    if (fresh.length) (this.pendingReveal[w] = this.pendingReveal[w] || []).push(...fresh);
    this.save();
    return fresh;
  },
  takeReveal(w) { const r = this.pendingReveal[w] || []; this.pendingReveal[w] = []; return r; },
  findNode(levelId) {
    for (const w in WORLD_MAPS) { const n = WORLD_MAPS[w].nodes.find(n => n.level === levelId); if (n) return { w: +w, node: n }; }
    return null;
  },
  // generic hooks by level id — no-ops for levels on no map
  onEnter(levelId) { const f = this.findNode(levelId); if (f && f.node.kind === 'optional') this.discover(f.w, f.node.id); },
  onLevelDone(levelId) { const f = this.findNode(levelId); if (f) this.complete(f.w, f.node.id); }
};

// ---- themes: background + node art per biome ----
const MAP_THEMES = {
  space: {
    music: 'space',
    bgLv: null,
    drawBG(ctx, t, map) {
      if (!this.bgLv) { this.bgLv = newLevel(9); this.bgLv.plainSky = false; }
      drawBG(ctx, this.bgLv, { x: 0, y: 0 }, t);
      drawLevelIcon(ctx, W / 2, 62, 34, 'space', t);
    },
    // node icons — every one with a face, readable at ~90px
    icon(ctx, kind, x, y, s, t, gray) {
      ctx.save();
      if (gray) { ctx.filter = 'grayscale(1)'; ctx.globalAlpha *= 0.55; }
      if (kind === 'maze') { // a blue-gray asteroid criss-crossed by maze lines
        ctx.fillStyle = '#6a7fb0';
        ctx.beginPath(); ctx.arc(x, y, s, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#3d4f80'; ctx.lineWidth = s * 0.09; ctx.lineCap = 'round';
        ctx.save(); ctx.beginPath(); ctx.arc(x, y, s * 0.92, 0, TAU); ctx.clip();
        for (const [ax, ay, bx, by] of [[-0.9, -0.4, 0.2, -0.4], [0.2, -0.4, 0.2, 0.3], [-0.5, 0.1, -0.5, 0.9], [-0.5, 0.5, 0.7, 0.5], [0.7, -0.9, 0.7, 0.1]]) {
          ctx.beginPath(); ctx.moveTo(x + ax * s, y + ay * s); ctx.lineTo(x + bx * s, y + by * s); ctx.stroke();
        }
        ctx.restore();
        ctx.strokeStyle = 'rgba(30,20,60,0.5)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, s, 0, TAU); ctx.stroke();
        drawFace(ctx, x, y - s * 0.05, s * 0.9, 'happy', t, 9);
      } else if (kind === 'station') { // the saucer station: dome, hull, lit windows, antenna
        ctx.strokeStyle = '#b8b4c8'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(x, y - s * 0.6); ctx.lineTo(x, y - s * 1.1); ctx.stroke();
        ctx.fillStyle = '#ff5a5a'; ctx.beginPath(); ctx.arc(x, y - s * 1.12, s * 0.09, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(127,216,255,0.6)'; ctx.beginPath(); ctx.arc(x, y - s * 0.3, s * 0.5, Math.PI, TAU); ctx.fill();
        const g = ctx.createLinearGradient(x, y - s * 0.4, x, y + s * 0.4);
        g.addColorStop(0, '#d8dce8'); g.addColorStop(1, '#8a8fa8');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.ellipse(x, y, s * 1.15, s * 0.42, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#3d3766'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(x, y, s * 1.15, s * 0.42, 0, 0, TAU); ctx.stroke();
        for (let i = -2; i <= 2; i++) { ctx.fillStyle = (Math.floor(t * 2 + i) % 3 === 0) ? '#ffe156' : '#7fd8ff'; ctx.beginPath(); ctx.arc(x + i * s * 0.4, y + s * 0.05, s * 0.09, 0, TAU); ctx.fill(); }
        drawFace(ctx, x, y - s * 0.32, s * 0.55, 'happy', t, 5);
      } else if (kind === 'asteroid') { // the cracked Zero-G asteroid with gold light leaking out
        ctx.fillStyle = '#7a7a8c';
        ctx.beginPath(); ctx.moveTo(x - s, y + s * 0.3); ctx.lineTo(x - s * 0.7, y - s * 0.7); ctx.lineTo(x + s * 0.2, y - s); ctx.lineTo(x + s, y - s * 0.2); ctx.lineTo(x + s * 0.8, y + s * 0.8); ctx.lineTo(x - s * 0.3, y + s); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#4a4a5c'; ctx.lineWidth = 3; ctx.stroke();
        ctx.strokeStyle = '#ffe156'; ctx.lineWidth = s * 0.1; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x + s * 0.1, y - s * 0.9); ctx.lineTo(x - s * 0.15, y - s * 0.2); ctx.lineTo(x + s * 0.2, y + s * 0.2); ctx.lineTo(x, y + s * 0.9); ctx.stroke();
        for (let i = 0; i < 3; i++) { const a = t * 2 + i * 2.1; ctx.fillStyle = '#ffe156'; starPath(ctx, x + Math.cos(a) * s * 0.9, y + Math.sin(a) * s * 0.9, s * 0.16, s * 0.07); ctx.fill(); }
        drawFace(ctx, x - s * 0.3, y + s * 0.15, s * 0.6, 'sleepy', t, 2);
      } else if (kind === 'planet') {
        PL_ART.planet(ctx, x, y, s * 1.9, PL_SKINS[0], 'happy', t);
      }
      ctx.restore();
    },
    drawNode(ctx, node, st, t) {
      const x = node.x, y = node.y, s = 44;
      if (st.state === 'hidden') { // a faint twinkling "?" — something is out there
        ctx.save();
        ctx.globalAlpha = 0.25 + 0.15 * Math.sin(t * 2 + x);
        ctx.fillStyle = '#b06cf0';
        ctx.beginPath(); ctx.arc(x, y, s * 1.1, 0, TAU); ctx.fill();
        outlineText(ctx, '?', x, y + 6, 44, '#fff', '#5a4a86');
        ctx.restore();
        return;
      }
      if (st.selected) { // pulsing gold ring
        ctx.save();
        ctx.strokeStyle = '#ffe156'; ctx.lineWidth = 6; ctx.globalAlpha = 0.6 + 0.3 * Math.sin(t * 4);
        ctx.beginPath(); ctx.arc(x, y, s * 1.55 + Math.sin(t * 4) * 3, 0, TAU); ctx.stroke();
        ctx.restore();
      }
      this.icon(ctx, node.icon, x, y, s, t, st.state === 'locked');
      if (st.state === 'locked') { // padlock
        ctx.save();
        ctx.fillStyle = '#ffe156'; ctx.strokeStyle = '#a86a10'; ctx.lineWidth = 3;
        rr(ctx, x - 16, y + 4, 32, 26, 6); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = '#a86a10'; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.arc(x, y + 4, 11, Math.PI, TAU); ctx.stroke();
        ctx.restore();
      }
      if (st.state === 'done') { // gold star badge
        ctx.save();
        ctx.fillStyle = '#ffe156'; ctx.strokeStyle = '#a86a10'; ctx.lineWidth = 3;
        starPath(ctx, x + s * 0.95, y - s * 0.95, 20, 9); ctx.fill(); ctx.stroke();
        ctx.restore();
      }
      // tucked close under the icon, above the controller's fixed spacebar-hint zone (y+96)
      if (node.label) outlineText(ctx, node.label, x, y + s + 14, 26, '#fff', '#3a2a4a');
    },
    // the hero's little rocket hovers over the selected node, flame on while gliding
    drawCursor(ctx, x, y, flying, t) {
      const bob = Math.sin(t * 3) * 5;
      const baseY = y - 70 + bob, s = 96;
      PL_ART.rocket(ctx, x, baseY, s, t, flying ? 1 : 0);
      // the pilot's actual head, scaled to fit inside the rocket's window
      ctx.save();
      ctx.translate(x, baseY - s * 0.5);
      ctx.scale(0.5, 0.5);
      drawHead(ctx, 0, 0, game.character, t, false);
      ctx.restore();
    }
  }
};

// ---- the controller: one instance per visit on game.map, driven by game.state === 'map' ----
class WorldMap {
  constructor(w, reveal = []) {
    this.w = w;
    this.def = WORLD_MAPS[w];
    this.theme = MAP_THEMES[this.def.theme];
    this.nodes = this.def.nodes;
    this.t = 0;
    this.backBtn = { x: 56, y: 48, r: 32 };
    // the newly unlocked nodes scale in with confetti
    this.reveal = reveal.map(id => ({ id, t: 0 }));
    const last = MapProgress.recent(w);
    let sel = this.nodes.findIndex(n => n.id === last);
    if (sel < 0 || !this.selectable(sel)) sel = this.nodes.findIndex((n, i) => this.selectable(i));
    this.sel = Math.max(0, sel);
    this.rx = this.nodes[this.sel].x; this.ry = this.nodes[this.sel].y;
    this.flying = 0;
  }
  stateOf(i) { return MapProgress.nodeState(this.w, this.nodes[i]); }
  selectable(i) { return MapProgress.isSelectable(this.w, this.nodes[i]); }
  moveSel(dir) {
    let i = this.sel + dir;
    while (i >= 0 && i < this.nodes.length && !this.selectable(i)) i += dir;
    if (i >= 0 && i < this.nodes.length) { this.sel = i; AudioSys.sfx('candy'); }
  }
  launch(i) {
    if (!this.selectable(i)) { AudioSys.sfx('boing'); return; }
    const n = this.nodes[i];
    MapProgress.setRecent(this.w, n.id);
    MapProgress.onEnter(n.level);
    game.mapReturn = this.w;
    AudioSys.sfx('rainbow');
    game.startLevel(n.level);
  }
  tap(p) {
    if (Math.hypot(p.x - this.backBtn.x, p.y - this.backBtn.y) < this.backBtn.r * 1.4) { game.goTitle(); return true; }
    for (let i = 0; i < this.nodes.length; i++) {
      const n = this.nodes[i], st = this.stateOf(i);
      if (Math.hypot(p.x - n.x, p.y - n.y) > 62) continue;
      if (st === 'hidden') return false;
      if (st === 'locked') { AudioSys.sfx('boing'); return true; }
      this.sel = i;
      this.launch(i);
      return true;
    }
    return false;
  }
  update(dt) {
    this.t += dt;
    for (const r of this.reveal) {
      const was = r.t;
      r.t += dt;
      if (was === 0) {
        const n = this.nodes.find(n => n.id === r.id);
        AudioSys.sfx('fanfare');
        Particles.burst(n.x, n.y, 30, { colors: RAINBOW.concat(['#ffe156']), type: 'confetti', sp1: 320, l0: 0.8, l1: 1.8, s1: 11, grav: 260, up: 220 });
      }
    }
    if (justP.ArrowLeft) this.moveSel(-1);
    if (justP.ArrowRight) this.moveSel(1);
    // the rocket cursor glides to the selected node
    const n = this.nodes[this.sel];
    const dx = n.x - this.rx, dy = n.y - this.ry, d = Math.hypot(dx, dy);
    if (d > 1) { const k = Math.min(1, dt * 7); this.rx += dx * k; this.ry += dy * k; this.flying = 1; } else this.flying = 0;
    if (justP.Space) this.launch(this.sel);
  }
  draw(ctx) {
    const t = this.t;
    this.theme.drawBG(ctx, t, this);
    // paths first (dotted, lit when both ends are selectable)
    ctx.save();
    ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.setLineDash([2, 16]);
    for (const [a, b] of this.def.paths) {
      const na = this.nodes.find(n => n.id === a), nb = this.nodes.find(n => n.id === b);
      const lit = MapProgress.isSelectable(this.w, na) && MapProgress.isSelectable(this.w, nb);
      ctx.strokeStyle = lit ? 'rgba(255,225,86,0.9)' : 'rgba(255,255,255,0.22)';
      ctx.lineDashOffset = lit ? -t * 30 : 0;
      ctx.beginPath(); ctx.moveTo(na.x, na.y); ctx.lineTo(nb.x, nb.y); ctx.stroke();
    }
    ctx.restore();
    for (let i = 0; i < this.nodes.length; i++) {
      const n = this.nodes[i];
      const rv = this.reveal.find(r => r.id === n.id);
      const st = { state: this.stateOf(i), selected: i === this.sel, reveal: rv ? Math.min(1, rv.t / 0.7) : 1 };
      ctx.save();
      if (rv) { const k = st.reveal; ctx.translate(n.x, n.y); ctx.scale(k, k); ctx.translate(-n.x, -n.y); }
      this.theme.drawNode(ctx, n, st, t);
      ctx.restore();
    }
    // the cursor + spacebar hint (theme may override drawCursor; default = a ring)
    if (this.theme.drawCursor) this.theme.drawCursor(ctx, this.rx, this.ry, this.flying, t);
    else { ctx.strokeStyle = '#ffe156'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(this.rx, this.ry, 58 + Math.sin(t * 4) * 4, 0, TAU); ctx.stroke(); }
    if (!this.flying) drawSpacebar(ctx, this.nodes[this.sel].x, this.nodes[this.sel].y + 96, 120, t);
    // back to the title
    const b = this.backBtn;
    ctx.save();
    ctx.globalAlpha = 0.85; ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#8a7fae'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#5a4a86';
    ctx.beginPath(); ctx.moveTo(b.x - 14, b.y); ctx.lineTo(b.x + 8, b.y - 14); ctx.lineTo(b.x + 8, b.y + 14); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}
