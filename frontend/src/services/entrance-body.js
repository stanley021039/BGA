// Animate the real character, using the entrance owner's lifetime and quota.
export function playEntranceBody(anchor, img, id, duration) {
  if (!img?.animate || !id.startsWith('stitch-')) return () => {};
  const mode = /black-coffin|grail-mud|chibaku|explosion/.test(id)
    ? 'rise'
    : /lightning|saiyan|exodia|zanka/.test(id)
      ? 'charge'
      : /ulquiorra|blue-eyes|hyorinmaru/.test(id)
        ? 'float'
        : /starburst|black-moon|water-breathing|stand-fists/.test(id)
          ? 'step'
          : /pup|kitty|bungee/.test(id)
            ? 'bounce'
            : 'form';
  const first = {
    opacity: 0,
    filter: 'blur(5px)',
    clipPath: 'inset(100% 0 0 0)',
    transform: 'translateY(12px) scale(.85)',
  };
  if (mode === 'charge')
    Object.assign(first, {
      filter: 'brightness(.25)',
      clipPath: 'inset(0)',
      transform: 'scale(.7)',
    });
  if (mode === 'float')
    Object.assign(first, { transform: 'translateY(-36px) scale(.8)', clipPath: 'inset(0)' });
  if (mode === 'step')
    Object.assign(first, { transform: 'translateX(-24px) scaleX(.2)', clipPath: 'inset(0 50%)' });
  if (mode === 'rise')
    Object.assign(first, { transform: 'translateY(32px)', filter: 'brightness(.2)' });
  if (mode === 'bounce')
    Object.assign(first, { transform: 'translateY(-20px) scale(.9)', clipPath: 'inset(0)' });
  // Each theme has its own body choreography, rather than sharing one generic fade.
  const poses = {
    'stitch-saiyan': [
      'translateY(18px) scale(.72,.55)',
      'translateY(4px) scale(1.08,.88)',
      'translateY(-9px) scale(1.07)',
    ],
    'stitch-zanka': [
      'translateX(-34px) rotate(-18deg) scale(.65)',
      'translateX(5px) rotate(6deg)',
      'translateX(-2px) rotate(-2deg)',
    ],
    'stitch-senbonzakura': [
      'rotateY(90deg) scale(.45)',
      'rotateY(-12deg) rotate(5deg) scale(1.08)',
      'rotate(-3deg)',
    ],
    'stitch-hyorinmaru': [
      'translateY(-42px) scale(.7)',
      'translateY(-14px) scale(1.09)',
      'translateY(3px) scaleY(.93)',
    ],
    'stitch-minazuki': [
      'translateY(-9px) scaleY(.6)',
      'translateY(4px) skewX(-6deg)',
      'skewX(2deg)',
    ],
    'stitch-gilgamesh': [
      'perspective(280px) rotateY(65deg) scale(.6)',
      'perspective(280px) rotateY(-8deg) scale(1.08)',
      'rotateY(3deg)',
    ],
    'stitch-purple': ['scale(.08) rotate(-12deg)', 'scale(1.12) rotate(3deg)', 'scale(.97)'],
    'stitch-blue-eyes': [
      'translate(-15px,-46px) scale(.7)',
      'translateY(-12px) rotate(4deg)',
      'translateY(3px) scaleY(.9)',
    ],
    'stitch-black-coffin': [
      'scaleX(.05) translateY(18px)',
      'scaleX(1.1) translateY(-5px)',
      'scaleX(.97)',
    ],
    'stitch-grail-mud': [
      'translateY(38px) rotate(-9deg)',
      'translateY(-4px) rotate(4deg)',
      'rotate(-2deg)',
    ],
    'stitch-stand-fists': [
      'translateX(-24px) rotate(-10deg)',
      'translateX(8px) rotate(6deg)',
      'translateX(-3px)',
    ],
    'stitch-stand-time': ['skewX(14deg) scaleX(.2)', 'skewX(-8deg)', 'skewX(3deg)'],
    'stitch-stand-emerald': [
      'translateX(28px) scale(.75)',
      'translateX(-5px) rotate(-5deg)',
      'translateX(2px)',
    ],
    'stitch-ulquiorra': [
      'translateY(-32px) rotateY(90deg)',
      'translateY(-12px) rotateY(-12deg) scale(1.08)',
      'translateY(3px) scale(.97)',
    ],
    'stitch-lightning': [
      'translateY(-30px) skewX(12deg)',
      'translateY(3px) skewX(-8deg)',
      'skewX(3deg)',
    ],
    'stitch-exodia': ['translateY(24px) scaleY(.25)', 'translateY(-6px) scale(1.16)', 'scale(.96)'],
    'stitch-water-breathing': [
      'translate(-30px,9px) rotate(-28deg)',
      'translate(5px,-10px) rotate(8deg)',
      'translateY(2px) rotate(-3deg)',
    ],
    'stitch-explosion': [
      'translateY(-60px) scale(.55)',
      'translateY(6px) scale(1.12,.78)',
      'translateY(-8px) scale(.97,1.06)',
    ],
    'stitch-starburst': [
      'translateX(-38px) rotate(-12deg)',
      'translateX(6px) rotate(7deg)',
      'translateX(-3px) rotate(-3deg)',
    ],
    'stitch-black-moon': [
      'translate(35px,10px) rotate(22deg)',
      'translateX(-5px) rotate(-7deg)',
      'rotate(3deg)',
    ],
    'stitch-pup-parade': [
      'translateY(-22px) scale(.9)',
      'translateY(4px) scale(1.08,.9)',
      'translateY(-8px)',
    ],
    'stitch-gentle-kitty': [
      'translateX(20px) rotate(-8deg)',
      'translate(-3px,-5px) rotate(3deg)',
      'translateY(2px)',
    ],
    'stitch-chibaku-tensei': [
      'scale(.15) rotate(-150deg)',
      'scale(1.08) rotate(12deg)',
      'rotate(-5deg)',
    ],
    'stitch-bungee-gum': ['translateY(-25px) scale(.4,1.8)', 'scale(1.16,.78)', 'scale(.96,1.08)'],
  };
  const pose = poses[id] || [first.transform, 'scale(1.04)', 'none'];
  first.transform = pose[0];
  if (['stitch-saiyan', 'stitch-zanka', 'stitch-purple', 'stitch-exodia'].includes(id))
    first.clipPath = 'inset(0)';
  if (id === 'stitch-minazuki') first.clipPath = 'inset(0 0 100% 0)';
  const hold = id === 'stitch-saiyan' || id === 'stitch-zanka' ? 0.24 : 0.34;
  const animations = [
    img.animate(
      [
        { ...first, offset: 0, transformOrigin: '50% 100%' },
        { ...first, offset: hold, transformOrigin: '50% 100%' },
        {
          opacity: 1,
          filter: 'drop-shadow(0 2px 2px rgba(0,0,0,.75))',
          clipPath: 'inset(0)',
          transform: pose[1],
          offset: 0.58,
          transformOrigin: '50% 100%',
        },
        {
          opacity: 1,
          filter: 'drop-shadow(0 2px 2px rgba(0,0,0,.5))',
          clipPath: 'inset(0)',
          transform: pose[2],
          offset: 0.76,
        },
        { opacity: 1, filter: 'none', clipPath: 'inset(0)', transform: 'none', offset: 0.92 },
        { opacity: 1, filter: 'none', clipPath: 'inset(0)', transform: 'none', offset: 1 },
      ],
      { duration, easing: 'ease-out', fill: 'both' },
    ),
  ];
  // The effect canvas/markup lives at z=200. Lift the real actor for this entrance
  // only; cancellation restores Vue's current inline depth without overwriting it.
  if (anchor.animate)
    animations.push(anchor.animate([{ zIndex: 201 }, { zIndex: 201 }], { duration, fill: 'both' }));
  const name = anchor.querySelector(':scope > span');
  if (name?.animate)
    animations.push(
      name.animate(
        [
          { opacity: 0, offset: 0 },
          { opacity: 0, offset: 0.55 },
          { opacity: 1, offset: 0.9 },
          { opacity: 1, offset: 1 },
        ],
        { duration, fill: 'both' },
      ),
    );
  let live = true;
  return () => {
    if (!live) return;
    live = false;
    for (const animation of animations) animation.cancel();
  };
}
