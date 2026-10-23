import type { EntranceEffectId } from '../../services/entrance-effects';
import {
  acquireEffectContext,
  motionAllowed,
  watchMotionCancellation,
} from '../../services/motion-lifetime';
const activeEntrances = new Set<() => void>();
const MAX_ENTRANCES = 6;
import '../../styles/entrance-effects.scss';
import { stitchEntrances, playStitchEntrance } from '../../services/stitch-entrances';

// Entrance effects played around a character's anchor element inside `layer`.
// Each returns a cancel function and removes everything it added when done.
// Callers decide whether motion is allowed.
type Effect = (scene: Scene) => () => void;
interface Scene {
  anchor: HTMLElement;
  layer: HTMLElement;
  img: HTMLImageElement | null;
  /** Image centre and feet, in layer coordinates. */
  cx: number;
  cy: number;
  feet: number;
  width: number;
  height: number;
}
const DURATION: Record<EntranceEffectId, number> = {
  classic: 900,
  smoke: 1000,
  sparks: 1200,
  ink: 1100,
  runes: 1300,
  rift: 1200,
  particles: 1500,
  ...Object.fromEntries(stitchEntrances.map((effect) => [effect.id, effect.duration])),
};

function element(scene: Scene, className: string, left: number, top: number) {
  const node = document.createElement('div');
  node.className = 'lobby-fx ' + className;
  node.style.left = left + 'px';
  node.style.top = top + 'px';
  node.setAttribute('aria-hidden', 'true');
  scene.layer.append(node);
  return node;
}
function canvas(scene: Scene, size: number) {
  const scale = Math.min(2, window.devicePixelRatio || 1),
    node = document.createElement('canvas');
  node.className = 'lobby-fx lobby-fx-canvas';
  node.width = node.height = Math.round(size * scale);
  node.style.width = node.style.height = size + 'px';
  node.style.left = scene.cx - size / 2 + 'px';
  node.style.top = scene.cy - size / 2 + 'px';
  node.setAttribute('aria-hidden', 'true');
  scene.layer.append(node);
  return { node, scale };
}
/** Runs `draw(t)` with t in [0, 1] over `duration`, then `done()`. */
function animate(duration: number, draw: (t: number) => void, done: () => void) {
  const start = performance.now();
  let frame = 0;
  const tick = (now: number) => {
    const t = Math.min(1, (now - start) / duration);
    draw(t);
    if (t < 1) frame = requestAnimationFrame(tick);
    else done();
  };
  frame = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frame);
}
const ease = (t: number) => 1 - Math.pow(1 - t, 3);

// Classic: WebGL smoke vortex collapsing into a bright crack ring.
const vertex = `attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}`;
const fragment = `precision mediump float;
uniform float t;uniform vec2 res;
void main(){
  vec2 uv=(gl_FragCoord.xy/res)*2.-1.;
  float r=length(uv),a=atan(uv.y,uv.x);
  float s=clamp(t/.6,0.,1.);
  float radius=mix(.95,.06,s*s);
  float twist=a+(1.-r)*9.*(1.+s*2.)+t*14.;
  float arms=.5+.5*sin(twist*3.);
  float band=smoothstep(radius+.28,radius,r)*smoothstep(0.,.18,r+.04);
  float smoke=arms*band*(1.-smoothstep(.55,.66,t));
  float f=clamp((t-.55)/.45,0.,1.);
  float ring=exp(-pow((r-f*.9)*14.,2.))*(1.-f)*step(.55,t);
  float core=max(0.,exp(-r*r*40.)*(1.-abs(t-.58)*6.));
  vec3 mist=mix(vec3(.10,.08,.16),vec3(.46,.38,.64),arms);
  float flash=ring+core;
  float alpha=clamp(smoke*.85+flash,0.,1.);
  gl_FragColor=vec4(mist*smoke*.85+vec3(1.,.93,.75)*flash,alpha);
}`;
function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
  gl.deleteShader(shader);
  return null;
}
function webgl(node: HTMLCanvasElement) {
  const releaseBudget = acquireEffectContext(node);
  if (!releaseBudget) return null;
  const gl = node.getContext('webgl', { premultipliedAlpha: true, alpha: true });
  if (!gl) {
    releaseBudget();
    return null;
  }
  const vs = compile(gl, gl.VERTEX_SHADER, vertex),
    fs = compile(gl, gl.FRAGMENT_SHADER, fragment),
    program = gl.createProgram();
  const buffer = gl.createBuffer();
  const release = () => {
    if (vs) gl.deleteShader(vs);
    if (fs) gl.deleteShader(fs);
    if (program) gl.deleteProgram(program);
    if (buffer) gl.deleteBuffer(buffer);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    releaseBudget();
  };
  if (!vs || !fs || !program || !buffer) {
    release();
    return null;
  }
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    release();
    return null;
  }
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'p');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  gl.uniform2f(gl.getUniformLocation(program, 'res'), node.width, node.height);
  const time = gl.getUniformLocation(program, 't');
  gl.viewport(0, 0, node.width, node.height);
  gl.clearColor(0, 0, 0, 0);
  return {
    draw(t: number) {
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(time, t);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
    release,
  };
}
const classic: Effect = (scene) => {
  const { node } = canvas(scene, 200),
    renderer = webgl(node);
  if (!renderer) node.classList.add('is-fallback');
  const stop = animate(DURATION.classic, (t) => renderer?.draw(t), finish);
  function finish() {
    stop();
    renderer?.release();
    node.remove();
  }
  return finish;
};

// A: dark purple vortex twisting shut, then a crack ring.
const smoke: Effect = (scene) => {
  const vortex = element(scene, 'lobby-fx-smoke', scene.cx, scene.cy),
    ring = element(scene, 'lobby-fx-ring', scene.cx, scene.cy),
    timer = setTimeout(finish, DURATION.smoke);
  function finish() {
    clearTimeout(timer);
    vortex.remove();
    ring.remove();
  }
  return finish;
};

// B: golden sparks spiral into an orb that flares.
const sparks: Effect = (scene) => {
  const size = 260,
    { node, scale } = canvas(scene, size),
    context = node.getContext('2d')!,
    sparksList = Array.from({ length: 70 }, () => ({
      angle: Math.random() * Math.PI * 2,
      radius: 90 + Math.random() * 40,
      delay: Math.random() * 0.25,
      spin: 2 + Math.random() * 2,
    }));
  context.scale(scale, scale);
  const stop = animate(
    DURATION.sparks,
    (t) => {
      context.clearRect(0, 0, size, size);
      const c = size / 2;
      for (const spark of sparksList) {
        const p = Math.min(1, Math.max(0, (t - spark.delay) / 0.5));
        if (p <= 0 || t > 0.62) continue;
        const r = spark.radius * (1 - ease(p)),
          a = spark.angle + p * spark.spin;
        context.fillStyle = `rgba(255, ${200 + Math.round(40 * p)}, 90, ${0.4 + 0.6 * p})`;
        context.beginPath();
        context.arc(c + Math.cos(a) * r, c + Math.sin(a) * r, 1.5 + p * 1.5, 0, Math.PI * 2);
        context.fill();
      }
      const orb = t < 0.5 ? t / 0.5 : 1,
        flare = t > 0.5 ? (t - 0.5) / 0.5 : 0,
        radius = 8 + orb * 14 + flare * 70,
        alpha = t < 0.5 ? orb * 0.9 : 0.9 * (1 - flare);
      const glow = context.createRadialGradient(c, c, 0, c, c, radius);
      glow.addColorStop(0, `rgba(255, 250, 220, ${alpha})`);
      glow.addColorStop(0.4, `rgba(255, 210, 90, ${alpha * 0.8})`);
      glow.addColorStop(1, 'rgba(255, 190, 60, 0)');
      context.fillStyle = glow;
      context.fillRect(0, 0, size, size);
    },
    finish,
  );
  function finish() {
    stop();
    node.remove();
  }
  return finish;
};

// C: ink splash on the floor; the character rises as a silhouette and colours in.
const ink: Effect = (scene) => {
  const blot = element(scene, 'lobby-fx-ink', scene.cx, scene.feet),
    timer = setTimeout(finish, DURATION.ink);
  function finish() {
    clearTimeout(timer);
    blot.remove();
  }
  return finish;
};

// D: a rune circle draws itself on the floor and raises a light column.
const runes: Effect = (scene) => {
  const circle = element(scene, 'lobby-fx-runes', scene.cx, scene.feet),
    column = element(scene, 'lobby-fx-column', scene.cx, scene.feet);
  circle.innerHTML =
    '<svg viewBox="-60 -60 120 120"><circle r="54" class="outer"/><circle r="40" class="inner"/>' +
    '<path d="M0-40L35 20H-35Z M0 40L-35-20H35Z" class="star"/></svg>';
  const timer = setTimeout(finish, DURATION.runes);
  function finish() {
    clearTimeout(timer);
    circle.remove();
    column.remove();
  }
  return finish;
};

// E: a glowing vertical rift opens, the character steps out, the rift zips shut.
const rift: Effect = (scene) => {
  const tear = element(scene, 'lobby-fx-rift', scene.cx, scene.cy),
    dust = element(scene, 'lobby-fx-dust', scene.cx, scene.feet),
    timer = setTimeout(finish, DURATION.rift);
  function finish() {
    clearTimeout(timer);
    tear.remove();
    dust.remove();
  }
  return finish;
};

// F: particles sampled from the character image fly in and assemble it, feet first.
const particles: Effect = (scene) => {
  const img = scene.img;
  if (!img?.complete || !img.naturalWidth || !scene.width || !scene.height) return sparks(scene);
  const width = Math.round(scene.width),
    height = Math.round(scene.height),
    source = document.createElement('canvas');
  source.width = width;
  source.height = height;
  const sourceContext = source.getContext('2d', { willReadFrequently: true });
  let pixels: Uint8ClampedArray;
  try {
    sourceContext!.drawImage(img, 0, 0, width, height);
    pixels = sourceContext!.getImageData(0, 0, width, height).data;
  } catch {
    return sparks(scene);
  }
  const step = Math.max(2, Math.round(Math.sqrt((width * height) / 900))),
    dots: { x: number; y: number; fromX: number; fromY: number; delay: number; color: string }[] =
      [];
  for (let y = 0; y < height; y += step)
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4;
      if (pixels[i + 3] < 128) continue;
      const angle = Math.random() * Math.PI * 2,
        distance = 90 + Math.random() * 90;
      dots.push({
        x,
        y,
        fromX: x + Math.cos(angle) * distance,
        fromY: y + Math.sin(angle) * distance,
        // Feet first: lower rows land earlier.
        delay: (1 - y / height) * 0.35 + Math.random() * 0.1,
        color: `rgb(${pixels[i]}, ${pixels[i + 1]}, ${pixels[i + 2]})`,
      });
    }
  const size = Math.max(width, height) + 220,
    { node, scale } = canvas(scene, size),
    context = node.getContext('2d')!,
    offsetX = (size - width) / 2,
    offsetY = (size - height) / 2;
  context.scale(scale, scale);
  const stop = animate(
    DURATION.particles,
    (t) => {
      context.clearRect(0, 0, size, size);
      context.globalAlpha = t > 0.85 ? 1 - (t - 0.85) / 0.15 : 1;
      for (const dot of dots) {
        const p = ease(Math.min(1, Math.max(0, (t - dot.delay) / 0.45)));
        context.fillStyle = dot.color;
        context.fillRect(
          offsetX + dot.fromX + (dot.x - dot.fromX) * p,
          offsetY + dot.fromY + (dot.y - dot.fromY) * p,
          step,
          step,
        );
      }
    },
    finish,
  );
  function finish() {
    stop();
    node.remove();
  }
  return finish;
};

const effects: Record<EntranceEffectId, Effect> = {
  ...Object.fromEntries(
    stitchEntrances.map((effect) => [
      effect.id,
      (scene: Scene) => playStitchEntrance(effect.id, scene.layer, scene.cx, scene.feet),
    ]),
  ),
  classic,
  smoke,
  sparks,
  ink,
  runes,
  rift,
  particles,
};

/** Plays `kind` around `anchor` inside `layer`; returns a cancel function. */
export function apparate(
  anchor: HTMLElement,
  layer: HTMLElement,
  kind: EntranceEffectId = 'classic',
): () => void {
  if (!motionAllowed() || activeEntrances.size >= MAX_ENTRANCES) return () => {};
  const img = anchor.querySelector('img'),
    origin = layer.getBoundingClientRect(),
    box = (img || anchor).getBoundingClientRect(),
    scene: Scene = {
      anchor,
      layer,
      img,
      cx: box.left - origin.left + box.width / 2,
      cy: box.top - origin.top + box.height / 2,
      feet: box.bottom - origin.top,
      width: box.width,
      height: box.height,
    };
  anchor.dataset.entrance = kind;
  anchor.classList.add('is-apparating');
  const cancel = (effects[kind] || classic)(scene);
  let done = false,
    releaseMotion = () => {};
  const timer = setTimeout(finish, DURATION[kind] || DURATION.classic);
  activeEntrances.add(finish);
  releaseMotion = watchMotionCancellation(finish);
  function finish() {
    if (done) return;
    done = true;
    clearTimeout(timer);
    activeEntrances.delete(finish);
    releaseMotion();
    cancel();
    anchor.classList.remove('is-apparating');
    delete anchor.dataset.entrance;
  }
  return finish;
}
export const entranceDuration = (kind: EntranceEffectId) => DURATION[kind] || DURATION.classic;
