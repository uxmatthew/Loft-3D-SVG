import { Node, SurfaceMesh, CurveMesh, PointsMesh } from './render/node.js';
import { Camera } from './render/camera.js';
import { Painter, drawSurface, drawCurve, drawPoints, drawShape } from './render/draw.js';
import { SurfaceGrid, alignPerSpan } from './render/grid.js';
import { compileSurface, compileCurve, compilePoints, compileShape, resolveMaterial } from './render/material.js';
import { NurbsCurve } from './nurbs/curve.js';
import { NurbsSurface } from './nurbs/surface.js';
import { normalize, transformDirection, transformPoint, clamp } from './math.js';
import { parseColor, toHex, mixColors } from './render/color.js';
import { ease, wake, sleep, injectStyles, createPauseButton, Orbit } from './motion.js';

const NS = 'http://www.w3.org/2000/svg';
const HAS_DOM = typeof document !== 'undefined';
let uid = 0;

const DEFAULTS = {
  width: 640,
  height: 480,
  fit: true,
  frame: null,
  padding: 0.08,
  offset: [0, 0],
  detail: 1,
  reference: 480,
  shadow: false,
  label: '',
  background: null,
  palette: {},
  motion: 'auto',
  pauseButton: 'auto',
  poster: 0,
};

function interp(a, b, t) {
  if (typeof b === 'number') return a + (b - a) * t;
  if (Array.isArray(b)) return b.map((v, i) => interp(a[i], v, t));
  if (b && typeof b === 'object') {
    const out = { ...a };
    for (const k in b) out[k] = interp(a[k], b[k], t);
    return out;
  }
  return t < 1 ? a : b;
}

/**
 * Samples per knot span for one direction of a surface. Curved directions are
 * diced so the polygon stays within `tol` pixels of the true curve (which needs
 * √(turning · length / 8·tol) segments); flat ones just avoid very long facets.
 */
function perSpan(lengthPx, turning, spans, tol, iso) {
  // Never let one facet turn more than 30°, however small the shape is drawn: shading and creases rely on it.
  const segs = Math.max(Math.sqrt((turning * lengthPx) / (8 * tol)), lengthPx / (110 * tol), turning / 0.5236, 1);
  const per = clamp(Math.ceil(segs / spans), 1, Math.max(1, Math.ceil(144 / spans)));
  return alignPerSpan(per, spans, iso);
}

/**
 * A 3D scene that draws itself as SVG.
 *
 *   const scene = new Scene('#stage', { label: 'A turning vase' });
 *   scene.add(vase(), 'clay');
 *   scene.orbit({ auto: 0.3 });
 *
 * Without a target (or outside a browser) the scene is headless: build it the
 * same way and call `toSVG()` for markup.
 */
export class Scene {
  /**
   * @param {Element|string|object} [target] element, selector, or the options when headless
   * @param {object} [options]
   */
  constructor(target, options) {
    if (target && typeof target === 'object' && !('nodeType' in target)) { options = target; target = null; }
    const o = (this.options = { ...DEFAULTS, ...options });
    this.id = o.id || `lf${++uid}`;
    this.W = o.width;
    this.H = o.height;
    this.camera = o.camera instanceof Camera ? o.camera : new Camera(o.camera);
    this.camera._scene = this;
    this.light = { direction: [-0.5, 0.72, 0.6], space: 'view', ...o.light };
    this.palette = { ...o.palette };
    this.root = new Node();
    this.root._attach(this);
    this.painter = new Painter();
    this.time = 0;
    /** Detail multiplier the scene lowers by itself when frames run slow. */
    this.lod = 1;
    this.paused = false;

    this._loops = new Set();
    this._tweens = new Set();
    this._controllers = new Set();
    this._dirty = true;
    this._visible = true;
    this._bounds = null;
    this._strokeScale = 0;
    this._restyle = false;
    this._paper = 'Canvas';
    this._resolved = {};
    this._cls = [];
    this._pool = [];
    this._drawn = 0;
    this._cssVersion = -1;
    this._slow = 0;
    this._streak = 0;
    this._lastRender = 0;
    this._last = 0;
    this._ctx = { view: this.camera.view, L: [0, 0, 1], H: [0, 0, 1], shadow: null, lod: 1 };
    this._env = {
      color: (c) => this._color(c),
      px: (w) => w * this._strokeScale,
      style: (d) => this.painter.style(d),
    };

    if (typeof target === 'string') target = HAS_DOM ? document.querySelector(target) : null;
    if (target && HAS_DOM) this._mount(target);
  }

  // ── Building the scene ────────────────────────────────────────────────────

  /**
   * Add something to draw. Surfaces take a look name or a material; curves take
   * a stroke style; an array of points draws dots. Returns the node, whose
   * position, rotation, scale and material you can change at any time.
   */
  add(thing, material, placement) {
    let node;
    if (thing instanceof Node) node = thing;
    else if (thing instanceof NurbsSurface) node = new SurfaceMesh(thing, material);
    else if (thing instanceof NurbsCurve) node = new CurveMesh(thing, material);
    else if (Array.isArray(thing)) node = new PointsMesh(thing, material);
    else throw new Error('scene.add: expected a NurbsSurface, a NurbsCurve, an array of points, or a Node');
    if (placement) {
      if (placement.position) node.position = placement.position;
      if (placement.rotation) node.rotation = placement.rotation;
      if (placement.scale != null) node.scale = placement.scale;
    }
    this.root.add(node);
    return node;
  }

  /** An empty node to parent others to, so they move together. */
  group(placement) {
    return this.add(new Node(), null, placement);
  }

  remove(node) {
    node.parent?.remove(node);
    return this;
  }

  clear() {
    for (const c of [...this.root.children]) this.root.remove(c);
    return this;
  }

  /** Re-frame the camera around what is in the scene now (after geometry moved or changed size). */
  fit() {
    this._bounds = null;
    return this.invalidate();
  }

  _structureChanged() {
    this._bounds = null;
    this.invalidate();
  }

  // ── Colour ────────────────────────────────────────────────────────────────

  _color(c) {
    if (c === 'ink' || c === 'paper' || c === 'accent') return this.palette[c] || this._resolved[c] || `var(--lf-${c})`;
    // Two quiet tones between paper and ink, for flat illustration: a pale wash and a soft line.
    if (c === 'tint') return mixColors(this._color('paper'), this._color('ink'), 0.07);
    if (c === 'soft') return mixColors(this._color('paper'), this._color('ink'), 0.22);
    return c;
  }

  /**
   * Set the palette words used by looks: `{ ink, paper, accent }`, any CSS colours.
   * Unset words follow the page: --loft-ink / --ink / the text colour,
   * --loft-paper / --bg / the background behind the scene, --loft-accent / --accent.
   *
   * The page's colours are read when the scene mounts and again when the colour
   * scheme or the theme attributes on <html> or <body> change. Call this with no
   * argument to re-read them yourself after any other kind of theme switch.
   */
  setPalette(p) {
    if (p) Object.assign(this.palette, p);
    if (this.host) this._readPage();
    this._restyle = true;
    return this.invalidate();
  }

  /** Resolve the page's theme tokens to real colours, so shading ramps can be computed properly. */
  _readPage() {
    this._paper = detectPaper(this.host);
    const probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;width:0;height:0;visibility:hidden;pointer-events:none';
    this.host.appendChild(probe);
    const read = (value) => {
      probe.style.color = value;
      const rgb = parseColor(getComputedStyle(probe).color);
      return rgb ? toHex(rgb) : null;
    };
    this._resolved = {
      ink: read('var(--loft-ink, var(--ink, currentColor))'),
      paper: read(`var(--loft-paper, var(--bg, ${this._paper}))`),
      accent: read('var(--loft-accent, var(--accent, #c4532f))'),
    };
    probe.remove();
  }

  _css() {
    const p = this.palette, id = this.id;
    let s = `.${id}{--lf-ink:${p.ink || 'var(--loft-ink,var(--ink,currentColor))'};` +
      `--lf-paper:${p.paper || `var(--loft-paper,var(--bg,${this._paper}))`};` +
      `--lf-accent:${p.accent || 'var(--loft-accent,var(--accent,#c4532f))'}}`;
    const css = this.painter.css;
    for (let i = 0; i < css.length; i++) s += `.${id}-${i}{${css[i]}}`;
    const sh = this._shadowOptions();
    if (sh) s += `.${id}-sh{fill:${this._color(sh.color)};fill-opacity:${sh.opacity}}`;
    return s;
  }

  _shadowOptions() {
    const s = this.options.shadow;
    return s ? { color: 'ink', opacity: 0.14, blur: 0, y: null, ...(s === true ? {} : s) } : null;
  }

  // ── Rendering ─────────────────────────────────────────────────────────────

  /** Ask for a redraw on the next frame. Called for you when nodes, camera or materials change. */
  invalidate() {
    this._dirty = true;
    if (this.svg && !this.paused) wake(this);
    return this;
  }

  _collect(node, out) {
    if (!node._visible) return out;
    if (node.kind) out.push(node);
    for (const c of node.children) this._collect(c, out);
    return out;
  }

  _prepare(m) {
    if (m.kind === 'surface') {
      if (!m._compiled) { m._compiled = compileSurface(m.material, this._env); m._resKey = null; }
      if (!m._grid) { m._grid = new SurfaceGrid(); m._res = null; m._resKey = null; }
      const s = m._geometry, lines = m._compiled.lines;
      const iu = lines ? lines.u : 0, iv = lines ? lines.v : 0;
      if (!m._res) {
        m._res = [
          alignPerSpan(s.degreeU === 1 ? 2 : 6, s.countU - s.degreeU, iu),
          alignPerSpan(s.degreeV === 1 ? 2 : 6, s.countV - s.degreeV, iv),
        ];
      }
      const g = m._grid;
      const built = g.build(s, m._res[0], m._res[1], m._range, iu, iv);
      if (built || g.version !== s.version || (m.deform && g.time !== this.time)) {
        g.evaluate(m.deform, this.time);
        g.time = this.time;
      }
    } else if (!m._compiled) {
      m._compiled = m.kind === 'curve' ? compileCurve(m.material, this._env)
        : m.kind === 'shape' ? compileShape(m.material, this._env, m._opacity)
        : compilePoints(m.material, this._env);
    }
  }

  /** Choose how finely each surface is diced, from its size on screen. */
  _detail(m, pxPerUnit) {
    const w = m.world;
    const det = Math.abs(w[0] * (w[5] * w[10] - w[6] * w[9]) - w[4] * (w[1] * w[10] - w[2] * w[9]) + w[8] * (w[1] * w[6] - w[2] * w[5]));
    const px = pxPerUnit * Math.cbrt(det);
    const key = Math.round(Math.log2(Math.max(px, 1e-6)) * 3) + '|' + this.lod + '|' + this.options.detail;
    if (m._resKey === key) return;
    m._resKey = key;
    const g = m._grid, s = m._geometry, lines = m._compiled.lines;
    const [lu, tu, lv, tv] = g.extent();
    const tol = 0.3 / (this.options.detail * m._compiled.detail * this.lod);
    const next = [
      perSpan(lu * px, tu, g.u.spans, tol, lines ? lines.u : 0),
      perSpan(lv * px, tv, g.v.spans, tol, lines ? lines.v : 0),
    ];
    if (next[0] !== m._res[0] || next[1] !== m._res[1]) {
      m._res = next;
      this._prepare(m);
    }
  }

  _computeBounds(list) {
    let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
    const pts = [];
    const eat = (m, x, y, z) => {
      const w = m.world;
      const X = w[0] * x + w[4] * y + w[8] * z + w[12], Y = w[1] * x + w[5] * y + w[9] * z + w[13], Z = w[2] * x + w[6] * y + w[10] * z + w[14];
      pts.push(X, Y, Z);
      if (X < x0) x0 = X; if (X > x1) x1 = X;
      if (Y < y0) y0 = Y; if (Y > y1) y1 = Y;
      if (Z < z0) z0 = Z; if (Z > z1) z1 = Z;
    };
    for (const m of list) {
      if (m.kind === 'surface') {
        const p = m._grid.pos;
        for (let o = 0; o < p.length; o += 3) eat(m, p[o], p[o + 1], p[o + 2]);
      } else if (m.kind === 'curve') {
        for (const p of m.geometry.sample(48)) eat(m, p[0], p[1], p[2]);
      } else if (m.kind === 'shape') {
        for (const c of m.geometry) for (const p of c.sample(48)) eat(m, p[0], p[1], p[2]);
      } else {
        for (const p of m.points) eat(m, p[0], p[1], p[2] || 0);
      }
    }
    if (!pts.length) return { center: [0, 0, 0], radius: 1, rxz: 1, hy: 1, ground: -1 };
    const c = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2];
    let r2 = 0, rxz2 = 0;
    for (let o = 0; o < pts.length; o += 3) {
      const dx = pts[o] - c[0], dy = pts[o + 1] - c[1], dz = pts[o + 2] - c[2];
      r2 = Math.max(r2, dx * dx + dy * dy + dz * dz);
      rxz2 = Math.max(rxz2, dx * dx + dz * dz);
    }
    return { center: c, radius: Math.sqrt(r2) || 1, rxz: Math.sqrt(rxz2) || 1e-6, hy: (y1 - y0) / 2 || 1e-6, ground: y0 };
  }

  /** Aim the camera and fill in the per-frame drawing context. Returns pixels per world unit at the target. */
  _frame() {
    const cam = this.camera, b = this._bounds, { W, H } = this, o = this.options, ctx = this._ctx;
    const use = Math.max(0.05, 1 - 2 * o.padding);
    const tanHalf = Math.tan((cam.fov * Math.PI) / 360);
    let f = H / 2 / tanHalf, s;
    if (o.fit) {
      if (!cam._userTarget) cam._target = b.center.slice();
      const e = clamp(cam.elevation, -1.55, 1.55), ce = Math.cos(e), se = Math.abs(Math.sin(e));
      // Half-extents on screen from any azimuth: the scene's bounding cylinder about the vertical axis.
      const halfW = b.rxz, halfH = b.hy * ce + b.rxz * se;
      s = Math.min((W * use) / (2 * halfW), (H * use) / (2 * halfH)) * cam.zoom;
      // A fixed frame is a flat artboard: it fills the box exactly, with nothing held back for depth.
      if (!cam.orthographic) cam._v.distance = f / s + (b.flat ? 0 : 0.55 * (b.rxz * ce + b.hy * se));
    } else {
      s = (f / cam.distance) * cam.zoom;
      f *= cam.zoom;
    }
    cam.update();
    ctx.ortho = cam.orthographic;
    ctx.os = s;
    ctx.f = f;
    ctx.near = cam.orthographic ? -Infinity : cam.distance * 0.02;
    ctx.ox = o.offset[0] * W;
    ctx.oy = o.offset[1] * H;
    ctx.time = this.time;
    ctx.lod = this.lod * o.detail;
    const L = this.light.space === 'world' ? transformDirection(cam.view, this.light.direction) : this.light.direction;
    ctx.L = normalize(L);
    ctx.H = normalize([ctx.L[0], ctx.L[1], ctx.L[2] + 1]);
    const zc = transformPoint(cam.view, b.center)[2];
    ctx.zNear = zc + b.radius;
    ctx.zInv = 1 / (2 * b.radius);
    ctx.eps = b.radius * 1e-6;
    ctx.shadow = null;
    const sh = this._shadowOptions();
    if (sh) {
      const n = transformDirection(cam.view, [0, 1, 0]);
      const p0 = transformPoint(cam.view, [0, sh.y ?? b.ground, 0]);
      const nl = n[0] * ctx.L[0] + n[1] * ctx.L[1] + n[2] * ctx.L[2];
      if (nl > 0.12) ctx.shadow = { n, d: n[0] * p0[0] + n[1] * p0[1] + n[2] * p0[2], nl };
    }
    return s;
  }

  /** Draw the scene now. Usually you do not need to call this: changes redraw on the next frame. */
  render() {
    this._dirty = false;
    const P = this.painter;
    const ss = Math.round(Math.sqrt(Math.min(this.W, this.H) / this.options.reference) * 20) / 20 || 1;
    if (ss !== this._strokeScale) { this._strokeScale = ss; this._restyle = true; }
    if (this._restyle) {
      this._restyle = false;
      P.resetStyles();
      this._cls.length = 0;
      this.root.traverse((n) => { n._compiled = null; });
    }
    this.root._updateWorld(null);
    const list = this._collect(this.root, []);
    for (const m of list) this._prepare(m);
    if (!this._bounds) this._bounds = this.options.frame ? frameBounds(this.options.frame) : this._computeBounds(list);
    const pxPerUnit = this._frame();
    for (const m of list) if (m.kind === 'surface') this._detail(m, pxPerUnit);
    P.reset();
    const ctx = this._ctx;
    for (const m of list) {
      if (m.kind === 'surface') drawSurface(m, ctx, P);
      else if (m.kind === 'curve') drawCurve(m, ctx, P);
      else if (m.kind === 'shape') drawShape(m, ctx, P);
      else drawPoints(m, ctx, P);
    }
    P.finish();
    if (this.svg) this._commit();
    return this;
  }

  _class(i) {
    return this._cls[i] || (this._cls[i] = `${this.id}-${i}`);
  }

  _commit() {
    const P = this.painter;
    if (this._cssVersion !== P.cssVersion) {
      this._cssVersion = P.cssVersion;
      this._style.textContent = this._css();
    }
    if (this._shadowPath) this._shadowPath.setAttribute('d', P.shadow);
    const pool = this._pool, g = this._g, n = P.runs;
    for (let i = 0; i < n; i++) {
      let el = pool[i];
      if (!el) { el = pool[i] = document.createElementNS(NS, 'path'); el._s = -1; g.appendChild(el); }
      const s = P.runStyle[i];
      if (el._s !== s) { el._s = s; el.setAttribute('class', this._class(s)); }
      el.setAttribute('d', P.runD[i]);
    }
    for (let i = n; i < this._drawn; i++) pool[i].setAttribute('d', '');
    this._drawn = n;
  }

  /**
   * The current picture as SVG markup: for server rendering, static export, or
   * an <img>. Colours given as palette words stay as CSS variables unless the
   * palette is set to fixed colours.
   */
  toSVG({ width = this.W, height = this.H } = {}) {
    if (!this.svg) { this.W = width; this.H = height; }
    this.render();
    const P = this.painter, { W, H, id } = this, o = this.options;
    const sh = this._shadowOptions();
    let s = `<svg xmlns="${NS}" viewBox="${-W / 2} ${-H / 2} ${W} ${H}" width="${width}" height="${height}" class="${id} loft-svg" data-loft` +
      (o.label ? ` role="img" aria-label="${escapeAttr(o.label)}">` : ' aria-hidden="true">');
    if (o.label) s += `<title>${escapeAttr(o.label)}</title>`;
    s += `<style>${this._css()}</style>`;
    if (sh && sh.blur) s += `<filter id="${id}-blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${sh.blur}"/></filter>`;
    if (o.background) s += `<rect x="${-W / 2}" y="${-H / 2}" width="${W}" height="${H}" fill="${this._color(o.background)}"/>`;
    if (sh && P.shadow) s += `<path class="${id}-sh"${sh.blur ? ` filter="url(#${id}-blur)"` : ''} d="${P.shadow}"/>`;
    s += '<g fill="none" stroke-linecap="round" stroke-linejoin="round">';
    for (let i = 0; i < P.runs; i++) s += `<path class="${this._class(P.runStyle[i])}" d="${P.runD[i]}"/>`;
    return s + '</g></svg>';
  }

  /** Where a world-space point lands in the picture, in CSS pixels from the scene's top-left corner. */
  project(point) {
    const ctx = this._ctx, v = transformPoint(this.camera.view, point);
    const k = ctx.ortho ? ctx.os : ctx.f / -v[2];
    return { x: v[0] * k + ctx.ox + this.W / 2, y: -v[1] * k + ctx.oy + this.H / 2, depth: -v[2], visible: ctx.ortho || v[2] < -ctx.near };
  }

  // ── Mounting ──────────────────────────────────────────────────────────────

  _mount(host) {
    injectStyles();
    this.host = host;
    const o = this.options;
    host.querySelector(':scope > svg[data-loft]')?.remove();
    if (getComputedStyle(host).position === 'static') host.classList.add('loft-rel');
    // Reserve space before anything is drawn, so the page never shifts.
    if (host.clientHeight < 2) host.style.aspectRatio = `${o.width} / ${o.height}`;
    if (host.clientWidth < 2) host.style.width = '100%';

    const svg = (this.svg = document.createElementNS(NS, 'svg'));
    svg.setAttribute('class', `${this.id} loft-svg`);
    svg.setAttribute('data-loft', '');
    this._title = document.createElementNS(NS, 'title');
    this._desc = document.createElementNS(NS, 'desc');
    this._style = document.createElementNS(NS, 'style');
    svg.append(this._title, this._desc, this._style);
    const sh = this._shadowOptions();
    if (o.background) {
      this._bg = document.createElementNS(NS, 'rect');
      this._bg.setAttribute('fill', this._color(o.background));
      svg.appendChild(this._bg);
    }
    if (sh) {
      if (sh.blur) {
        const f = document.createElementNS(NS, 'filter');
        f.id = `${this.id}-blur`;
        for (const [k, v] of [['x', '-50%'], ['y', '-50%'], ['width', '200%'], ['height', '200%']]) f.setAttribute(k, v);
        const b = document.createElementNS(NS, 'feGaussianBlur');
        b.setAttribute('stdDeviation', sh.blur);
        f.appendChild(b);
        svg.appendChild(f);
      }
      this._shadowPath = document.createElementNS(NS, 'path');
      this._shadowPath.setAttribute('class', `${this.id}-sh`);
      if (sh.blur) this._shadowPath.setAttribute('filter', `url(#${this.id}-blur)`);
      svg.appendChild(this._shadowPath);
    }
    this._g = document.createElementNS(NS, 'g');
    this._g.setAttribute('fill', 'none');
    this._g.setAttribute('stroke-linecap', 'round');
    this._g.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(this._g);
    this.label = o.label;
    host.appendChild(svg);

    this._readPage();
    this._resize(host.clientWidth || o.width, host.clientHeight || o.height);

    if (typeof ResizeObserver === 'function') {
      this._ro = new ResizeObserver((entries) => {
        const r = entries[entries.length - 1].contentRect;
        if (r.width > 0 && r.height > 0) this._resize(r.width, r.height);
      });
      this._ro.observe(host);
    }
    if (typeof IntersectionObserver === 'function') {
      this._io = new IntersectionObserver((entries) => {
        this._visible = entries[entries.length - 1].isIntersecting;
        if (this._visible && this._dirty) wake(this);
      }, { rootMargin: '120px' });
      this._io.observe(host);
    }
    if (typeof matchMedia === 'function') {
      this._mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
      this._mqDark = matchMedia('(prefers-color-scheme: dark)');
      this._onReduce = () => {
        this._pauseBtn?.remove();
        this._pauseBtn = null;
        this._last = 0;
        this.invalidate();
      };
      this._onScheme = () => this.setPalette();
      this._mqReduce.addEventListener?.('change', this._onReduce);
      this._mqDark.addEventListener?.('change', this._onScheme);
    }
    if (typeof MutationObserver === 'function') {
      // Theme toggles usually flip a class or data attribute near the root; follow them.
      let queued = false;
      this._mo = new MutationObserver(() => {
        if (queued) return;
        queued = true;
        requestAnimationFrame(() => { queued = false; if (this.svg) this.setPalette(); });
      });
      const watch = { attributes: true, attributeFilter: ['class', 'style', 'data-theme', 'data-mode', 'data-color-scheme'] };
      this._mo.observe(document.documentElement, watch);
      if (document.body) this._mo.observe(document.body, watch);
    }
  }

  _resize(w, h) {
    w = Math.round(w); h = Math.round(h);
    if (w === this.W && h === this.H && this.svg.hasAttribute('viewBox')) return;
    this.W = w; this.H = h;
    this.svg.setAttribute('viewBox', `${-w / 2} ${-h / 2} ${w} ${h}`);
    if (this._bg) for (const [k, v] of [['x', -w / 2], ['y', -h / 2], ['width', w], ['height', h]]) this._bg.setAttribute(k, v);
    this.invalidate();
  }

  /** The accessible name. With a label the picture is announced as an image; without one it is hidden from assistive technology as decoration. */
  get label() { return this.options.label; }
  set label(text) {
    this.options.label = text || '';
    if (!this.svg) return;
    this._title.textContent = text || '';
    if (text) {
      this.svg.setAttribute('role', 'img');
      this.svg.setAttribute('aria-label', text);
      this.svg.removeAttribute('aria-hidden');
    } else if (this.svg.hasAttribute('tabindex')) {
      this.svg.setAttribute('role', 'img');
      this.svg.setAttribute('aria-label', '3D illustration');
      this.svg.removeAttribute('aria-hidden');
    } else {
      this.svg.removeAttribute('role');
      this.svg.removeAttribute('aria-label');
      this.svg.setAttribute('aria-hidden', 'true');
    }
  }

  _describe(text) {
    if (!this.svg) return;
    this._desc.textContent = text;
    this.label = this.options.label;
  }

  // ── Motion ────────────────────────────────────────────────────────────────

  /** True when motion should rest: the visitor prefers reduced motion, or the page or scene turned motion off. */
  get reducedMotion() {
    const m = this.options.motion;
    if (m === 'always') return false;
    if (m === 'off') return true;
    if (HAS_DOM && document.documentElement.dataset.motion === 'off') return true;
    return !!this._mqReduce?.matches;
  }

  /**
   * Run `fn({ time, dt })` every frame, then redraw if anything changed. Time is
   * in seconds. Returns a function that stops it.
   *
   * Under reduced motion, or when headless, `fn` runs once at the poster time so
   * the scene still shows a finished frame.
   */
  loop(fn = () => {}) {
    const entry = { fn };
    this._loops.add(entry);
    if (this.reducedMotion || !this.svg) {
      const t = this.time;
      this.time = this.options.poster;
      fn({ time: this.time, dt: 0, scene: this });
      this.time = t;
      this.invalidate();
    } else {
      wake(this);
    }
    return () => { this._loops.delete(entry); };
  }

  /**
   * Animate properties of any object toward new values: numbers, arrays of
   * numbers, or plain objects of those.
   *
   *   scene.tween(mesh.rotation, { y: Math.PI }, { duration: 800 });
   *   scene.tween(mesh, { range: { v: [0, 1] } });
   *
   * Returns a promise that resolves when it finishes; call `.cancel()` to stop early.
   * Under reduced motion the values are set at once.
   */
  tween(target, to, { duration = 600, ease: curve = ease.out, delay = 0, onUpdate } = {}) {
    for (const t of this._tweens) {
      if (t.target === target) for (const k in to) delete t.to[k];
    }
    const from = {};
    for (const k in to) from[k] = target[k];
    let done;
    const promise = new Promise((r) => { done = r; });
    const tw = { target, from, to: { ...to }, t: -delay / 1000, dur: duration / 1000, curve, onUpdate, done };
    promise.cancel = () => { if (this._tweens.delete(tw)) done(false); };
    if (this.reducedMotion || !this.svg || duration <= 0) {
      this._applyTween(tw, 1);
      done(true);
      this.invalidate();
    } else {
      this._tweens.add(tw);
      wake(this);
    }
    return promise;
  }

  _applyTween(tw, k) {
    for (const key in tw.to) tw.target[key] = interp(tw.from[key], tw.to[key], k);
    tw.onUpdate?.(k);
    this._dirty = true;
  }

  /** Let people turn the scene: drag, arrow keys, and an optional slow automatic turn (`auto`, radians per second). */
  orbit(options) {
    const c = new Orbit(this, options);
    this._controllers.add(c);
    if (this.svg) wake(this);
    return c;
  }

  /**
   * A one-time entrance: the scene swings into its resting angle and settles
   * from just under full size. It never hides the picture and never repeats.
   */
  intro({ turn = 0.5, duration = 1100, scale = 0.98 } = {}) {
    if (this.reducedMotion || !this.svg) return Promise.resolve(false);
    this.camera._v.swing = -turn;
    if (scale !== 1 && this.svg.animate) {
      this.svg.animate([{ transform: `scale(${scale})` }, { transform: 'none' }], { duration: Math.min(duration, 900), easing: 'cubic-bezier(.22,1,.36,1)' });
    }
    return this.tween(this.camera, { swing: 0 }, { duration, ease: ease.enter });
  }

  /** Freeze all motion in this scene. */
  pause() {
    this.paused = true;
    sleep(this);
    this._pauseBtn?.sync();
    return this;
  }

  resume() {
    this.paused = false;
    this._last = 0;
    this._pauseBtn?.sync();
    wake(this);
    return this;
  }

  _geometryChanged(node) {
    if (node.kind === 'surface' && node._grid && node._grid.version !== node._geometry.version) return true;
    for (const c of node.children) if (this._geometryChanged(c)) return true;
    return false;
  }

  _hasDeform(node) {
    if (node.deform) return true;
    for (const c of node.children) if (this._hasDeform(c)) return true;
    return false;
  }

  _tick(now) {
    if (this.paused) { sleep(this); return; }
    if (now === this._last) return; // never do a frame's work twice
    const dt = this._last ? Math.min(0.1, (now - this._last) / 1000) : 0;
    this._last = now;
    const still = this.reducedMotion;
    if (!still) this.time += dt;
    // Off screen the clock keeps running but nothing is computed or drawn, so
    // there is no visible restart when the scene scrolls back into view.
    if (!this._visible) return;

    for (const tw of this._tweens) {
      tw.t += dt;
      if (tw.t < 0) continue;
      const k = tw.dur > 0 ? Math.min(1, tw.t / tw.dur) : 1;
      this._applyTween(tw, tw.curve(k));
      if (k >= 1) { this._tweens.delete(tw); tw.done(true); }
    }
    let autonomous = false;
    if (!still) {
      const state = { time: this.time, dt, scene: this };
      for (const l of this._loops) l.fn(state);
      if (this._loops.size) {
        autonomous = true;
        if (this._hasDeform(this.root)) this._dirty = true;
      }
    }
    let moving = false;
    for (const c of this._controllers) {
      c.update(dt);
      if (c.moving) moving = true;
      if (c.autonomous && !still) autonomous = true;
    }
    if (!this._dirty && this._geometryChanged(this.root)) this._dirty = true;

    if (this._dirty) {
      const t0 = performance.now();
      this.render();
      const cost = performance.now() - t0;
      // Slow frames, sustained: dice the surfaces more coarsely rather than stutter.
      if (cost > 20 && autonomous) {
        if (++this._slow > 14 && this.lod > 0.45) { this.lod = Math.max(0.45, this.lod * 0.8); this._slow = 0; this._dirty = true; }
      } else if (this._slow > 0) this._slow--;
      // Anything still moving by itself after five seconds gets a pause button.
      if (autonomous) {
        this._streak = now - this._lastRender < 400 ? this._streak + (now - this._lastRender) : 0;
        if (this._streak > 5000 && this.options.pauseButton && !this._pauseBtn && this.host) this._pauseBtn = createPauseButton(this);
      }
      this._lastRender = now;
    }
    if (!this._dirty && !this._tweens.size && !moving && !(this._loops.size && !still)) sleep(this);
  }

  /** Stop everything and remove the SVG from the page. */
  destroy() {
    sleep(this);
    for (const c of [...this._controllers]) c.dispose();
    this._ro?.disconnect();
    this._io?.disconnect();
    this._mo?.disconnect();
    this._mqReduce?.removeEventListener?.('change', this._onReduce);
    this._mqDark?.removeEventListener?.('change', this._onScheme);
    this._pauseBtn?.remove();
    this.svg?.remove();
    this.svg = null;
    this._loops.clear();
    this._tweens.clear();
  }
}

/** Bounds for a fixed frame: a box [width, height, depth] centred on the origin, facing the camera. */
function frameBounds([w, h, d = 0]) {
  return { center: [0, 0, 0], radius: Math.hypot(w, h, d) / 2 || 1, rxz: w / 2 || 1e-6, hy: h / 2 || 1e-6, ground: -h / 2, flat: true };
}

function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** The colour actually painted behind an element: the first ancestor with a background. */
function detectPaper(el) {
  for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
    const bg = getComputedStyle(n).backgroundColor;
    if (bg && bg !== 'transparent' && !/^rgba\(.*,\s*0\)$/.test(bg) && !/\/\s*0\)$/.test(bg)) return bg;
  }
  return 'Canvas';
}

export { resolveMaterial };
