import { findSpan, basisFuns, dersBasisFuns, clampedKnots } from './basis.js';
import { NurbsCurve, transformHomogeneous } from './curve.js';
import { clamp } from '../math.js';

/**
 * A tensor-product NURBS surface:
 *
 *   S(u, v) = Σ_i Σ_j N_{i,p}(u) N_{j,q}(v) w_ij P_ij  /  Σ_i Σ_j N_{i,p}(u) N_{j,q}(v) w_ij
 *
 * The control net is a countU × countV grid stored row-major in homogeneous
 * form: point (i, j) starts at index (i · countV + j) · 4.
 */
export class NurbsSurface {
  /**
   * @param {object} o
   * @param {number} [o.degreeU=3]
   * @param {number} [o.degreeV=3]
   * @param {number[][][]} [o.points]  points[i][j] = [x, y, z]
   * @param {number[][]} [o.weights]   weights[i][j], default 1
   * @param {ArrayLike<number>} [o.knotsU]
   * @param {ArrayLike<number>} [o.knotsV]
   * @param {Float64Array} [o.cp]      homogeneous net (internal), with countU and countV
   */
  constructor({ degreeU = 3, degreeV = 3, points, weights, knotsU, knotsV, cp, countU, countV } = {}) {
    if (!cp) {
      if (!points || !points.length || !points[0].length) throw new Error('NurbsSurface: no control net given');
      countU = points.length;
      countV = points[0].length;
      cp = new Float64Array(countU * countV * 4);
      for (let i = 0; i < countU; i++) {
        if (points[i].length !== countV) throw new Error('NurbsSurface: every row of the control net needs the same length');
        for (let j = 0; j < countV; j++) {
          const w = weights ? weights[i][j] : 1, p = points[i][j], o = (i * countV + j) * 4;
          cp[o] = p[0] * w; cp[o + 1] = p[1] * w; cp[o + 2] = (p[2] || 0) * w; cp[o + 3] = w;
        }
      }
    }
    this.cp = cp;
    this.countU = countU;
    this.countV = countV;
    this.degreeU = Math.min(degreeU, countU - 1);
    this.degreeV = Math.min(degreeV, countV - 1);
    if (this.degreeU < 1 || this.degreeV < 1) throw new Error('NurbsSurface: the control net needs at least 2 × 2 points');
    this.knotsU = knotsU ? Float64Array.from(knotsU) : clampedKnots(countU, this.degreeU);
    this.knotsV = knotsV ? Float64Array.from(knotsV) : clampedKnots(countV, this.degreeV);
    if (this.knotsU.length !== countU + this.degreeU + 1 || this.knotsV.length !== countV + this.degreeV + 1) {
      throw new Error('NurbsSurface: each knot vector needs (points + degree + 1) values');
    }
    this.version = 0;
  }

  get domainU() {
    return [this.knotsU[this.degreeU], this.knotsU[this.countU]];
  }

  get domainV() {
    return [this.knotsV[this.degreeV], this.knotsV[this.countV]];
  }

  getPoint(i, j) {
    const o = (i * this.countV + j) * 4, w = this.cp[o + 3];
    return [this.cp[o] / w, this.cp[o + 1] / w, this.cp[o + 2] / w];
  }

  getWeight(i, j) {
    return this.cp[(i * this.countV + j) * 4 + 3];
  }

  /** Move control point (i, j); pass `w` to change its weight too. */
  setPoint(i, j, p, w = this.getWeight(i, j)) {
    const o = (i * this.countV + j) * 4;
    this.cp[o] = p[0] * w; this.cp[o + 1] = p[1] * w; this.cp[o + 2] = (p[2] || 0) * w; this.cp[o + 3] = w;
    this.version++;
    return this;
  }

  setWeight(i, j, w) {
    return this.setPoint(i, j, this.getPoint(i, j), w);
  }

  /** Call after editing `cp` directly so renderers re-evaluate. */
  changed() {
    this.version++;
    return this;
  }

  /** Point on the surface at (u, v), clamped to the domain. */
  point(u, v, out = [0, 0, 0]) {
    const p = this.degreeU, q = this.degreeV, U = this.knotsU, V = this.knotsV;
    const n = this.countU - 1, m = this.countV - 1, cp = this.cp, nv = this.countV;
    u = clamp(u, U[p], U[n + 1]);
    v = clamp(v, V[q], V[m + 1]);
    const su = findSpan(n, p, u, U), sv = findSpan(m, q, v, V);
    const Nu = Float64Array.from(basisFuns(su, u, p, U).subarray(0, p + 1));
    const Nv = basisFuns(sv, v, q, V);
    let x = 0, y = 0, z = 0, w = 0;
    for (let k = 0; k <= p; k++) {
      const row = (su - p + k) * nv;
      for (let l = 0; l <= q; l++) {
        const o = (row + sv - q + l) * 4, b = Nu[k] * Nv[l];
        x += b * cp[o]; y += b * cp[o + 1]; z += b * cp[o + 2]; w += b * cp[o + 3];
      }
    }
    out[0] = x / w; out[1] = y / w; out[2] = z / w;
    return out;
  }

  /** Point at fractions (s, t) ∈ [0, 1]² of the domain. */
  at(s, t, out) {
    const [a, b] = this.domainU, [c, d] = this.domainV;
    return this.point(a + (b - a) * s, c + (d - c) * t, out);
  }

  /** Point and first partial derivatives at (u, v). */
  derivatives(u, v) {
    const p = this.degreeU, q = this.degreeV, U = this.knotsU, V = this.knotsV;
    const n = this.countU - 1, m = this.countV - 1, cp = this.cp, nv = this.countV;
    u = clamp(u, U[p], U[n + 1]);
    v = clamp(v, V[q], V[m + 1]);
    const su = findSpan(n, p, u, U), sv = findSpan(m, q, v, V);
    const Du = dersBasisFuns(su, u, p, 1, U), Dv = dersBasisFuns(sv, v, q, 1, V);
    const S = [0, 0, 0, 0], Su = [0, 0, 0, 0], Sv = [0, 0, 0, 0];
    for (let k = 0; k <= p; k++) {
      const row = (su - p + k) * nv;
      for (let l = 0; l <= q; l++) {
        const o = (row + sv - q + l) * 4;
        const b = Du[0][k] * Dv[0][l], bu = Du[1][k] * Dv[0][l], bv = Du[0][k] * Dv[1][l];
        for (let c = 0; c < 4; c++) {
          const val = cp[o + c];
          S[c] += b * val; Su[c] += bu * val; Sv[c] += bv * val;
        }
      }
    }
    const w = S[3];
    const point = [S[0] / w, S[1] / w, S[2] / w];
    const du = [0, 1, 2].map((c) => (Su[c] - Su[3] * point[c]) / w);
    const dv = [0, 1, 2].map((c) => (Sv[c] - Sv[3] * point[c]) / w);
    return { point, du, dv };
  }

  /** Unit normal S_u × S_v at (u, v). */
  normal(u, v) {
    const { du, dv } = this.derivatives(u, v);
    const x = du[1] * dv[2] - du[2] * dv[1];
    const y = du[2] * dv[0] - du[0] * dv[2];
    const z = du[0] * dv[1] - du[1] * dv[0];
    const l = Math.hypot(x, y, z) || 1;
    return [x / l, y / l, z / l];
  }

  /** The curve on the surface where one parameter is held fixed: isoCurve('u', 0.5) runs along v. */
  isoCurve(fixed, value) {
    const nu = this.countU, nv = this.countV, cp = this.cp;
    if (fixed === 'u') {
      const p = this.degreeU, U = this.knotsU;
      const u = clamp(value, U[p], U[nu]);
      const span = findSpan(nu - 1, p, u, U), N = basisFuns(span, u, p, U);
      const out = new Float64Array(nv * 4);
      for (let j = 0; j < nv; j++) {
        for (let k = 0; k <= p; k++) {
          const o = ((span - p + k) * nv + j) * 4;
          for (let c = 0; c < 4; c++) out[j * 4 + c] += N[k] * cp[o + c];
        }
      }
      return new NurbsCurve({ degree: this.degreeV, knots: this.knotsV, cp: out });
    }
    const q = this.degreeV, V = this.knotsV;
    const v = clamp(value, V[q], V[nv]);
    const span = findSpan(nv - 1, q, v, V), N = basisFuns(span, v, q, V);
    const out = new Float64Array(nu * 4);
    for (let i = 0; i < nu; i++) {
      for (let l = 0; l <= q; l++) {
        const o = (i * nv + span - q + l) * 4;
        for (let c = 0; c < 4; c++) out[i * 4 + c] += N[l] * cp[o + c];
      }
    }
    return new NurbsCurve({ degree: this.degreeU, knots: this.knotsU, cp: out });
  }

  clone() {
    return new NurbsSurface({
      degreeU: this.degreeU, degreeV: this.degreeV,
      knotsU: this.knotsU, knotsV: this.knotsV,
      cp: this.cp.slice(), countU: this.countU, countV: this.countV,
    });
  }

  /** A copy moved by a 4×4 matrix. */
  transform(m) {
    const s = this.clone();
    transformHomogeneous(s.cp, m);
    return s;
  }

  /** True when both surfaces share degrees, knots and net size, so their control nets can be blended. */
  matches(other) {
    return (
      this.degreeU === other.degreeU && this.degreeV === other.degreeV &&
      this.countU === other.countU && this.countV === other.countV &&
      sameKnots(this.knotsU, other.knotsU) && sameKnots(this.knotsV, other.knotsV)
    );
  }
}

function sameKnots(a, b) {
  if (a.length !== b.length) return false;
  const span = a[a.length - 1] - a[0] || 1, sb = b[b.length - 1] - b[0] || 1;
  for (let i = 0; i < a.length; i++) {
    if (Math.abs((a[i] - a[0]) / span - (b[i] - b[0]) / sb) > 1e-9) return false;
  }
  return true;
}
