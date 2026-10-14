"""Original short cues for Quacks. Rebuild with the Python standard library."""
from pathlib import Path
import math,random,wave,struct
p=Path(__file__).resolve().parents[1]
cues={'quacks-draw':540,'quacks-danger':420,'quacks-potion-synth':550,'quacks-buy':380,'quacks-ruby':460,'quacks-witch':750}
# Soft original synthesis: seeded noise, low resonances and faded envelopes.
rate=24000; rnd=random.Random(1014)
for cue,ms in cues.items():
    length=int(rate*ms/1000); samples=[]; smooth=0
    for i in range(length):
        t=i/rate; u=i/length; smooth=smooth*.86+rnd.uniform(-1,1)*.14
        env=min(1,i/(rate*.014))*min(1,(length-i)/(rate*.065))
        if cue=='quacks-draw':
            rustle=smooth*.43*math.exp(-t*12); drop=0 if t<.19 else math.sin(2*math.pi*(170*(t-.19)+65*math.exp(-13*(t-.19))))*.22*math.exp(-15*(t-.19)); v=rustle+drop
        elif cue=='quacks-danger':v=sum(math.sin(2*math.pi*f*t) for f in [220,277])* .10*math.sin(math.pi*u)**2
        elif cue=='quacks-potion-synth':v=math.sin(2*math.pi*(320*t+80*t*t))*.18*math.exp(-t*5)+smooth*.10
        elif cue=='quacks-buy':v=smooth*.28*math.exp(-t*12)+math.sin(2*math.pi*410*t)*.12*math.exp(-t*13)
        elif cue=='quacks-ruby':v=sum(math.sin(2*math.pi*f*t)*math.exp(-t*(4+j*3)) for j,f in enumerate([659,988,1318]))*.075
        else:v=sum(math.sin(2*math.pi*f*t) for f in [196,247,294])*.065*math.sin(math.pi*u)**2+smooth*.04
        samples.append(struct.pack('<h',int(max(-.8,min(.8,v*env))*32767)))
    with wave.open(str(p/'public/assets/game-sounds'/f'{cue}.wav'),'wb') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(rate);w.writeframes(b''.join(samples))
