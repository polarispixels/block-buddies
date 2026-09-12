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
