"""Build the bundled character images from Kenney's CC0 Toon/Platformer packs.

Usage: python scripts/build-character-assets.py <toon-extract-dir> <platformer-extract-dir>
The source ZIPs and licenses are linked in docs/CHARACTER-ASSET-TEMPLATE.md.
"""
from pathlib import Path
import sys
from PIL import Image

TOON = [
    ('traveler', 'Female adventurer', 'femaleAdventurer'),
    ('woods', 'Male adventurer', 'maleAdventurer'),
    ('mage', 'Female person', 'femalePerson'),
    ('knight', 'Male person', 'malePerson'),
    ('sunny', 'Robot', 'robot'),
    ('harbor', 'Zombie', 'zombie'),
]
PLATFORMER = [
    ('bloom', 'Adventurer', 'adventurer'),
    ('ember', 'Female', 'female'),
    ('starlight', 'Player', 'player'),
    ('meadow', 'Soldier', 'soldier'),
]
OUT = Path(__file__).resolve().parents[1] / 'public' / 'assets' / 'characters'


def compose(source, names):
    frames = [Image.open(source / (name + '.png')).convert('RGBA') for name in names]
    bounds = [frame.getbbox() for frame in frames]
    width = max(box[2] - box[0] for box in bounds)
    height = max(box[3] - box[1] for box in bounds)
    scale = min(216 / width, 216 / height)
    results = []
    for frame, box in zip(frames, bounds):
        cropped = frame.crop(box)
        size = (round(cropped.width * scale), round(cropped.height * scale))
        resized = cropped.resize(size, Image.Resampling.LANCZOS)
        canvas = Image.new('RGBA', (256, 256))
        canvas.alpha_composite(resized, ((256 - size[0]) // 2, 232 - size[1]))
        results.append(canvas)
    return results


def save_character(slug, source, prefix, cheer, angry, more):
    OUT.mkdir(parents=True, exist_ok=True)
    for expression, pose in [('neutral', 'idle'), ('sad', 'hurt'), ('angry', angry), *more]:
        compose(source, [prefix + '_' + pose])[0].save(OUT / f'{slug}-{expression}.png')
    frames = compose(source, [prefix + '_' + pose for pose in cheer])
    # GIF frames keep transparency and a fixed 256x256 canvas.
    paletted = []
    for frame in frames:
        palette = frame.convert('RGB').quantize(colors=255)
        alpha = frame.getchannel('A')
        palette.paste(255, mask=alpha.point(lambda value: 255 if value < 64 else 0))
        palette.info['transparency'] = 255
        paletted.append(palette)
    paletted[0].save(OUT / f'{slug}-happy.gif', save_all=True,
                     append_images=[paletted[1], paletted[0]],
                     duration=[350, 350, 500], loop=0, disposal=2,
                     transparency=255, optimize=False)


def main():
    toon = Path(sys.argv[1])
    platformer = Path(sys.argv[2])
    for slug, folder, prefix in TOON:
        source = toon / folder / 'PNG' / 'Poses'
        save_character(slug, source, 'character_' + prefix,
                       ['cheer0', 'cheer1'], 'attack0',
                       [('surprised', 'wide'), ('thinking', 'think')])
    for slug, folder, prefix in PLATFORMER:
        source = platformer / 'PNG' / folder / 'Poses'
        save_character(slug, source, prefix, ['cheer1', 'cheer2'], 'action1', [])


if __name__ == '__main__':
    main()
