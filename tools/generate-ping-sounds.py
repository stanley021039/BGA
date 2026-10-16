"""Original synthetic ping cues; no external samples (24 kHz mono PCM)."""
import math
from pathlib import Path
import struct
import wave

ROOT = Path(__file__).resolve().parents[1] / 'public/assets/game-sounds'
TONES = {'ping': [880, 1320], 'attention': [660, 440, 330],
         'question': [660, 940, 780], 'help': [520, 780, 1040],
         'look': [740, 1110]}
for name, notes in TONES.items():
    samples = []
    for i in range(7680):
        t = i / 24000
        segment = min(len(notes) - 1, int(t / .32 * len(notes)))
        local = t - segment * .32 / len(notes)
        length = .32 / len(notes)
        envelope = min(1, local / .008) * max(0, 1 - local / length) ** 1.5
        frequency = notes[segment]
        value = (math.sin(2 * math.pi * frequency * local)
                 + .22 * math.sin(4 * math.pi * frequency * local))
        samples.append(struct.pack('<h', round(9000 * envelope * value)))
    with wave.open(str(ROOT / ('ping-' + name + '.wav')), 'wb') as audio:
        audio.setparams((1, 2, 24000, 0, 'NONE', 'not compressed'))
        audio.writeframes(b''.join(samples))
