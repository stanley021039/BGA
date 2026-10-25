"""Rebuild supplied Second Wind art: python tools/second-wind-art.py <archive-directory>.

Requires pypdfium2 and Pillow. Source PDFs/PNGs stay outside the repository.
Coordinates refer to physical PDF pages; never to Pokémon sheets.
"""
import hashlib
import json
import sys
from pathlib import Path

import pypdfium2 as pdfium
from PIL import Image

source = Path(sys.argv[1])
target = Path(__file__).resolve().parents[1] / 'frontend/src/assets/second-wind'
target.mkdir(parents=True, exist_ok=True)
pdf = pdfium.PdfDocument(source / '規則.pdf')
manifest = {'source': 'User-supplied 運動員/規則.pdf, 3.png, 4.png',
            'usage': 'Original Second Wind miniature card art; local playtest candidate. Publication rights pending confirmation in #227.',
            'sources': {f: hashlib.sha256((source / f).read_bytes()).hexdigest()
                        for f in ['規則.pdf', '3.png', '4.png']}, 'assets': []}


def save(image, name, width, origin):
    image = image.convert('RGB')
    image.thumbnail((width, 2000), Image.Resampling.LANCZOS)
    file = target / (name + '.webp')
    image.save(file, 'WEBP', quality=82, method=6)
    data = file.read_bytes()
    assert len(data) <= 256 * 1024, name
    manifest['assets'].append({'file': file.name, 'width': image.width,
                               'height': image.height, 'bytes': len(data),
                               'sha256': hashlib.sha256(data).hexdigest(), 'origin': origin})


pages = {
    24: ['bite-mark', 'critic', 'gloth', 'blunderdog', 'diva', 'hog-knight', 'cheatah', 'doppelgangster', 'hopfrog'],
    25: ['hotel', 'kraken', 'mole', 'icarus', 'le-saboteur', 'mr-dice-guy', 'kingtripper', 'magical-athlete', 'mush'],
    26: ['nemesis', 'overtaker', 're-runner', 'nepo-baby', 'party-pooper', 'show-off', 'null', 'penguin', 'soulmate'],
    27: ['speed-demon', 'streaker', 'tail', 'spoilsport', 'stunner', 'the-hose', 'stepdad', 'switcharoo', 'understudy'],
}
for page, ids in pages.items():
    rendered = pdf[page - 1].render(scale=4).to_pil()
    for i, racer in enumerate(ids):
        x, y = [725.7, 951, 1176.3][i % 3], [117.8, 251.2, 383.9][i // 3]
        card = rendered.crop(tuple(round(v * 4) for v in (x, y, x + 68, y + 95)))
        save(card, racer + '-card', 272, f'規則.pdf physical page {page}, English card {i + 1}')
        portrait = card.crop((20, 58, 252, 228))
        save(portrait, racer + '-portrait', 96, f'規則.pdf physical page {page}, English card {i + 1}, illustration crop')

twists = {
    28: ['alchemy-lab', 'fans-demand-chaos', 'bonkbug', 'mirror-world', 'conveyor', 'scrying-pool', 'curse-wands', 'pinata'],
    29: ['randomness-ceased', 'time-imp', 'roast-chicken', None, 'season-finale', None, 'swap-meet', None],
}
for page, ids in twists.items():
    rendered = pdf[page - 1].render(scale=3).to_pil()
    for i, twist in enumerate(ids):
        if not twist:
            continue
        x, y = [725.7, 1037][i % 2], [105.8, 203.5, 301.5, 399.2][i // 2]
        card = rendered.crop(tuple(round(v * 3) for v in (x, y, x + 142.5, y + 78.5)))
        save(card, twist + '-twist', 428, f'規則.pdf physical page {page}, English Twist {i + 1}')

monster = pdf[28].render(scale=2).to_pil().crop((2220, 418, 2762, 944))
save(monster, 'weremouth-portrait', 96, '規則.pdf physical page 29, W.E.R.E.M.O.U.T.H. illustration')
hero = pdf[8].render(scale=1.5).to_pil().crop((0, 0, 1058, 745))
save(hero, 'hero', 560, '規則.pdf physical page 9, original celebration illustration')
for name, file in [('twisty-twirl', '3.png'), ('whirly-world', '4.png')]:
    with Image.open(source / file) as image:
        for size in [800, 1600]:
            save(image.copy(), f'{name}-{size}', size, file)
(target / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f'{len(manifest["assets"])} WebP assets, {sum(a["bytes"] for a in manifest["assets"])} bytes')
