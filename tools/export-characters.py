#!/usr/bin/env python3
"""Export the character gallery as static assets for external tools.

Writes, for every CHARACTER_CATALOG entry (docs/characters/catalog.js):
  assets/characters/<id>.png        full-resolution color, transparent background
  assets/characters/<id>-line.png   coloring-page line art, white background
and the manifest assets/characters.json.

The images come from the SAME renderer the gallery page uses
(docs/characters/render.js), run in real headless Chrome (Windows side, via WSL
interop — see tools/screenshot.sh). Re-run this after adding/changing a
character or changing game art; the harness fails if the manifest and the
catalog disagree.

Usage: tools/export-characters.py
"""
import base64, hashlib, json, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHROME = '/mnt/c/Program Files/Google/Chrome/Application/chrome.exe'
BASE_URL = 'https://polarispixels.github.io/block-buddies/'
OUT_DIR = os.path.join(ROOT, 'assets', 'characters')
MANIFEST = os.path.join(ROOT, 'assets', 'characters.json')
# gallery-side sources whose change means the images must be regenerated
SOURCES = ['docs/characters/catalog.js', 'docs/characters/lineart.js', 'docs/characters/render.js']


def source_hash():
    h = hashlib.sha256()
    for rel in SOURCES:
        with open(os.path.join(ROOT, rel), 'rb') as f:
            h.update(f.read())
    return h.hexdigest()[:16]


def main():
    if not os.path.exists(CHROME):
        sys.exit('Chrome not found at ' + CHROME)
    index = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
    game_scripts = re.findall(r'<script src="(js/[^"]+)"></script>', index)
    tmp = os.path.join(ROOT, 'tools', '_export_characters.html')
    tags = '\n'.join('<script src="../%s"></script>' % s for s in game_scripts)
    with open(tmp, 'w', encoding='utf-8') as f:
        f.write('''<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"></head><body>
<canvas id="game" width="1280" height="720" style="display:none"></canvas>
<script>window.__ael = window.addEventListener; window.addEventListener = function () {};</script>
%s
<script>window.addEventListener = window.__ael; frame = function () {}; AudioSys.unlock = function () {};</script>
<script src="../docs/characters/catalog.js"></script>
<script src="../docs/characters/lineart.js"></script>
<script src="../docs/characters/render.js"></script>
<pre id="out"></pre>
<script>
const out = { version: GAME_VERSION, characters: [] };
for (const c of CHARACTER_CATALOG) {
  const f = CharRender.frameFor(c);
  out.characters.push({ id: c.id, name: c.name, group: c.group, description: c.blurb, width: f.W, height: f.H,
    color: CharRender.renderColor(c, f).toDataURL('image/png'),
    lines: CharRender.renderLines(c, f).toDataURL('image/png') });
}
document.getElementById('out').textContent = 'EXPORT<<' + JSON.stringify(out) + '>>EXPORT';
</script></body></html>''' % tags)
    try:
        url = 'file://wsl.localhost/Ubuntu' + ROOT + '/tools/_export_characters.html'
        dom = subprocess.run([CHROME, '--headless', '--disable-gpu', '--virtual-time-budget=60000',
                              '--dump-dom', url], capture_output=True, timeout=600).stdout.decode('utf-8', 'replace')
    finally:
        os.remove(tmp)
    m = re.search(r'EXPORT&lt;&lt;(.*)&gt;&gt;EXPORT', dom, re.S) or re.search(r'EXPORT<<(.*)>>EXPORT', dom, re.S)
    if not m:
        sys.exit('export failed: no data in the dumped page (did a catalog entry throw?)')
    data = json.loads(m.group(1).replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>'))

    os.makedirs(OUT_DIR, exist_ok=True)
    keep = set()
    chars = []
    for c in data['characters']:
        for key, suffix in (('color', ''), ('lines', '-line')):
            name = c['id'] + suffix + '.png'
            keep.add(name)
            with open(os.path.join(OUT_DIR, name), 'wb') as f:
                f.write(base64.b64decode(c[key].split(',', 1)[1]))
        chars.append({
            'id': c['id'],
            'name': c['name'],
            'group': c['group'],
            'description': c['description'],
            'colorImageUrl': BASE_URL + 'assets/characters/' + c['id'] + '.png',
            'lineArtImageUrl': BASE_URL + 'assets/characters/' + c['id'] + '-line.png',
            'width': c['width'],
            'height': c['height'],
        })
    for stale in os.listdir(OUT_DIR):  # a removed character's files go too
        if stale.endswith('.png') and stale not in keep:
            os.remove(os.path.join(OUT_DIR, stale))
    manifest = {
        'name': 'Block Buddies character assets',
        'description': 'Every character in the Block Buddies Character Gallery as a full-resolution PNG: '
                       'color on a transparent background, and black-on-white coloring-page line art. '
                       'IDs are stable; look characters up by id.',
        'generatedAtVersion': data['version'],
        'sourceHash': source_hash(),
        'gallery': BASE_URL + 'docs/characters/',
        'imageFormat': 'image/png',
        'count': len(chars),
        'characters': chars,
    }
    with open(MANIFEST, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
        f.write('\n')
    print('exported %d characters -> assets/characters/ + assets/characters.json' % len(chars))


if __name__ == '__main__':
    main()
