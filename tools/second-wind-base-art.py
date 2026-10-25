"""Read-only extraction of the 36 English base-game cards; originals stay local."""
import argparse
import hashlib
import json
from pathlib import Path
import pypdfium2 as pdfium

parser = argparse.ArgumentParser()
parser.add_argument('--pdf', required=True)
args = parser.parse_args()
source = Path(args.pdf)
output = Path(__file__).resolve().parents[1] / 'frontend/src/assets/second-wind-base'
output.mkdir(parents=True, exist_ok=True)
pages = {
    24: ['alchemist', 'blimp', 'coach', 'baba-yaga', 'centaur', 'copy-cat', 'banana', 'cheerleader', 'dicemonger'],
    25: ['duelist', 'genius', 'heckler', 'egg', 'gunk', 'huge-baby', 'flip-flop', 'hare', 'hypnotist'],
    26: ['inchworm', 'legs', 'mastermind', 'lackey', 'loveable-loser', 'mouth', 'leaptoad', 'magician', 'party-animal'],
    27: ['rocket-scientist', 'sisyphus', 'suckerfish', 'romantic', 'skipper', 'third-wheel', 'scoocher', 'stickler', 'twin'],
}
manifest = {'source': 'CMYK 2025 base rulebook, updated English edition',
            'sourceUrl': 'https://johnnlds.github.io/Magical-Athlete-Racers/officialrules.pdf',
            'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'assets': []}
document = pdfium.PdfDocument(str(source))
for page, ids in pages.items():
    rendered = document[page - 1].render(scale=4).to_pil()
    for index, racer in enumerate(ids):
        x, y = [20, 245.3, 470.6][index % 3], [117.8, 251.2, 383.9][index // 3]
        card = rendered.crop(tuple(round(v * 4) for v in (x, y, x + 68, y + 95)))
        for kind, image in [('card', card), ('portrait', card.crop((20, 58, 252, 228)))]:
            image = image.convert('RGB')
            image.thumbnail((272, 380) if kind == 'card' else (96, 72))
            file = output / f'{racer}-{kind}.webp'
            image.save(file, 'WEBP', quality=82, method=6)
            data = file.read_bytes()
            assert len(data) <= 256 * 1024
            manifest['assets'].append({'file': file.name, 'width': image.width, 'height': image.height,
                                      'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(),
                                      'origin': f'CMYK base rulebook physical page {page}, card {index+1}, {kind}'})
(output / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
print(json.dumps({'assets': len(manifest['assets']), 'bytes': sum(a['bytes'] for a in manifest['assets'])}))
