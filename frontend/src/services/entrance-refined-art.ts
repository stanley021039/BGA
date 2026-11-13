import originals from '../../../public/shared/entrance-requirements.json';
import palettes from '../../../public/shared/entrance-palette.json';

const IDS = new Set([
  'stitch-gilgamesh',
  'stitch-blue-eyes',
  'stitch-lightning',
  'stitch-hyorinmaru',
]);

function iceWings(alternate: boolean) {
  const tips = [
    [-113, -80],
    [-125, -38],
    [-112, 8],
    [-84, 37],
    [-48, 51],
  ];
  const wing = tips
    .map(([x, y], i) => {
      const length = Math.hypot(x, y),
        nx = -y / length,
        ny = x / length,
        width = 10 + i * 1.2;
      const point = (t: number, side: number) =>
        `${(x * t + nx * width * side).toFixed(1)} ${(y * t + ny * width * side).toFixed(1)}`;
      return `<g class="ice-feather"><path class="ice-facet" d="M0 0 ${point(0.27, 1)} ${point(0.7, 0.45)} ${x} ${y} ${point(0.74, -0.4)} ${point(0.3, -1)}Z"/><path class="ice-shadow" d="M0 0 ${x} ${y} ${point(0.74, -0.4)} ${point(0.3, -1)}Z"/><path class="ice-spine" d="M0 0 ${x} ${y}"/><path class="ice-etch" d="M${point(0.33, 0.75)} ${point(0.46, 0)} ${point(0.41, -0.65)}M${point(0.63, 0.45)} ${point(0.7, 0)}"/></g>`;
    })
    .join('');
  const flowers = [
    [96, 54, 15],
    [160, 32, 18],
    [224, 54, 15],
  ]
    .map(
      ([x, y, r]) =>
        `<g class="ice-flower" transform="translate(${x} ${y})"><g class="ice-flower-turn">${Array.from({ length: 6 }, (_, i) => `<path transform="rotate(${i * 60})" d="M0 0V-${r}M0-${r * 0.45}l-4-4M0-${r * 0.45}l4-4"/>`).join('')}<path class="ice-flower-heart" d="M0-5 4-2 4 2 0 5-4 2-4-2Z"/>${alternate ? '<path class="ice-etch" d="M-8-3-6-6M8 3 6 6"/>' : ''}</g></g>`,
    )
    .join('');
  return `<svg class="entrance-refined-art ice-art" style="--refined-metal:url(#ice-metal)" viewBox="0 0 320 260" aria-hidden="true">
    <defs><linearGradient id="ice-metal" x2="1" y2=".65"><stop stop-color="var(--refined-highlight)" stop-opacity=".9"/><stop offset=".42" stop-color="var(--refined-primary)" stop-opacity=".52"/><stop offset=".48" stop-color="var(--refined-highlight)"/><stop offset="1" stop-color="var(--refined-shadow)" stop-opacity=".4"/></linearGradient><radialGradient id="ice-halo"><stop stop-color="var(--refined-primary)" stop-opacity=".19"/><stop offset="1" stop-color="var(--refined-primary)" stop-opacity="0"/></radialGradient></defs>
    <ellipse cx="160" cy="128" rx="145" ry="111" fill="url(#ice-halo)"/>
    ${flowers}
    <g transform="translate(144 124)"><g class="ice-wing-motion">${wing}</g></g><g transform="translate(176 124) scale(-1 1)"><g class="ice-wing-motion ice-wing-reverse">${wing}</g></g>
    <g class="ice-tail"><path class="ice-facet" d="M177 154Q222 151 236 179L257 184 242 194 250 208 232 208 225 225 213 215 199 222 198 208Q229 207 224 190Q215 172 173 170Z"/><path class="ice-etch" d="M186 162 215 170 226 186 235 200 219 215M217 173l11-2M228 187l13-1M230 203l12 7"/></g>
    <path class="ice-collar ice-facet" d="m143 113 9-17 8 12 10-15 8 20-18 8Z"/>
    <g class="ice-floor">${[
      [-77, 10, 24],
      [-49, -1, 33],
      [-20, 8, 17],
      [31, 2, 25],
      [61, 10, 33],
      [85, 4, 18],
    ]
      .map(
        ([x, y, h]) =>
          `<g transform="translate(${160 + x} ${202 + y})"><path class="ice-facet" d="M-8 0-5-${h * 0.65} 0-${h} 6-${h * 0.56} 9 1Z"/><path class="ice-spine" d="M0-${h}V2"/></g>`,
      )
      .join(
        '',
      )}<path class="ice-etch" d="M68 213Q160 240 253 213M97 224 120 219 148 231 168 223 205 229 225 216"/></g>
    ${alternate ? '<path class="ice-seals" d="m64 109 4-8 4 8-4 8Zm184 0 4-8 4 8-4 8ZM134 172l4-7 4 7-4 7Zm45 0 4-7 4 7-4 7Z"/>' : '<path class="ice-seals" d="m67 105 2 10m-6-5h10m176-5 2 10m-6-5h10"/>'}
  </svg>`;
}

function treasury(alternate: boolean) {
  const slots = [
    [43, 90, -40],
    [91, 53, -23],
    [160, 33, 0],
    [229, 53, 23],
    [277, 90, 40],
    [51, 157, -64],
    [269, 157, 64],
  ];
  const blades = [
    '<path class="metal" d="M0-47 7-23 3-5-3-5-7-23Z"/><path class="edge" d="M0-43V-7M-13-3H13M0-3V14"/><path class="gem" d="M0-14 3-10 0-6-3-10Z"/>',
    '<path class="metal" d="M0-51 5-34 2-26-2-26-5-34Z"/><path class="edge" d="M0-45V15M-9-27H9M-6 9H6"/>',
    '<path class="metal" d="M-2-35Q-26-42-19-17L-3-23H3L19-17Q26-42 2-35Z"/><path class="edge" d="M0-40V14M-17-22-5-29M17-22 5-29"/>',
  ];
  return `<svg class="entrance-refined-art treasury-art" style="--refined-metal:url(#treasury-metal)" viewBox="0 0 320 260" aria-hidden="true">
    <defs><radialGradient id="treasury-glow"><stop stop-color="var(--refined-primary)" stop-opacity=".28"/><stop offset="1" stop-color="var(--refined-primary)" stop-opacity="0"/></radialGradient><linearGradient id="treasury-metal" x2="1" y2=".3"><stop stop-color="var(--refined-shadow)"/><stop offset=".46" stop-color="var(--refined-primary)"/><stop offset=".52" stop-color="var(--refined-highlight)"/><stop offset="1" stop-color="var(--refined-primary)"/></linearGradient></defs>
    <ellipse cx="160" cy="113" rx="148" ry="109" fill="url(#treasury-glow)"/>
    <g class="treasury-arch"><path d="M17 148C10-24 310-24 303 148M27 138C35-1 285-1 293 138"/><path class="engraving" d="M31 91 41 95M55 48 64 56M96 20 100 31M143 9V21M177 9V21M224 20 220 31M265 48 256 56M289 91 279 95"/></g>
    ${slots.map(([x, y, angle], index) => `<g transform="translate(${x} ${y}) rotate(${angle})"><g class="treasury-gate"><ellipse rx="22" ry="14"/><ellipse class="gate-inner" rx="17" ry="10"/><path class="engraving" d="M-26 0H-21M21 0H26M0-18V-13M0 13V18"/>${alternate ? '<path class="gem" d="M-14-11-10-15-6-11-10-7ZM6 11 10 7 14 11 10 15Z"/>' : '<path class="engraving" d="M-17-9-13-11M13 11 17 9"/>'}</g><g class="treasury-weapon" style="--weapon-drift:${index % 2 ? -7 : 7}px">${blades[index % blades.length]}</g></g>`).join('')}
    <path class="treasury-ground engraving" d="M62 197Q160 218 258 197M88 203 95 208M225 208 232 203M148 213H172"/>
  </svg>`;
}

function dragon(alternate: boolean) {
  return `<svg class="entrance-refined-art dragon-art" style="--refined-metal:url(#dragon-armour)" viewBox="0 0 320 260" aria-hidden="true">
    <defs><linearGradient id="dragon-armour" x1="0" y1="0" x2=".8" y2="1"><stop stop-color="var(--refined-primary)"/><stop offset=".3" stop-color="var(--refined-primary)"/><stop offset=".48" stop-color="var(--refined-shadow)"/><stop offset=".56" stop-color="var(--refined-primary)"/><stop offset="1" stop-color="var(--refined-shadow)"/></linearGradient><radialGradient id="dragon-halo"><stop stop-color="var(--refined-highlight)" stop-opacity=".2"/><stop offset="1" stop-color="var(--refined-highlight)" stop-opacity="0"/></radialGradient></defs>
    <ellipse cx="164" cy="113" rx="152" ry="112" fill="url(#dragon-halo)"/>
    <g class="dragon-wing-left"><g class="dragon-wing-motion" style="transform-origin:180px 126px">
      <path class="dragon-membrane" d="M182 130Q151 59 39 19Q16 54 14 149Q43 119 74 151Q80 112 119 136Q127 102 159 142Z"/>
      <path class="dragon-wing-bones" d="M182 130Q140 63 39 19Q16 55 14 149M39 19Q62 57 74 151M39 19Q94 64 119 136M39 19Q127 64 159 142M39 19 35 5 48 27"/>
      <path class="dragon-wing-sheen" d="M32 33Q18 79 22 132M45 33Q62 79 70 130M51 34Q92 79 111 122M61 38Q124 82 150 130M19 146 13 158M74 149 70 160M119 134 117 143"/>
    </g></g>
    <g class="dragon-wing-right"><g class="dragon-wing-motion" style="transform-origin:224px 126px">
      <path class="dragon-membrane" d="M211 134Q235 55 295 22Q314 76 309 162Q286 133 272 165Q259 127 238 151Z"/>
      <path class="dragon-wing-bones" d="M211 134 295 22Q316 78 309 162M295 22 272 165M295 22Q259 78 238 151M295 22 299 8 299 34"/>
      <path class="dragon-wing-sheen" d="M299 40Q309 94 306 149M289 42 274 148M285 43Q252 99 244 137M309 160 315 169M272 164 274 173"/>
    </g></g>
    <g class="dragon-body">
      <path class="metal" d="M227 174C265 169 286 184 283 206Q275 237 237 225Q265 224 270 209Q268 196 242 201L213 188Z"/>
      <path class="dragon-scales" d="m241 180 6 12 8-13m7 4-1 12 10-5m4 9-9 6 7 8m-13 8-4-7-10 9"/>
      <path class="metal" d="M184 133Q210 123 233 141Q251 158 234 182Q218 200 190 182L168 157Z"/>
      <path class="dragon-plating" d="M183 141Q211 136 232 148M180 152Q209 145 237 159M185 165Q211 158 232 171M194 177 219 182 232 173"/>
      <path class="metal" d="M176 75Q193 60 207 76Q229 97 226 121Q222 145 201 157L177 140Q207 122 201 106Q195 92 169 86Z"/>
      <path class="dragon-neck-plates" d="M182 83Q196 78 208 87M191 91Q205 88 215 96M198 101Q212 99 219 106M202 112Q214 110 221 116M199 122Q213 121 218 127M192 132Q204 131 212 138M183 141Q196 142 201 149"/>
      <path class="dragon-neck-ridge" d="m207 78 13-4-6 17 16-3-9 15 14 2-11 12 12 7-16 8 9 10-18 3"/>
      <path class="metal" d="M82 87Q93 61 118 48Q153 29 198 27L217 13Q216 35 196 48L212 43 226 39 215 57 194 67 217 63 231 68 204 79 181 83 155 78 135 85 105 89 89 98Z"/>
      <path class="dragon-head-sheen" d="M90 83Q109 57 142 47L199 31M111 72Q130 53 158 53L195 46M160 59 187 65 208 52M174 72 199 74 216 69M91 87 103 83"/>
      <path class="dragon-brow" d="M119 65Q132 52 148 58L140 73 123 73Z"/>
      <ellipse class="dragon-eyes" cx="133" cy="64" rx="6" ry="7" transform="rotate(24 133 64)"/>
      <path class="dragon-eye-slit" d="M133 59 134 69M129 63 131 61"/>
      <path class="dragon-jaw" d="M104 91 131 82 158 83 148 110 127 130 113 113 93 99Z"/>
      <path class="metal" d="M110 110 122 115 148 94 159 87 153 111 127 138Z"/>
      <path class="dragon-teeth" d="m104 92 4 10 5-13 5 8 5-12 5 8 5-11 5 8 5-9 5 6-2-7M124 121l4-9 4 5 5-11 4 5 5-11"/>
      <path class="dragon-nostril" d="m92 84 5-5 5 1-3 5Z"/>
      <path class="metal" d="M192 142 172 130Q157 123 144 134L127 144 124 156 138 153 154 143 171 158Z"/>
      <path class="dragon-plating" d="M170 136 167 148M157 133 155 143M145 139 143 150"/>
      <path class="dragon-claws metal" d="M129 143Q112 143 105 159L120 151Q112 163 119 171L129 154Q127 170 134 174L139 152Z"/>
      <path class="metal" d="M229 150 249 164 261 186 248 190 236 173 219 171Z"/>
      <path class="dragon-claws metal" d="M250 183 271 184 280 194 266 191 272 202 258 195 258 207 249 193Z"/>
      <path class="metal" d="M206 176Q178 172 170 190L167 208 186 219 207 209 219 187Z"/>
      <path class="dragon-plating" d="M182 185 196 190 206 184M176 195 187 201 201 198M175 207 184 213 201 207"/>
      <path class="dragon-claws metal" d="M176 211Q153 211 143 227L160 222 157 234 172 226 175 237 187 224 199 220Z"/>
      ${alternate ? '<path class="dragon-runes" d="m190 153-4-6-4 6 4 6Zm19 12-4-6-4 6 4 6ZM181 193l-4 6 4 6 4-6Z"/>' : '<path class="dragon-scales" d="m183 148 3 5-5 3m24 4 5 6-6 4M177 191l3 5-5 4"/>'}
    </g>
    <g class="dragon-breath"><path d="M106 102Q64 109 24 137"/><path class="breath-core" d="m91 106-20-5-10 13-16-1-18 19M76 116 64 126 48 125 28 142"/><circle cx="26" cy="138" r="7" fill="var(--refined-highlight)" fill-opacity=".3" stroke="none"/></g>
    <path class="dragon-ground" d="M65 226Q166 249 270 222M97 235Q166 246 236 231"/>
  </svg>`;
}

function storm(alternate: boolean) {
  const bolts = [
    'M154-14 170 17 151 41 169 65 148 87 163 110 151 135 163 158 158 183',
    'M59 3 85 30 68 55 95 78 88 105 113 131 102 154 127 179',
    'M275 12 244 38 253 62 226 84 237 109 210 130 219 154 193 182',
  ];
  const forks =
    'M153 42 123 40 106 23M166 65 196 63 208 43M150 89 119 105 105 95M160 111 186 114 202 99M83 31 55 43 32 25M94 79 63 89 45 75M112 131 74 139 61 125M246 39 273 55 291 41M228 85 263 97 281 81M211 131 252 144 272 127';
  return `<svg class="entrance-refined-art storm-art" viewBox="0 0 320 260" aria-hidden="true">
    <defs><radialGradient id="storm-impact"><stop stop-color="var(--refined-highlight)" stop-opacity=".32"/><stop offset=".4" stop-color="var(--refined-primary)" stop-opacity=".12"/><stop offset="1" stop-color="var(--refined-primary)" stop-opacity="0"/></radialGradient></defs>
    <ellipse class="storm-impact" cx="160" cy="184" rx="121" ry="43" fill="url(#storm-impact)"/>
    <g class="storm-channels">${bolts.map((d, i) => `<g class="storm-channel storm-channel-${i}"><path class="storm-corona" d="${d}"/><path class="storm-core" pathLength="100" d="${d}"/></g>`).join('')}<path class="storm-forks" d="${forks}"/></g>
    <g class="storm-ground"><path d="m158 182-29 10-13-6-21 17-25-1-17 12m105-31 28 12 16-8 21 20 26-4 20 11m-111-27 5 27-11 11m-26-30-23-12-16 4-19-11m92 17 25-16 17 4 18-10"/><path class="storm-ground-core" d="M75 183Q110 215 145 210M177 210Q210 216 250 185"/></g>
    ${alternate ? '<g class="storm-runes"><path d="m50 103 5-9 5 9-5 9Zm207 3 5-9 5 9-5 9ZM139 24l5-9 5 9-5 9Z"/><path class="storm-ribbon" d="M57 91Q33 147 92 163M262 90Q291 144 231 167"/></g>' : '<path class="storm-sparks" d="m54 99-8 11m12-2 2 13m199-16 9 9m-12 0-3 13m-132 78-8 9m104-5 8 9"/>'}
  </svg>`;
}

/** Repository-owned vector artwork. The existing apparition owner handles time and cleanup. */
export function refinedStitchArtwork(id: string, variantId?: string) {
  if (!IDS.has(id)) return null;
  const alternate = Boolean(variantId);
  const definition = variantId
    ? palettes.variants.find((effect) => effect.id === variantId)
    : originals.find((effect) => effect.id === id);
  if (variantId && (!definition || !('variantOf' in definition) || definition.variantOf !== id))
    return null;
  const colors = definition && 'detailColors' in definition ? definition.detailColors : undefined;
  if (!colors || colors.length !== 3) return null;
  return {
    colors,
    html:
      id === 'stitch-gilgamesh'
        ? treasury(alternate)
        : id === 'stitch-hyorinmaru'
          ? iceWings(alternate)
          : id === 'stitch-blue-eyes'
            ? dragon(alternate)
            : storm(alternate),
  };
}
