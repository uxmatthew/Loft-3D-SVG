import { lookAt, clamp } from '../math.js';

/**
 * An orbiting camera: it looks at `target` from an azimuth (around the vertical
 * axis) and an elevation (above the horizon), in radians. Setting any property
 * schedules a redraw of the scene it belongs to.
 */
export class Camera {
  constructor(o = {}) {
    this._scene = null;
    this._v = {
      azimuth: o.azimuth ?? 0.6,
      elevation: o.elevation ?? 0.35,
      distance: o.distance ?? 6,
      fov: o.fov ?? 28,
      zoom: o.zoom ?? 1,
      roll: o.roll ?? 0,
      swing: 0,
      orthographic: !!o.orthographic,
    };
    this._target = (o.target || [0, 0, 0]).slice();
    this._userTarget = !!o.target;
    if (o.position) this.position = o.position;
    this.view = new Float64Array(16);
  }

  get target() { return this._target; }
  set target(v) { this._target = v.slice(); this._userTarget = true; this._touch(); }

  /** Camera position in world space. Setting it sets azimuth, elevation and distance. */
  get position() {
    const { azimuth: a, elevation: e, distance: d } = this._v, t = this._target;
    return [t[0] + d * Math.cos(e) * Math.sin(a), t[1] + d * Math.sin(e), t[2] + d * Math.cos(e) * Math.cos(a)];
  }
  set position(p) {
    const t = this._target, x = p[0] - t[0], y = p[1] - t[1], z = p[2] - t[2];
    const d = Math.hypot(x, y, z) || 1;
    this._v.distance = d;
    this._v.elevation = Math.asin(clamp(y / d, -1, 1));
    this._v.azimuth = Math.atan2(x, z);
    this._touch();
  }

  _touch() { this._scene?.invalidate(); }

  /** Recompute the view matrix. */
  update() {
    const e = clamp(this._v.elevation, -1.55, 1.55);
    const { distance: d, roll } = this._v, t = this._target, a = this._v.azimuth + this._v.swing;
    const eye = [t[0] + d * Math.cos(e) * Math.sin(a), t[1] + d * Math.sin(e), t[2] + d * Math.cos(e) * Math.cos(a)];
    lookAt(eye, t, [Math.sin(roll), Math.cos(roll), 0], this.view);
    return this.view;
  }
}

for (const key of ['azimuth', 'elevation', 'distance', 'fov', 'zoom', 'roll', 'swing', 'orthographic']) {
  Object.defineProperty(Camera.prototype, key, {
    get() { return this._v[key]; },
    set(v) { if (this._v[key] !== v) { this._v[key] = v; this._touch(); } },
    enumerable: true,
  });
}
