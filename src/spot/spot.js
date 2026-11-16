// Spot illustrations: small flat pictures of interface ideas (a window, a
// clipboard, a card) that answer the pointer. The picture is drawn flat, but its
// parts are sheets standing in space, so on hover the whole thing leans, the
// parts lift off each other, and a short piece of motion plays, once or in a loop.

import { Scene } from '../scene.js';
import { Node, ShapeMesh } from '../render/node.js';
import { ease } from '../motion.js';
import { recipes } from './recipes.js';

const REST = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, scale: 1, opacity: 1 };
const PROPS = Object.keys(REST);
const clamp1 = (v) => (v < -1 ? -1 : v > 1 ? 1 : v);
// Flat through the middle of the trigger, steepening toward its edges.
const swell = (v) => Math.sign(v) * Math.pow(Math.abs(v), 1.5);

/** Keyframes with every property filled in, starting from rest at t = 0. A property keeps its value until a later keyframe changes it. */
function track(spec) {
  if (!spec) return null;
  let keys = spec;
  if (!Array.isArray(spec)) {
    const { from = 0, to = 1, ...values } = spec;
    keys = from > 0 ? [{ t: from }, { t: to, ...values }] : [{ t: to, ...values }];
  }
  const out = [{ t: 0, ...REST }];
  for (const k of keys) out.push({ ...out[out.length - 1], ease: null, ...k });
  if (out[out.length - 1].t < 1) out.push({ ...out[out.length - 1], ease: null, t: 1 });
  return out;
}

function sample(tr, p, out) {
  let i = 1;
  while (i < tr.length - 1 && p > tr[i].t) i++;
  const a = tr[i - 1], b = tr[i], span = b.t - a.t;
  const k = span > 0 ? (b.ease || ease.inOut)(Math.max(0, Math.min(1, (p - a.t) / span))) : 1;
  for (const key of PROPS) out[key] = a[key] + (b[key] - a[key]) * k;
  return out;
}

/** The box around a part's outlines (and its children's), in artboard coordinates. */
function extent(part, box = [Infinity, Infinity, -Infinity, -Infinity]) {
  if (part.group) for (const child of part.group) extent(child, box);
  else {
    for (const c of [].concat(part.shape)) {
      for (const p of c.sample(c.degree === 1 ? c.count : 33)) {
        if (p[0] < box[0]) box[0] = p[0]; if (p[0] > box[2]) box[2] = p[0];
        if (p[1] < box[1]) box[1] = p[1]; if (p[1] > box[3]) box[3] = p[1];
      }
    }
  }
  return box;
}

/**
 * A spot illustration.
 *
 *   new Spot('#card-art', 'paste', { hover: 'loop' });
 *
 * `recipe` is the name of a ready-made one (see `spots`) or your own
 * `{ size, parts }`. `hover` is 'loop' (the motion repeats while the pointer is
 * over it), 'once' (it plays through and holds) or false.
 */
export class Spot {
  constructor(target, recipe = 'assist', options = {}) {
    if (typeof recipe === 'string') {
      if (!recipes[recipe]) throw new Error(`Spot: unknown illustration "${recipe}". Ready-made ones: ${Object.keys(recipes).join(', ')}.`);
      recipe = recipes[recipe]();
    } else if (typeof recipe === 'function') recipe = recipe();
    if (!recipe || !Array.isArray(recipe.parts)) throw new Error('Spot: a recipe is { size: [width, height], parts: [...] }');
    const { hover = 'loop', trigger, lean, follow = 0.32, duration, hold, stroke, ...sceneOptions } = options;
    const [W, H] = (this.size = recipe.size || [240, 200]);
    /** 'loop', 'once' or false. Change it at any time. */
    this.hover = hover;
    /**
     * How far the picture leans under the pointer, radians at the edge of the trigger.
     * It stays square-on while the pointer is in the middle and leans more the nearer
     * the pointer is to an edge, most of all in a corner.
     */
    this.follow = follow;
    /** The lean when there is no pointer to follow (keyboard focus, touch, play()): [top edge away, right edge away], radians. */
    this.lean = lean || recipe.lean || [0.09, -0.21];
    this.duration = (duration ?? recipe.duration ?? 1500) / 1000;
    this.hold = (hold ?? recipe.hold ?? 450) / 1000;
    this._stroke = stroke ?? recipe.stroke ?? 2.6;

    this.scene = new Scene(target, {
      width: W, height: H,
      frame: [W, H, Math.min(W, H) * 0.4],
      reference: Math.min(W, H),
      padding: 0.03,
      pauseButton: false, // it moves only while someone points at it
      camera: { azimuth: 0, elevation: 0, fov: 32 },
      ...sceneOptions,
    });
    this.root = this.scene.group();
    this._layers = 0;
    this._tree = recipe.parts.map((part) => this._build(part, this.root, [W / 2, H / 2]));
    /** The nodes, in drawing order, for scripts that want to restyle or move one. */
    this.parts = [];
    const list = (e) => { this.parts.push(e.node); e.children.forEach(list); };
    this._tree.forEach(list);
    // Motion that ends where it began repeats by starting over; anything else plays back and forth.
    const tracks = [];
    const gather = (e) => { if (e.track) tracks.push(e.track); e.children.forEach(gather); };
    this._tree.forEach(gather);
    this.cycle = recipe.cycle ?? tracks.every((tr) => PROPS.every((k) => Math.abs(tr[tr.length - 1][k] - REST[k]) < 1e-9));

    this._w = 0; this._p = 0; this._dir = 1; this._wait = 0;
    this._lx = 0; this._ly = 0; this._tx = 0; this._ty = 0;
    this._over = false; this._focus = false; this._forced = null; this._pointer = false;
    this._stop = null;
    this._v = { ...REST };
    this._off = [];
    if (this.scene.svg) this._listen(trigger);
  }

  _build(part, parent, origin) {
    const box = extent(part);
    const pivot = part.pivot || [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2];
    let node;
    if (part.group) node = new Node();
    else {
      // Into the node's own space: measured from the pivot, with y up.
      const m = new Float64Array([1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1, 0, -pivot[0], pivot[1], 0, 1]);
      const curves = [].concat(part.shape).map((c) => c.transform(m));
      const open = curves.every((c) => !c.closed);
      node = new ShapeMesh(curves, {
        fill: part.fill ?? (open ? false : 'paper'),
        stroke: part.stroke ?? 'ink',
        width: part.width ?? this._stroke,
        dash: part.dash, opacity: part.opacity ?? 1,
      });
      node.layer = this._layers++;
    }
    const home = [pivot[0] - origin[0], origin[1] - pivot[1], 0];
    node.position = home;
    parent.add(node);
    const entry = { node, home, lift: part.lift || 0, track: track(part.hover), children: [] };
    if (part.group) entry.children = part.group.map((child) => this._build(child, node, pivot));
    return entry;
  }

  _listen(trigger) {
    const host = this.scene.host;
    const el = (this.trigger = typeof trigger === 'string' ? host.closest(trigger) || document.querySelector(trigger) || host : trigger || host);
    const on = (type, fn) => { el.addEventListener(type, fn); this._off.push(() => el.removeEventListener(type, fn)); };
    let rect = null;
    const point = (e) => {
      if (!rect || e.pointerType === 'touch') return;
      this._pointer = true;
      this._tx = clamp1(((e.clientX - rect.left) / rect.width - 0.5) * 2);
      this._ty = clamp1(((e.clientY - rect.top) / rect.height - 0.5) * 2);
    };
    on('pointerenter', (e) => { rect = el.getBoundingClientRect(); point(e); this._over = true; this._sync(); });
    on('pointermove', point);
    const left = () => { this._over = this._pointer = false; this._tx = this._ty = 0; this._sync(); };
    on('pointerleave', left);
    on('pointercancel', left);
    // Keyboard focus counts as pointing at it, so the motion is not for mouse users only.
    on('focusin', (e) => {
      let keyboard = true;
      try { keyboard = e.target.matches(':focus-visible'); } catch { /* older browsers: treat any focus as keyboard focus */ }
      if (keyboard) { this._focus = true; this._sync(); }
    });
    on('focusout', () => { this._focus = false; this._sync(); });
  }

  /** True while the motion is being asked for: hovered, focused, or played from script. */
  get active() {
    return !!this._forced || (!!this.hover && (this._over || this._focus));
  }

  get _mode() {
    return this._forced || this.hover || 'loop';
  }

  _sync() {
    if (this.active && !this._stop && this.scene.svg && !this.scene.reducedMotion) {
      this._dir = 1;
      this._stop = this.scene.loop((state) => this._tick(state.dt));
    }
  }

  _tick(dt) {
    const on = this.active, to = on ? 1 : 0;
    this._w += (to - this._w) * (1 - Math.exp(-dt * (on ? 9 : 7)));
    const k = 1 - Math.exp(-dt * 7);
    const aim = on ? this._aim() : [0, 0];
    this._lx += (aim[0] - this._lx) * k;
    this._ly += (aim[1] - this._ly) * k;
    if (on) this._advance(dt);
    else if (this._w < 0.002 && Math.abs(this._lx) + Math.abs(this._ly) < 0.002) {
      // Back at rest: forget where the motion had got to, and stop asking for frames.
      this._w = this._p = this._lx = this._ly = this._wait = 0;
      this._dir = 1;
      this._stop?.();
      this._stop = null;
    }
    // Holding a pose (the end of a play-once, the pause between loops) costs nothing: no change, no redraw.
    const now = `${this._w.toFixed(4)} ${this._p.toFixed(4)} ${this._lx.toFixed(4)} ${this._ly.toFixed(4)}`;
    if (now !== this._drawn) { this._drawn = now; this._apply(); }
  }

  /** Where the lean is heading: after the pointer when there is one, else the picture's own lean. */
  _aim() {
    if (!this._pointer || !this.follow) return this._pointer ? [0, 0] : this.lean;
    const x = this._tx, y = this._ty, corner = 1 + 0.2 * Math.abs(x * y);
    return [-0.8 * this.follow * swell(y) * corner, this.follow * swell(x) * corner];
  }

  _advance(dt) {
    if (this._wait > 0) { this._wait -= dt; return; }
    this._p += (this._dir * dt) / this.duration;
    const loop = this._mode === 'loop';
    if (this._p >= 1) {
      this._p = 1;
      if (!loop) return;
      this._wait = this.hold;
      if (this.cycle) this._p = 0; else this._dir = -1;
    } else if (this._p <= 0) {
      this._p = 0; this._dir = 1; this._wait = this.hold;
    }
  }

  _apply() {
    this.root.rotation.set(-this._lx, this._ly, 0);
    for (const e of this._tree) this._place(e, 1);
  }

  _place(e, inherited) {
    const w = this._w, v = e.track ? sample(e.track, this._p, this._v) : REST, n = e.node, h = e.home;
    if (e.track || e.lift) {
      n.position.set(h[0] + w * v.x, h[1] - w * v.y, h[2] + w * (e.lift + v.z));
      n.rotation.set(-w * v.rx, w * v.ry, -w * v.rz);
      n.scale.set(1 + w * (v.scale - 1));
    }
    const opacity = inherited * (1 + w * (v.opacity - 1));
    if (n.kind) n.opacity = opacity;
    for (const child of e.children) this._place(child, opacity);
  }

  /**
   * Play the motion from script, as if hovered: 'loop' or 'once'. It keeps
   * going until `stop()`. Under reduced motion nothing moves.
   */
  play(mode = this.hover || 'loop') {
    this._forced = mode;
    this._sync();
    return this;
  }

  /** Let go: the picture eases back to rest unless it is still hovered. */
  stop() {
    this._forced = null;
    return this;
  }

  /**
   * Hold one moment of the motion, without animating: `progress` through the
   * motion (0 to 1) and `weight` of the hover pose (0 at rest, 1 fully hovered).
   * For still frames and server-rendered markup.
   */
  pose(progress = 1, weight = 1) {
    this._stop?.();
    this._stop = null;
    this._p = Math.max(0, Math.min(1, progress));
    this._w = Math.max(0, Math.min(1, weight));
    this._lx = this.lean[0] * this._w;
    this._ly = this.lean[1] * this._w;
    this._drawn = null;
    this._apply();
    return this;
  }

  /** The picture as SVG markup, as it stands now. */
  toSVG(size) {
    return this.scene.toSVG(size);
  }

  destroy() {
    for (const off of this._off) off();
    this._off.length = 0;
    this._stop?.();
    this._stop = null;
    this.scene.destroy();
  }
}
