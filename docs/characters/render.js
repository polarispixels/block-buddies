// CHARACTER RENDERER shared by the gallery page (docs/characters/index.html)
// and the static exporter (tools/export-characters.html), so the downloadable
// images and the published assets/characters/*.png are pixel-identical.
// Needs the game scripts + catalog.js + lineart.js loaded first.
const CharRender = (function () {
  const TARGET = 1600;   // longest side of the full-size PNG, px
  const PAD = 0.06;      // margin around the character, fraction of TARGET

  // Draw once at 1x into scratch space to find the character's pixel bounds.
  function bounds(entry) {
    const c = document.createElement('canvas'); c.width = c.height = 1000;
    const x = c.getContext('2d');
    entry.draw(x);
    const d = x.getImageData(0, 0, 1000, 1000).data;
    let x0 = 1000, y0 = 1000, x1 = -1, y1 = -1;
    for (let y = 0; y < 1000; y++) for (let i = y * 1000, xx = 0; xx < 1000; xx++, i++) {
      if (d[i * 4 + 3] > 8) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    if (x1 < 0) throw new Error('nothing drawn for ' + entry.id);
    return { x: x0 - 2, y: y0 - 2, w: x1 - x0 + 5, h: y1 - y0 + 5 };
  }
  // Re-draw as vectors at full size (crisp, not an upscaled bitmap).
  function frameFor(entry) {
    const b = bounds(entry);
    const P = Math.round(TARGET * PAD), k = (TARGET - 2 * P) / Math.max(b.w, b.h);
    return { b, P, k, W: Math.round(b.w * k) + 2 * P, H: Math.round(b.h * k) + 2 * P };
  }
  function renderAt(f, paint) {
    const c = document.createElement('canvas'); c.width = f.W; c.height = f.H;
    const x = c.getContext('2d');
    paint(x, () => x.setTransform(f.k, 0, 0, f.k, f.P - f.b.x * f.k, f.P - f.b.y * f.k));
    return c;
  }
  const renderColor = (entry, f) => renderAt(f, (x, place) => { place(); entry.draw(x); });
  // Coloring page: the SAME drawing code re-drawn through lineArtCtx (lineart.js) —
  // white shapes with black outlines, not a traced bitmap.
  const renderLines = (entry, f) => renderAt(f, (x, place) => {
    x.fillStyle = '#fff'; x.fillRect(0, 0, f.W, f.H);
    place(); entry.draw(lineArtCtx(x, { outline: Math.round(f.W / 260) + 1 }));
  });
  return { TARGET, frameFor, renderColor, renderLines };
})();
