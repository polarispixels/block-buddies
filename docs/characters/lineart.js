// LINE-ART REDRAW for the character gallery's coloring pages.
// Instead of tracing pixels, lineArtCtx(real, opt) wraps a canvas context so
// the game's own drawing code re-draws itself as a coloring page: every
// fill becomes white with a black outline, every thick colored stroke
// becomes an outlined white band, dark shapes (pupils, mouths) stay solid
// black, and faint/see-through shapes (glows, shadows, sparkles) are
// dropped. Painter's order is kept, so later shapes cleanly cover earlier
// outlines — overlaps read the same way they do in the color art.
function lineArtCtx(real, opt = {}) {
  const OUT = opt.outline || 6;      // outline width, device px
  const DETAIL = opt.detail || 4;    // min width for dark detail strokes, device px
  const MIN_ALPHA = opt.minAlpha || 0.5;
  const INK = '#1a1a1a';
  const devScale = () => {
    const m = real.getTransform();
    return Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || 1;
  };
  // parse the context's normalized color string -> {lum, a}; gradients/patterns count as light
  const probe = style => {
    if (typeof style !== 'string') return { lum: 1, a: 1 };
    let r, g, b, a = 1, m;
    if ((m = /^#([0-9a-f]{6})$/i.exec(style))) {
      const n = parseInt(m[1], 16); r = n >> 16; g = (n >> 8) & 255; b = n & 255;
    } else if ((m = /rgba?\(([^)]+)\)/.exec(style))) {
      [r, g, b, a = 1] = m[1].split(',').map(Number);
    } else return { lum: 1, a: 1 };
    return { lum: (0.299 * r + 0.587 * g + 0.114 * b) / 255, a };
  };
  const visible = p => p.a * real.globalAlpha >= MIN_ALPHA && real.globalCompositeOperation === 'source-over';
  const DARK = 0.24;
  // a stroke on the path that was JUST filled is that shape's outline — draw it
  // as one ink line (never an outlined band, which would double the edge)
  let justFilled = false;
  // device-space bbox of the current path, so only SMALL dark shapes (pupils,
  // mouths) stay solid ink — big dark ones (tires, boots) stay colorable
  let bx0, by0, bx1, by1;
  const resetBox = () => { bx0 = by0 = Infinity; bx1 = by1 = -Infinity; };
  resetBox();
  const addPt = (x, y, r = 0) => {
    const m = real.getTransform(), s = r ? devScale() * r : 0;
    const X = m.a * x + m.c * y + m.e, Y = m.b * x + m.d * y + m.f;
    bx0 = Math.min(bx0, X - s); bx1 = Math.max(bx1, X + s); by0 = Math.min(by0, Y - s); by1 = Math.max(by1, Y + s);
  };
  const SMALL = (opt.smallDark || 0.07) * real.canvas.width;
  const isSmall = () => Math.max(bx1 - bx0, by1 - by0) <= SMALL;

  function doFill(path, rule) {
    justFilled = !path;
    const p = probe(real.fillStyle);
    if (!visible(p)) return;
    const args = path ? [path, rule].filter(v => v !== undefined) : (rule ? [rule] : []);
    real.save();
    real.globalAlpha = 1; real.shadowBlur = 0; real.shadowColor = 'transparent';
    if (p.lum < DARK && (path ? path.small : isSmall())) { real.fillStyle = INK; real.fill(...args); real.restore(); return; }
    real.fillStyle = '#fff'; real.fill(...args);
    real.strokeStyle = INK; real.lineWidth = OUT / devScale(); real.lineJoin = 'round';
    if (!path) real.closePath(); // a filled half-dome needs its flat edge outlined too
    path ? real.stroke(path) : real.stroke();
    real.restore();
  }
  function doStroke(path) {
    const p = probe(real.strokeStyle);
    if (!visible(p)) return;
    const s = devScale(), lw = real.lineWidth, dev = lw * s;
    real.save();
    real.globalAlpha = 1; real.shadowBlur = 0; real.shadowColor = 'transparent';
    const st = () => path ? real.stroke(path) : real.stroke();
    if (!path && justFilled) { // the outline of the shape just filled
      real.strokeStyle = INK; real.lineWidth = OUT / s; st();
    } else if (p.lum > 0.8 && lw <= 3) { // a pale hairline edge-accent (game units): the fills already outline it
    } else if (p.a * real.globalAlpha < 0.75) { // a soft half-transparent edge: one outline-weight line
      real.strokeStyle = INK; real.lineWidth = OUT / s; st();
    } else if ((p.lum < DARK && lw < 5) || dev < OUT * 1.6) { // a line (incl. dark detail: mouths, lashes): keep it a line, in ink
      real.strokeStyle = INK; real.lineWidth = Math.max(lw, DETAIL / s); st();
    } else { // a thick band (mane stripe, arm, dark spider leg — lw ≥ 5 game units): outline it
      real.strokeStyle = INK; real.lineWidth = lw + 2 * OUT / s; st();
      real.strokeStyle = '#fff'; real.lineWidth = lw; st();
    }
    real.restore();
  }
  const rectPath = (x, y, w, h) => {
    const p = new Path2D(); p.rect(x, y, w, h);
    const s = devScale(); p.small = Math.max(Math.abs(w), Math.abs(h)) * s <= SMALL;
    return p;
  };
  const over = {
    beginPath: () => { justFilled = false; resetBox(); real.beginPath(); },
    moveTo: (x, y) => { addPt(x, y); real.moveTo(x, y); },
    lineTo: (x, y) => { addPt(x, y); real.lineTo(x, y); },
    quadraticCurveTo: (a, b, x, y) => { addPt(a, b); addPt(x, y); real.quadraticCurveTo(a, b, x, y); },
    bezierCurveTo: (a, b, c, d, x, y) => { addPt(a, b); addPt(c, d); addPt(x, y); real.bezierCurveTo(a, b, c, d, x, y); },
    arcTo: (a, b, c, d, r) => { addPt(a, b); addPt(c, d); real.arcTo(a, b, c, d, r); },
    arc: (x, y, r, ...rest) => { addPt(x, y, r); real.arc(x, y, r, ...rest); },
    ellipse: (x, y, rx, ry, ...rest) => { addPt(x, y, Math.max(rx, ry)); real.ellipse(x, y, rx, ry, ...rest); },
    rect: (x, y, w, h) => { addPt(x, y); addPt(x + w, y + h); real.rect(x, y, w, h); },
    roundRect: (x, y, w, h, r) => { addPt(x, y); addPt(x + w, y + h); real.roundRect(x, y, w, h, r); },
    fill: (a, b) => (a && typeof a === 'object') ? doFill(a, b) : doFill(null, a),
    stroke: path => doStroke(path || null),
    fillRect: (x, y, w, h) => doFill(rectPath(x, y, w, h)),
    strokeRect: (x, y, w, h) => doStroke(rectPath(x, y, w, h)),
    fillText: (...a) => { real.save(); real.fillStyle = INK; real.fillText(...a); real.restore(); },
    strokeText: () => {},
    drawImage: () => {}
  };
  return new Proxy(real, {
    get(t, k) {
      if (k in over) return over[k];
      const v = t[k];
      return typeof v === 'function' ? v.bind(t) : v;
    },
    set(t, k, v) { t[k] = v; return true; }
  });
}
