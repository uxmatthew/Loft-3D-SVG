// Motion plumbing shared by every scene: one requestAnimationFrame loop, the
// easing curves, the orbit controller and the pause button.

// ── Easing ──────────────────────────────────────────────────────────────────

/** A CSS-style cubic-bezier easing as a function of t ∈ [0, 1]. */
export function cubicBezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  return (t) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    let s = t;
    for (let i = 0; i < 8; i++) {
      const x = ((ax * s + bx) * s + cx) * s - t;
      if (Math.abs(x) < 1e-5) break;
      const d = (3 * ax * s + 2 * bx) * s + cx;
      if (Math.abs(d) < 1e-6) break;
      s -= x / d;
    }
    return ((ay * s + by) * s + cy) * s;
  };
}

/**
 * Easing curves. None overshoots: things arrive and stop.
 * `out` for interface steps, `enter` for something settling into place,
 * `inOut` for travel between two rests, `linear` for loops and drifts.
 */
export const ease = {
  out: cubicBezier(0.2, 0.8, 0.2, 1),
  enter: cubicBezier(0.22, 1, 0.36, 1),
  inOut: cubicBezier(0.65, 0, 0.35, 1),
  linear: (t) => t,
};

// ── One frame loop for all scenes ───────────────────────────────────────────

const awake = new Set();
let raf = 0; // id of the one pending frame request, or 0 when none is pending

function frame(now) {
  // `raf` stays set while scenes tick. Ticking usually asks for another redraw
  // (a tween moved something, a camera turned), and those calls to wake() must
  // not each queue a frame of their own: exactly one is requested, below.
  try {
    for (const s of [...awake]) s._tick(now);
  } finally {
    // Even if one scene's callback throws, the others keep running next frame.
    raf = awake.size ? requestAnimationFrame(frame) : 0;
  }
}

export function wake(scene) {
  awake.add(scene);
  if (!raf && typeof requestAnimationFrame === 'function') raf = requestAnimationFrame(frame);
}

export function sleep(scene) {
  awake.delete(scene);
}

// ── Page styles (injected once) ─────────────────────────────────────────────

const CSS = `
.loft-rel{position:relative}
.loft-svg{display:block;width:100%;height:100%;overflow:visible}
.loft-svg[tabindex]:focus{outline:none}
.loft-svg[tabindex]:focus-visible{outline:2px solid var(--loft-accent,var(--accent,currentColor));outline-offset:2px;border-radius:4px}
.loft-grab{cursor:grab;touch-action:pan-y;-webkit-user-select:none;user-select:none}
.loft-grab.is-dragging{cursor:grabbing}
.loft-pause{position:absolute;right:12px;bottom:12px;width:32px;height:32px;padding:0;border:0;border-radius:50%;display:grid;place-items:center;cursor:pointer;background:var(--loft-ink,var(--ink,#16181d));color:var(--loft-paper,var(--bg,#fff));opacity:0;transition:opacity .15s cubic-bezier(.2,.8,.2,1)}
.loft-pause::after{content:"";position:absolute;inset:-6px}
.loft-pause svg{width:12px;height:12px;fill:currentColor;display:block}
.loft-rel:hover>.loft-pause,.loft-pause:focus-visible,.loft-pause[aria-pressed="true"]{opacity:1}
.loft-pause:focus-visible{outline:2px solid var(--loft-accent,var(--accent,currentColor));outline-offset:2px}
@media (hover:none){.loft-pause{opacity:1}}
@media (prefers-reduced-motion:reduce){.loft-pause{display:none}}
loft-scene,loft-spot{display:block}
`;

export function injectStyles() {
  if (typeof document === 'undefined' || document.getElementById('loft-styles')) return;
  const el = document.createElement('style');
  el.id = 'loft-styles';
  el.textContent = CSS;
  document.head.appendChild(el);
}

// ── Pause button ────────────────────────────────────────────────────────────

const ICON_PAUSE = '<svg viewBox="0 0 12 12" aria-hidden="true"><rect x="2" y="1.5" width="3" height="9" rx=".6"/><rect x="7" y="1.5" width="3" height="9" rx=".6"/></svg>';
const ICON_PLAY = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 1.6v8.8a.5.5 0 0 0 .77.42l6.6-4.4a.5.5 0 0 0 0-.84l-6.6-4.4A.5.5 0 0 0 3 1.6z"/></svg>';

/** A round pause/play toggle in the host's bottom-right corner (WCAG 2.2.2: moving content can be paused). */
export function createPauseButton(scene) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'loft-pause';
  const sync = () => {
    b.setAttribute('aria-pressed', String(scene.paused));
    b.setAttribute('aria-label', scene.paused ? 'Play animation' : 'Pause animation');
    b.innerHTML = scene.paused ? ICON_PLAY : ICON_PAUSE;
  };
  b.addEventListener('click', () => {
    if (scene.paused) scene.resume(); else scene.pause();
    sync();
  });
  b.sync = sync;
  sync();
  scene.host.appendChild(b);
  return b;
}

// ── Orbit ───────────────────────────────────────────────────────────────────

/**
 * Lets people turn the camera around the scene: drag, arrow keys, an optional
 * slow automatic turn, and an optional lean toward the pointer.
 */
export class Orbit {
  constructor(scene, {
    drag = true, auto = 0, inertia = true, hover = 0, keys = true,
    minElevation = -1.2, maxElevation = 1.2, resume = 2000,
  } = {}) {
    this.scene = scene;
    this.auto = auto;
    this.inertia = inertia;
    this.hover = hover;
    this.min = minElevation;
    this.max = maxElevation;
    this.resume = resume;
    this._vAz = 0; this._vEl = 0;
    this._drag = null;
    this._idle = Infinity;
    this._gain = 1;
    this._hx = 0; this._hy = 0; this._tx = 0; this._ty = 0;
    this._off = [];
    const svg = scene.svg, cam = scene.camera;
    this._home = [cam.azimuth, cam.elevation];
    if (!svg) return;
    const on = (el, type, fn, opts) => { el.addEventListener(type, fn, opts); this._off.push(() => el.removeEventListener(type, fn, opts)); };

    if (drag) {
      svg.classList.add('loft-grab');
      on(svg, 'pointerdown', (e) => {
        if (e.button !== 0) return;
        svg.setPointerCapture?.(e.pointerId);
        svg.classList.add('is-dragging');
        this._drag = { x: e.clientX, y: e.clientY, t: e.timeStamp, k: Math.PI / Math.max(120, Math.min(scene.W, scene.H)) };
        this._vAz = this._vEl = 0;
        this._idle = 0; this._gain = 0;
      });
      on(svg, 'pointermove', (e) => {
        const d = this._drag;
        if (!d) return;
        const dx = (e.clientX - d.x) * d.k, dy = (e.clientY - d.y) * d.k, dt = Math.max(1, e.timeStamp - d.t) / 1000;
        d.x = e.clientX; d.y = e.clientY; d.t = e.timeStamp;
        cam.azimuth -= dx;
        cam.elevation = Math.max(this.min, Math.min(this.max, cam.elevation + dy));
        this._vAz = 0.6 * this._vAz + 0.4 * (-dx / dt);
        this._vEl = 0.6 * this._vEl + 0.4 * (dy / dt);
      });
      const end = (e) => {
        if (!this._drag) return;
        if (e.timeStamp - this._drag.t > 80) this._vAz = this._vEl = 0;
        this._drag = null;
        svg.classList.remove('is-dragging');
        this._idle = 0;
        scene.invalidate();
      };
      on(svg, 'pointerup', end);
      on(svg, 'pointercancel', end);
    }

    if (keys) {
      if (!svg.hasAttribute('tabindex')) svg.setAttribute('tabindex', '0');
      scene._describe('Drag or use the arrow keys to turn it.');
      on(svg, 'keydown', (e) => {
        const step = 0.2618;
        let az = 0, el = 0;
        if (e.key === 'ArrowLeft') az = -step;
        else if (e.key === 'ArrowRight') az = step;
        else if (e.key === 'ArrowUp') el = step;
        else if (e.key === 'ArrowDown') el = -step;
        else if (e.key === 'Home') {
          e.preventDefault();
          this._idle = 0; this._gain = 0;
          scene.tween(cam, { azimuth: this._home[0], elevation: this._home[1] }, { duration: 320 });
          return;
        } else return;
        e.preventDefault();
        this._idle = 0; this._gain = 0;
        scene.tween(cam, {
          azimuth: cam.azimuth + az,
          elevation: Math.max(this.min, Math.min(this.max, cam.elevation + el)),
        }, { duration: 220 });
      });
    }

    if (hover && typeof matchMedia === 'function' && matchMedia('(hover: hover) and (pointer: fine)').matches) {
      let rect = null;
      on(svg, 'pointerenter', () => { rect = svg.getBoundingClientRect(); });
      on(svg, 'pointermove', (e) => {
        if (!rect || this._drag) return;
        this._tx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
        this._ty = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
        scene.invalidate();
      });
      on(svg, 'pointerleave', () => { this._tx = this._ty = 0; scene.invalidate(); });
    }
  }

  /** True while the orbit moves by itself, so the scene knows to keep ticking. */
  get moving() {
    if (this.scene.reducedMotion) return false;
    return this.auto !== 0 || Math.abs(this._vAz) + Math.abs(this._vEl) > 1e-3 ||
      Math.abs(this._tx - this._hx) + Math.abs(this._ty - this._hy) > 1e-3;
  }

  get autonomous() {
    return this.auto !== 0;
  }

  update(dt) {
    const cam = this.scene.camera, still = this.scene.reducedMotion;
    if (this._drag) return;
    this._idle += dt * 1000;
    if (!still && this.inertia && Math.abs(this._vAz) + Math.abs(this._vEl) > 1e-3) {
      cam.azimuth += this._vAz * dt;
      cam.elevation = Math.max(this.min, Math.min(this.max, cam.elevation + this._vEl * dt));
      const k = Math.exp(-dt * 4.2);
      this._vAz *= k; this._vEl *= k;
    } else {
      this._vAz = this._vEl = 0;
    }
    if (!still && this.auto) {
      if (this._idle > this.resume) this._gain = Math.min(1, this._gain + dt / 1.2);
      if (this._gain > 0) cam.azimuth += this.auto * this._gain * dt;
    }
    if (this.hover && !still) {
      const k = 1 - Math.exp(-dt * 7);
      const hx = this._hx + (this._tx - this._hx) * k, hy = this._hy + (this._ty - this._hy) * k;
      cam.azimuth -= (hx - this._hx) * this.hover;
      cam.elevation = Math.max(this.min, Math.min(this.max, cam.elevation + (hy - this._hy) * this.hover * 0.6));
      this._hx = hx; this._hy = hy;
    }
  }

  dispose() {
    for (const off of this._off) off();
    this._off.length = 0;
    this.scene.svg?.classList.remove('loft-grab', 'is-dragging');
    this.scene._controllers.delete(this);
  }
}
