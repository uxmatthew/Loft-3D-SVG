import { findSpan, basisFuns, dersBasisFuns, clampedKnots, knotBreaks, binomial } from './basis.js';
import { clamp } from '../math.js';

/**
 * A non-uniform rational B-spline curve:
 *
 *   C(u) = Σ N_{i,p}(u) w_i P_i  /  Σ N_{i,p}(u) w_i
 *
 * Control points are stored in homogeneous form (w·x, w·y, w·z, w), so every
 * algorithm below is the plain B-spline algorithm run in four dimensions.
 */
export class NurbsCurve {
  /**
   * @param {object} o
   * @param {number} [o.degree=3]
   * @param {number[][]} [o.points]   control points [x, y, z]
   * @param {number[]} [o.weights]    one per point, default 1
   * @param {ArrayLike<number>} [o.knots] default: clamped uniform
   * @param {Float64Array} [o.cp]     homogeneous control points (internal)
   */
  constructor({ degree = 3, points, weights, knots, cp } = {}) {
    if (!cp) {
      if (!points || !points.length) throw new Error('NurbsCurve: no control points given');
      cp = new Float64Array(points.length * 4);
      for (let i = 0; i < points.length; i++) {
        const w = weights ? weights[i] : 1, p = points[i];
        cp[i * 4] = p[0] * w;
        cp[i * 4 + 1] = p[1] * w;
        cp[i * 4 + 2] = (p[2] || 0) * w;
        cp[i * 4 + 3] = w;
      }
    }
    this.cp = cp;
    this.count = cp.length / 4;
    this.degree = Math.min(degree, this.count - 1);
    if (this.degree < 1) throw new Error('NurbsCurve: a curve needs at least two control points');
    this.knots = knots ? Float64Array.from(knots) : clampedKnots(this.count, this.degree);
    if (this.knots.length !== this.count + this.degree + 1) {
      throw new Error(
        `NurbsCurve: expected ${this.count + this.degree + 1} knots (points + degree + 1), got ${this.knots.length}`
      );
    }
    for (let i = 1; i < this.knots.length; i++) {
      if (this.knots[i] < this.knots[i - 1]) throw new Error('NurbsCurve: knots must not decrease');
    }
    /** Bump this (or call changed()) after editing control points so renderers re-evaluate. */
    this.version = 0;
  }

  /** Parameter interval [a, b] on which the curve is defined. */
  get domain() {
    return [this.knots[this.degree], this.knots[this.count]];
  }

  /** True when the curve ends where it starts. */
  get closed() {
    const a = this.point(this.domain[0]), b = this.point(this.domain[1]);
    return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 1e-7 * (1 + Math.hypot(a[0], a[1], a[2]));
  }

  get points() {
    const out = [];
    for (let i = 0; i < this.count; i++) out.push(this.getPoint(i));
    return out;
  }

  get weights() {
    const out = [];
    for (let i = 0; i < this.count; i++) out.push(this.cp[i * 4 + 3]);
    return out;
  }

  getPoint(i) {
    const o = i * 4, w = this.cp[o + 3];
    return [this.cp[o] / w, this.cp[o + 1] / w, this.cp[o + 2] / w];
  }

  /** Move control point i; pass `w` to change its weight too. */
  setPoint(i, p, w = this.cp[i * 4 + 3]) {
    const o = i * 4;
    this.cp[o] = p[0] * w;
    this.cp[o + 1] = p[1] * w;
    this.cp[o + 2] = (p[2] || 0) * w;
    this.cp[o + 3] = w;
    this.version++;
    return this;
  }

  setWeight(i, w) {
    return this.setPoint(i, this.getPoint(i), w);
  }

  changed() {
    this.version++;
    return this;
  }

  /** Point on the curve at parameter u (clamped to the domain). */
  point(u, out = [0, 0, 0]) {
    const p = this.degree, U = this.knots, n = this.count - 1, cp = this.cp;
    u = clamp(u, U[p], U[n + 1]);
    const span = findSpan(n, p, u, U);
    const N = basisFuns(span, u, p, U);
    let x = 0, y = 0, z = 0, w = 0;
    for (let k = 0; k <= p; k++) {
      const o = (span - p + k) * 4, b = N[k];
      x += b * cp[o]; y += b * cp[o + 1]; z += b * cp[o + 2]; w += b * cp[o + 3];
    }
    out[0] = x / w; out[1] = y / w; out[2] = z / w;
    return out;
  }

  /** Point at a fraction t ∈ [0, 1] of the domain. */
  at(t, out) {
    const [a, b] = this.domain;
    return this.point(a + (b - a) * t, out);
  }

  /**
   * Derivatives of the rational curve at u: [C(u), C'(u), C''(u), …] up to order d.
   * The homogeneous derivatives are divided out with the quotient rule (A4.2).
   */
  derivatives(u, d = 1) {
    const p = this.degree, U = this.knots, n = this.count - 1, cp = this.cp;
    u = clamp(u, U[p], U[n + 1]);
    const span = findSpan(n, p, u, U);
    const du = Math.min(d, p);
    const nd = dersBasisFuns(span, u, p, du, U);
    const A = [], W = [];
    for (let k = 0; k <= d; k++) {
      let x = 0, y = 0, z = 0, w = 0;
      if (k <= du) {
        for (let j = 0; j <= p; j++) {
          const o = (span - p + j) * 4, b = nd[k][j];
          x += b * cp[o]; y += b * cp[o + 1]; z += b * cp[o + 2]; w += b * cp[o + 3];
        }
      }
      A.push([x, y, z]);
      W.push(w);
    }
    const CK = [];
    for (let k = 0; k <= d; k++) {
      const v = A[k].slice();
      for (let i = 1; i <= k; i++) {
        const b = binomial(k, i) * W[i];
        v[0] -= b * CK[k - i][0]; v[1] -= b * CK[k - i][1]; v[2] -= b * CK[k - i][2];
      }
      CK.push([v[0] / W[0], v[1] / W[0], v[2] / W[0]]);
    }
    return CK;
  }

  /** Unit tangent at u. */
  tangent(u) {
    let [, d] = this.derivatives(u, 1);
    let l = Math.hypot(d[0], d[1], d[2]);
    if (l < 1e-12) {
      // Coincident control points give a zero derivative; fall back to a short chord.
      const [a, b] = this.domain, h = (b - a) * 1e-4;
      const p0 = this.point(Math.max(a, u - h)), p1 = this.point(Math.min(b, u + h));
      d = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
      l = Math.hypot(d[0], d[1], d[2]) || 1;
    }
    return [d[0] / l, d[1] / l, d[2] / l];
  }

  /** Parameters that sample each polynomial span `perSpan` times, always landing on the knots. */
  params(perSpan = 8) {
    const br = knotBreaks(this.knots, this.degree, this.count);
    const out = [];
    for (let s = 0; s < br.length - 1; s++) {
      for (let k = 0; k < perSpan; k++) out.push(br[s] + ((br[s + 1] - br[s]) * k) / perSpan);
    }
    out.push(br[br.length - 1]);
    return out;
  }

  /** `count` points evenly spaced in parameter. */
  sample(count = 32) {
    const out = [];
    for (let i = 0; i < count; i++) out.push(this.at(count === 1 ? 0 : i / (count - 1)));
    return out;
  }

  /** Approximate arc length. */
  length(perSpan = 16) {
    const us = this.params(perSpan);
    let total = 0, prev = this.point(us[0]);
    for (let i = 1; i < us.length; i++) {
      const q = this.point(us[i]);
      total += Math.hypot(q[0] - prev[0], q[1] - prev[1], q[2] - prev[2]);
      prev = q;
    }
    return total;
  }

  clone() {
    return new NurbsCurve({ degree: this.degree, knots: this.knots, cp: this.cp.slice() });
  }

  /** A copy moved by a 4×4 matrix. NURBS are affinely invariant: transforming the control points transforms the curve. */
  transform(m) {
    const c = this.clone();
    transformHomogeneous(c.cp, m);
    return c;
  }

  /** The same curve traversed the other way. */
  reverse() {
    const n = this.count, cp = new Float64Array(n * 4), U = this.knots, m = U.length;
    for (let i = 0; i < n; i++) cp.set(this.cp.subarray((n - 1 - i) * 4, (n - i) * 4), i * 4);
    const knots = new Float64Array(m), a = U[0], b = U[m - 1];
    for (let i = 0; i < m; i++) knots[i] = a + b - U[m - 1 - i];
    return new NurbsCurve({ degree: this.degree, knots, cp });
  }
}

/** Apply an affine 4×4 matrix to homogeneous control points in place. */
export function transformHomogeneous(cp, m) {
  for (let o = 0; o < cp.length; o += 4) {
    const x = cp[o], y = cp[o + 1], z = cp[o + 2], w = cp[o + 3];
    cp[o] = m[0] * x + m[4] * y + m[8] * z + m[12] * w;
    cp[o + 1] = m[1] * x + m[5] * y + m[9] * z + m[13] * w;
    cp[o + 2] = m[2] * x + m[6] * y + m[10] * z + m[14] * w;
  }
}
