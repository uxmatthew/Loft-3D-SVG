var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/nurbs/basis.js
var scratch = [];
function buffers(p) {
  return scratch[p] || (scratch[p] = {
    N: new Float64Array(p + 1),
    left: new Float64Array(p + 1),
    right: new Float64Array(p + 1)
  });
}
function findSpan(n, p, u, U) {
  if (u >= U[n + 1]) return n;
  if (u <= U[p]) return p;
  let low = p, high = n + 1, mid = low + high >> 1;
  while (u < U[mid] || u >= U[mid + 1]) {
    if (u < U[mid]) high = mid;
    else low = mid;
    mid = low + high >> 1;
  }
  return mid;
}
function basisFuns(span, u, p, U, out) {
  const { N, left, right } = buffers(p);
  const R = out || N;
  R[0] = 1;
  for (let j = 1; j <= p; j++) {
    left[j] = u - U[span + 1 - j];
    right[j] = U[span + j] - u;
    let saved = 0;
    for (let r = 0; r < j; r++) {
      const temp = R[r] / (right[r + 1] + left[j - r]);
      R[r] = saved + right[r + 1] * temp;
      saved = left[j - r] * temp;
    }
    R[j] = saved;
  }
  return R;
}
function dersBasisFuns(span, u, p, nd, U) {
  const ndu = [];
  for (let i = 0; i <= p; i++) ndu.push(new Float64Array(p + 1));
  const left = new Float64Array(p + 1), right = new Float64Array(p + 1);
  ndu[0][0] = 1;
  for (let j = 1; j <= p; j++) {
    left[j] = u - U[span + 1 - j];
    right[j] = U[span + j] - u;
    let saved = 0;
    for (let r = 0; r < j; r++) {
      ndu[j][r] = right[r + 1] + left[j - r];
      const temp = ndu[r][j - 1] / ndu[j][r];
      ndu[r][j] = saved + right[r + 1] * temp;
      saved = left[j - r] * temp;
    }
    ndu[j][j] = saved;
  }
  const ders = [];
  for (let k = 0; k <= nd; k++) ders.push(new Float64Array(p + 1));
  for (let j = 0; j <= p; j++) ders[0][j] = ndu[j][p];
  const a = [new Float64Array(p + 1), new Float64Array(p + 1)];
  for (let r = 0; r <= p; r++) {
    let s1 = 0, s2 = 1;
    a[0][0] = 1;
    for (let k = 1; k <= nd; k++) {
      let d = 0;
      const rk = r - k, pk = p - k;
      if (r >= k) {
        a[s2][0] = a[s1][0] / ndu[pk + 1][rk];
        d = a[s2][0] * ndu[rk][pk];
      }
      const j1 = rk >= -1 ? 1 : -rk;
      const j2 = r - 1 <= pk ? k - 1 : p - r;
      for (let j = j1; j <= j2; j++) {
        a[s2][j] = (a[s1][j] - a[s1][j - 1]) / ndu[pk + 1][rk + j];
        d += a[s2][j] * ndu[rk + j][pk];
      }
      if (r <= pk) {
        a[s2][k] = -a[s1][k - 1] / ndu[pk + 1][r];
        d += a[s2][k] * ndu[r][pk];
      }
      ders[k][r] = d;
      const t = s1;
      s1 = s2;
      s2 = t;
    }
  }
  let f = p;
  for (let k = 1; k <= nd; k++) {
    for (let j = 0; j <= p; j++) ders[k][j] *= f;
    f *= p - k;
  }
  return ders;
}
function clampedKnots(count, degree) {
  const U = new Float64Array(count + degree + 1);
  const spans = count - degree;
  for (let i = 0; i < U.length; i++) {
    U[i] = i <= degree ? 0 : i >= count ? 1 : (i - degree) / spans;
  }
  return U;
}
function uniformKnots(count, degree) {
  const U = new Float64Array(count + degree + 1);
  const spans = count - degree;
  for (let i = 0; i < U.length; i++) U[i] = (i - degree) / spans;
  return U;
}
function knotBreaks(U, degree, count) {
  const a = U[degree], b = U[count];
  const out = [a];
  for (let i = degree + 1; i < count; i++) {
    if (U[i] > out[out.length - 1] + 1e-12 && U[i] < b - 1e-12) out.push(U[i]);
  }
  out.push(b);
  return out;
}
function binomial(n, k) {
  let r = 1;
  for (let i = 1; i <= k; i++) r = r * (n - k + i) / i;
  return r;
}

// src/math.js
var math_exports = {};
__export(math_exports, {
  EPS: () => EPS,
  TAU: () => TAU,
  add: () => add,
  clamp: () => clamp,
  compose: () => compose,
  cross: () => cross,
  distance: () => distance,
  dot: () => dot,
  identity: () => identity,
  length: () => length,
  lerp: () => lerp,
  lookAt: () => lookAt,
  mix: () => mix,
  multiply: () => multiply,
  normalize: () => normalize,
  perpendicular: () => perpendicular,
  rotation: () => rotation,
  scale: () => scale,
  scaling: () => scaling,
  sub: () => sub,
  transformDirection: () => transformDirection,
  transformPoint: () => transformPoint,
  translation: () => translation
});
var TAU = Math.PI * 2;
var EPS = 1e-9;
var clamp = (x, lo, hi) => x < lo ? lo : x > hi ? hi : x;
var lerp = (a, b, t) => a + (b - a) * t;
var add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
var sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
var scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
var dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
var cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0]
];
var length = (a) => Math.hypot(a[0], a[1], a[2]);
var distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
var mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
function normalize(a) {
  const l = length(a);
  return l > 1e-14 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 0, 0];
}
function perpendicular(v) {
  const a = Math.abs(v[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  return normalize(cross(v, a));
}
function identity(out = new Float64Array(16)) {
  out.fill(0);
  out[0] = out[5] = out[10] = out[15] = 1;
  return out;
}
function multiply(a, b, out = new Float64Array(16)) {
  const r = out === a || out === b ? new Float64Array(16) : out;
  for (let c = 0; c < 4; c++) {
    const b0 = b[c * 4], b1 = b[c * 4 + 1], b2 = b[c * 4 + 2], b3 = b[c * 4 + 3];
    r[c * 4] = a[0] * b0 + a[4] * b1 + a[8] * b2 + a[12] * b3;
    r[c * 4 + 1] = a[1] * b0 + a[5] * b1 + a[9] * b2 + a[13] * b3;
    r[c * 4 + 2] = a[2] * b0 + a[6] * b1 + a[10] * b2 + a[14] * b3;
    r[c * 4 + 3] = a[3] * b0 + a[7] * b1 + a[11] * b2 + a[15] * b3;
  }
  if (r !== out) out.set(r);
  return out;
}
function compose(p, r, s, out = new Float64Array(16)) {
  const a = Math.cos(r[0]), b = Math.sin(r[0]);
  const c = Math.cos(r[1]), d = Math.sin(r[1]);
  const e = Math.cos(r[2]), f = Math.sin(r[2]);
  const ae = a * e, af = a * f, be = b * e, bf = b * f;
  out[0] = c * e * s[0];
  out[1] = (af + be * d) * s[0];
  out[2] = (bf - ae * d) * s[0];
  out[3] = 0;
  out[4] = -c * f * s[1];
  out[5] = (ae - bf * d) * s[1];
  out[6] = (be + af * d) * s[1];
  out[7] = 0;
  out[8] = d * s[2];
  out[9] = -b * c * s[2];
  out[10] = a * c * s[2];
  out[11] = 0;
  out[12] = p[0];
  out[13] = p[1];
  out[14] = p[2];
  out[15] = 1;
  return out;
}
function translation(v) {
  const m = identity();
  m[12] = v[0];
  m[13] = v[1];
  m[14] = v[2];
  return m;
}
function scaling(v) {
  const s = typeof v === "number" ? [v, v, v] : v;
  const m = identity();
  m[0] = s[0];
  m[5] = s[1];
  m[10] = s[2];
  return m;
}
function rotation(axis, angle) {
  const [x, y, z] = normalize(axis);
  const c = Math.cos(angle), s = Math.sin(angle), t = 1 - c;
  const m = identity();
  m[0] = t * x * x + c;
  m[1] = t * x * y + s * z;
  m[2] = t * x * z - s * y;
  m[4] = t * x * y - s * z;
  m[5] = t * y * y + c;
  m[6] = t * y * z + s * x;
  m[8] = t * x * z + s * y;
  m[9] = t * y * z - s * x;
  m[10] = t * z * z + c;
  return m;
}
function lookAt(eye, target, up, out = new Float64Array(16)) {
  let z = normalize(sub(eye, target));
  if (length(z) === 0) z = [0, 0, 1];
  let x = normalize(cross(up, z));
  if (length(x) === 0) x = perpendicular(z);
  const y = cross(z, x);
  out[0] = x[0];
  out[1] = y[0];
  out[2] = z[0];
  out[3] = 0;
  out[4] = x[1];
  out[5] = y[1];
  out[6] = z[1];
  out[7] = 0;
  out[8] = x[2];
  out[9] = y[2];
  out[10] = z[2];
  out[11] = 0;
  out[12] = -dot(x, eye);
  out[13] = -dot(y, eye);
  out[14] = -dot(z, eye);
  out[15] = 1;
  return out;
}
function transformPoint(m, p) {
  return [
    m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
    m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
    m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]
  ];
}
function transformDirection(m, v) {
  return [
    m[0] * v[0] + m[4] * v[1] + m[8] * v[2],
    m[1] * v[0] + m[5] * v[1] + m[9] * v[2],
    m[2] * v[0] + m[6] * v[1] + m[10] * v[2]
  ];
}

// src/nurbs/curve.js
var NurbsCurve = class _NurbsCurve {
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
      if (!points || !points.length) throw new Error("NurbsCurve: no control points given");
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
    if (this.degree < 1) throw new Error("NurbsCurve: a curve needs at least two control points");
    this.knots = knots ? Float64Array.from(knots) : clampedKnots(this.count, this.degree);
    if (this.knots.length !== this.count + this.degree + 1) {
      throw new Error(
        `NurbsCurve: expected ${this.count + this.degree + 1} knots (points + degree + 1), got ${this.knots.length}`
      );
    }
    for (let i = 1; i < this.knots.length; i++) {
      if (this.knots[i] < this.knots[i - 1]) throw new Error("NurbsCurve: knots must not decrease");
    }
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
      x += b * cp[o];
      y += b * cp[o + 1];
      z += b * cp[o + 2];
      w += b * cp[o + 3];
    }
    out[0] = x / w;
    out[1] = y / w;
    out[2] = z / w;
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
          x += b * cp[o];
          y += b * cp[o + 1];
          z += b * cp[o + 2];
          w += b * cp[o + 3];
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
        v[0] -= b * CK[k - i][0];
        v[1] -= b * CK[k - i][1];
        v[2] -= b * CK[k - i][2];
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
      const [a, b] = this.domain, h = (b - a) * 1e-4;
      const p0 = this.point(Math.max(a, u - h)), p1 = this.point(Math.min(b, u + h));
      d = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
      l = Math.hypot(d[0], d[1], d[2]) || 1;
    }
    return [d[0] / l, d[1] / l, d[2] / l];
  }
  /** Parameters that sample each polynomial span `perSpan` times, always landing on the knots. */
  params(perSpan2 = 8) {
    const br = knotBreaks(this.knots, this.degree, this.count);
    const out = [];
    for (let s = 0; s < br.length - 1; s++) {
      for (let k = 0; k < perSpan2; k++) out.push(br[s] + (br[s + 1] - br[s]) * k / perSpan2);
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
  length(perSpan2 = 16) {
    const us = this.params(perSpan2);
    let total = 0, prev = this.point(us[0]);
    for (let i = 1; i < us.length; i++) {
      const q = this.point(us[i]);
      total += Math.hypot(q[0] - prev[0], q[1] - prev[1], q[2] - prev[2]);
      prev = q;
    }
    return total;
  }
  clone() {
    return new _NurbsCurve({ degree: this.degree, knots: this.knots, cp: this.cp.slice() });
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
    return new _NurbsCurve({ degree: this.degree, knots, cp });
  }
};
function transformHomogeneous(cp, m) {
  for (let o = 0; o < cp.length; o += 4) {
    const x = cp[o], y = cp[o + 1], z = cp[o + 2], w = cp[o + 3];
    cp[o] = m[0] * x + m[4] * y + m[8] * z + m[12] * w;
    cp[o + 1] = m[1] * x + m[5] * y + m[9] * z + m[13] * w;
    cp[o + 2] = m[2] * x + m[6] * y + m[10] * z + m[14] * w;
  }
}

// src/nurbs/surface.js
var NurbsSurface = class _NurbsSurface {
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
      if (!points || !points.length || !points[0].length) throw new Error("NurbsSurface: no control net given");
      countU = points.length;
      countV = points[0].length;
      cp = new Float64Array(countU * countV * 4);
      for (let i = 0; i < countU; i++) {
        if (points[i].length !== countV) throw new Error("NurbsSurface: every row of the control net needs the same length");
        for (let j = 0; j < countV; j++) {
          const w = weights ? weights[i][j] : 1, p = points[i][j], o = (i * countV + j) * 4;
          cp[o] = p[0] * w;
          cp[o + 1] = p[1] * w;
          cp[o + 2] = (p[2] || 0) * w;
          cp[o + 3] = w;
        }
      }
    }
    this.cp = cp;
    this.countU = countU;
    this.countV = countV;
    this.degreeU = Math.min(degreeU, countU - 1);
    this.degreeV = Math.min(degreeV, countV - 1);
    if (this.degreeU < 1 || this.degreeV < 1) throw new Error("NurbsSurface: the control net needs at least 2 \xD7 2 points");
    this.knotsU = knotsU ? Float64Array.from(knotsU) : clampedKnots(countU, this.degreeU);
    this.knotsV = knotsV ? Float64Array.from(knotsV) : clampedKnots(countV, this.degreeV);
    if (this.knotsU.length !== countU + this.degreeU + 1 || this.knotsV.length !== countV + this.degreeV + 1) {
      throw new Error("NurbsSurface: each knot vector needs (points + degree + 1) values");
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
    this.cp[o] = p[0] * w;
    this.cp[o + 1] = p[1] * w;
    this.cp[o + 2] = (p[2] || 0) * w;
    this.cp[o + 3] = w;
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
        x += b * cp[o];
        y += b * cp[o + 1];
        z += b * cp[o + 2];
        w += b * cp[o + 3];
      }
    }
    out[0] = x / w;
    out[1] = y / w;
    out[2] = z / w;
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
          S[c] += b * val;
          Su[c] += bu * val;
          Sv[c] += bv * val;
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
    if (fixed === "u") {
      const p = this.degreeU, U = this.knotsU;
      const u = clamp(value, U[p], U[nu]);
      const span2 = findSpan(nu - 1, p, u, U), N2 = basisFuns(span2, u, p, U);
      const out2 = new Float64Array(nv * 4);
      for (let j = 0; j < nv; j++) {
        for (let k = 0; k <= p; k++) {
          const o = ((span2 - p + k) * nv + j) * 4;
          for (let c = 0; c < 4; c++) out2[j * 4 + c] += N2[k] * cp[o + c];
        }
      }
      return new NurbsCurve({ degree: this.degreeV, knots: this.knotsV, cp: out2 });
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
    return new _NurbsSurface({
      degreeU: this.degreeU,
      degreeV: this.degreeV,
      knotsU: this.knotsU,
      knotsV: this.knotsV,
      cp: this.cp.slice(),
      countU: this.countU,
      countV: this.countV
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
    return this.degreeU === other.degreeU && this.degreeV === other.degreeV && this.countU === other.countU && this.countV === other.countV && sameKnots(this.knotsU, other.knotsU) && sameKnots(this.knotsV, other.knotsV);
  }
};
function sameKnots(a, b) {
  if (a.length !== b.length) return false;
  const span = a[a.length - 1] - a[0] || 1, sb = b[b.length - 1] - b[0] || 1;
  for (let i = 0; i < a.length; i++) {
    if (Math.abs((a[i] - a[0]) / span - (b[i] - b[0]) / sb) > 1e-9) return false;
  }
  return true;
}

// src/nurbs/ops.js
var TOL = 1e-9;
function copy4(dst, di, src, si) {
  di *= 4;
  si *= 4;
  dst[di] = src[si];
  dst[di + 1] = src[si + 1];
  dst[di + 2] = src[si + 2];
  dst[di + 3] = src[si + 3];
}
function refineKnots(p, U, Pw, X) {
  if (!X.length) return { knots: Float64Array.from(U), cp: Float64Array.from(Pw) };
  const n = Pw.length / 4 - 1, r = X.length - 1, m = n + p + 1;
  const a = findSpan(n, p, X[0], U), b = findSpan(n, p, X[r], U) + 1;
  const Q2 = new Float64Array((n + r + 2) * 4), Ub = new Float64Array(m + r + 2);
  for (let j = 0; j <= a - p; j++) copy4(Q2, j, Pw, j);
  for (let j = b - 1; j <= n; j++) copy4(Q2, j + r + 1, Pw, j);
  for (let j = 0; j <= a; j++) Ub[j] = U[j];
  for (let j = b + p; j <= m; j++) Ub[j + r + 1] = U[j];
  let i = b + p - 1, k = b + p + r;
  for (let j = r; j >= 0; j--) {
    while (X[j] <= U[i] && i > a) {
      copy4(Q2, k - p - 1, Pw, i - p - 1);
      Ub[k] = U[i];
      k--;
      i--;
    }
    copy4(Q2, k - p - 1, Q2, k - p);
    for (let l = 1; l <= p; l++) {
      const ind = k - p + l;
      let alfa = Ub[k + l] - X[j];
      if (Math.abs(alfa) === 0) {
        copy4(Q2, ind - 1, Q2, ind);
      } else {
        alfa /= Ub[k + l] - U[i - p + l];
        for (let c = 0; c < 4; c++) {
          Q2[(ind - 1) * 4 + c] = alfa * Q2[(ind - 1) * 4 + c] + (1 - alfa) * Q2[ind * 4 + c];
        }
      }
    }
    Ub[k] = X[j];
    k--;
  }
  return { knots: Ub, cp: Q2 };
}
function multiplicity(U, t) {
  let s = 0;
  for (let i = 0; i < U.length; i++) if (Math.abs(U[i] - t) < TOL) s++;
  return s;
}
function interior(curve2, X) {
  const [a, b] = curve2.domain;
  return X.filter((x) => x > a + TOL && x < b - TOL).sort((x, y) => x - y);
}
function refineCurve(curve2, X) {
  const { knots, cp } = refineKnots(curve2.degree, curve2.knots, curve2.cp, interior(curve2, Array.from(X)));
  return new NurbsCurve({ degree: curve2.degree, knots, cp });
}
function insertKnot(curve2, u, times = 1) {
  const room = curve2.degree - multiplicity(curve2.knots, u);
  return refineCurve(curve2, new Array(Math.max(0, Math.min(times, room))).fill(u));
}
function refineSurface(surface2, dir, X) {
  const { countU: nu, countV: nv, cp } = surface2;
  const U = dir === "u" ? surface2.knotsU : surface2.knotsV;
  const p = dir === "u" ? surface2.degreeU : surface2.degreeV;
  const lo = U[p], hi = U[dir === "u" ? nu : nv];
  X = Array.from(X).filter((x) => x > lo + TOL && x < hi - TOL).sort((a, b) => a - b);
  if (!X.length) return surface2.clone();
  const len = dir === "u" ? nu : nv, lines2 = dir === "u" ? nv : nu, len2 = len + X.length;
  const out = new Float64Array(len2 * lines2 * 4), row = new Float64Array(len * 4);
  let knots;
  for (let l = 0; l < lines2; l++) {
    for (let i = 0; i < len; i++) {
      copy4(row, i, cp, dir === "u" ? i * nv + l : l * nv + i);
    }
    const r = refineKnots(p, U, row, X);
    knots = r.knots;
    for (let i = 0; i < len2; i++) {
      copy4(out, dir === "u" ? i * lines2 + l : l * len2 + i, r.cp, i);
    }
  }
  return new NurbsSurface({
    degreeU: surface2.degreeU,
    degreeV: surface2.degreeV,
    knotsU: dir === "u" ? knots : surface2.knotsU,
    knotsV: dir === "v" ? knots : surface2.knotsV,
    cp: out,
    countU: dir === "u" ? len2 : nu,
    countV: dir === "v" ? len2 : nv
  });
}
function subcurve(curve2, a = curve2.domain[0], b = curve2.domain[1]) {
  const p = curve2.degree;
  const X = [];
  for (const t of [a, b]) {
    const need = p - multiplicity(curve2.knots, t);
    for (let i = 0; i < need; i++) X.push(t);
  }
  X.sort((x, y) => x - y);
  const { knots: U, cp } = refineKnots(p, curve2.knots, curve2.cp, X);
  let lastA = -1;
  const inner = [];
  for (let i = 0; i < U.length; i++) {
    if (Math.abs(U[i] - a) < TOL) lastA = i;
    else if (U[i] > a && U[i] < b - TOL) inner.push(U[i]);
  }
  const count = inner.length + p + 1, start = lastA - p;
  const knots = new Float64Array(count + p + 1);
  for (let i = 0; i <= p; i++) knots[i] = a;
  knots.set(inner, p + 1);
  for (let i = count; i < knots.length; i++) knots[i] = b;
  return new NurbsCurve({ degree: p, knots, cp: cp.slice(start * 4, (start + count) * 4) });
}
function splitCurve(curve2, u) {
  const [a, b] = curve2.domain;
  return [subcurve(curve2, a, u), subcurve(curve2, u, b)];
}
function toBezier(curve2) {
  const c = subcurve(curve2), p = c.degree;
  const X = [];
  for (let i = p + 1; i < c.count; ) {
    const t = c.knots[i];
    let s = 0;
    while (i < c.count && Math.abs(c.knots[i] - t) < TOL) {
      s++;
      i++;
    }
    for (let k = s; k < p; k++) X.push(t);
  }
  const { knots, cp } = refineKnots(p, c.knots, c.cp, X);
  const segments = (cp.length / 4 - 1) / p, out = [];
  for (let s = 0; s < segments; s++) {
    const a = knots[s * p + p], b = knots[s * p + p + 1];
    const k = new Float64Array(2 * p + 2);
    k.fill(a, 0, p + 1);
    k.fill(b, p + 1);
    out.push(new NurbsCurve({ degree: p, knots: k, cp: cp.slice(s * p * 4, (s * p + p + 1) * 4) }));
  }
  return out;
}
function elevateDegree(curve2, times = 1) {
  let segs = toBezier(curve2);
  let p = curve2.degree;
  for (let t = 0; t < times; t++) {
    segs = segs.map((s) => {
      const q = new Float64Array((p + 2) * 4);
      for (let i = 0; i <= p + 1; i++) {
        const a = i / (p + 1);
        for (let c = 0; c < 4; c++) {
          q[i * 4 + c] = (i > 0 ? a * s.cp[(i - 1) * 4 + c] : 0) + (i <= p ? (1 - a) * s.cp[i * 4 + c] : 0);
        }
      }
      const k = new Float64Array(2 * p + 4);
      k.fill(s.knots[0], 0, p + 2);
      k.fill(s.knots[s.knots.length - 1], p + 2);
      return new NurbsCurve({ degree: p + 1, knots: k, cp: q });
    });
    p++;
  }
  return stitch(segs, p);
}
function stitch(segs, p) {
  const count = segs.length * p + 1;
  const cp = new Float64Array(count * 4), knots = new Float64Array(count + p + 1);
  let ki = 0;
  for (let i = 0; i <= p; i++) knots[ki++] = segs[0].knots[0];
  segs.forEach((s, si) => {
    cp.set(si === 0 ? s.cp : s.cp.subarray(4), (si === 0 ? 0 : si * p + 1) * 4);
    const end = s.knots[s.knots.length - 1];
    const reps = si === segs.length - 1 ? p + 1 : p;
    for (let i = 0; i < reps; i++) knots[ki++] = end;
  });
  return new NurbsCurve({ degree: p, knots, cp });
}
function joinCurves(curves) {
  const p = Math.max(...curves.map((c) => c.degree));
  const parts = curves.map((c) => {
    c = subcurve(c);
    return c.degree < p ? elevateDegree(c, p - c.degree) : c;
  });
  const cps = [], knots = [];
  let prevW = 1;
  parts.forEach((c, k) => {
    const [a, b] = c.domain, cp2 = c.cp.slice();
    if (k > 0) {
      const prev = cps[cps.length - 1];
      const end = prev.subarray(prev.length - 4);
      const s = prevW / cp2[3];
      for (let i = 0; i < cp2.length; i++) cp2[i] *= s;
      const gap = Math.hypot(end[0] - cp2[0], end[1] - cp2[1], end[2] - cp2[2]);
      if (gap > 1e-6 * (1 + Math.abs(prevW))) {
        throw new Error(`joinCurves: curve ${k} does not start where curve ${k - 1} ends`);
      }
    }
    prevW = cp2[cp2.length - 1];
    cps.push(k === 0 ? cp2 : cp2.subarray(4));
    const inner = Array.from(c.knots.subarray(p + 1, c.count)).map((u) => k + (u - a) / (b - a));
    if (k === 0) for (let i = 0; i <= p; i++) knots.push(0);
    knots.push(...inner);
    for (let i = 0; i < (k === parts.length - 1 ? p + 1 : p); i++) knots.push(k + 1);
  });
  const total = cps.reduce((s, c) => s + c.length, 0), cp = new Float64Array(total);
  let o = 0;
  for (const c of cps) {
    cp.set(c, o);
    o += c.length;
  }
  return new NurbsCurve({ degree: p, knots, cp });
}
function makeCompatible(curves) {
  const p = Math.max(...curves.map((c) => c.degree));
  let list = curves.map((c) => {
    c = subcurve(c);
    if (c.degree < p) c = elevateDegree(c, p - c.degree);
    const [a, b] = c.domain, knots2 = c.knots.map((u) => (u - a) / (b - a));
    return new NurbsCurve({ degree: p, knots: knots2, cp: c.cp });
  });
  const union = [];
  for (const c of list) {
    const mine = Array.from(c.knots.subarray(p + 1, c.count));
    let i = 0;
    for (let k = 0; k < mine.length; ) {
      const t = mine[k];
      let s = 0;
      while (k < mine.length && Math.abs(mine[k] - t) < TOL) {
        s++;
        k++;
      }
      while (i < union.length && union[i].t < t - TOL) i++;
      if (i < union.length && Math.abs(union[i].t - t) < TOL) union[i].s = Math.max(union[i].s, s);
      else union.splice(i, 0, { t, s });
    }
  }
  list = list.map((c) => {
    const X = [];
    for (const { t, s } of union) {
      const have = multiplicity(c.knots.subarray(p + 1, c.count), t);
      for (let k = have; k < s; k++) X.push(t);
    }
    return X.length ? refineCurve(c, X) : c;
  });
  const knots = list[0].knots;
  return list.map((c) => new NurbsCurve({ degree: p, knots, cp: c.cp }));
}

// src/nurbs/fit.js
function chordParams(points, alpha = 1) {
  const n = points.length, t = new Float64Array(n);
  let total = 0;
  for (let i = 1; i < n; i++) {
    const a = points[i - 1], b = points[i];
    total += Math.pow(Math.hypot(b[0] - a[0], b[1] - a[1], (b[2] || 0) - (a[2] || 0)), alpha);
    t[i] = total;
  }
  for (let i = 1; i < n; i++) t[i] = total > 0 ? t[i] / total : i / (n - 1);
  t[n - 1] = 1;
  return t;
}
function averagedKnots(params, p) {
  const n = params.length - 1, U = new Float64Array(n + p + 2);
  for (let i = n + 1; i < U.length; i++) U[i] = 1;
  for (let j = 1; j <= n - p; j++) {
    let s = 0;
    for (let i = j; i < j + p; i++) s += params[i];
    U[j + p] = s / p;
  }
  return U;
}
function interpolationSolver(params, p) {
  const n = params.length - 1, size = n + 1;
  const U = averagedKnots(params, p);
  const A = new Float64Array(size * size);
  for (let k = 0; k <= n; k++) {
    const span = findSpan(n, p, params[k], U), N = basisFuns(span, params[k], p, U);
    for (let j = 0; j <= p; j++) A[k * size + span - p + j] = N[j];
  }
  const piv = new Int32Array(size);
  for (let i = 0; i < size; i++) piv[i] = i;
  for (let c = 0; c < size; c++) {
    let best = c, max = Math.abs(A[c * size + c]);
    for (let r = c + 1; r < size; r++) {
      const v = Math.abs(A[r * size + c]);
      if (v > max) {
        max = v;
        best = r;
      }
    }
    if (max < 1e-14) throw new Error("interpolate: points are degenerate (two samples share a parameter)");
    if (best !== c) {
      for (let k = 0; k < size; k++) {
        const t2 = A[c * size + k];
        A[c * size + k] = A[best * size + k];
        A[best * size + k] = t2;
      }
      const t = piv[c];
      piv[c] = piv[best];
      piv[best] = t;
    }
    for (let r = c + 1; r < size; r++) {
      const f = A[r * size + c] /= A[c * size + c];
      if (f !== 0) for (let k = c + 1; k < size; k++) A[r * size + k] -= f * A[c * size + k];
    }
  }
  const solve = (b) => {
    const x = new Float64Array(size);
    for (let i = 0; i < size; i++) {
      let s = b[piv[i]];
      for (let k = 0; k < i; k++) s -= A[i * size + k] * x[k];
      x[i] = s;
    }
    for (let i = size - 1; i >= 0; i--) {
      let s = x[i];
      for (let k = i + 1; k < size; k++) s -= A[i * size + k] * x[k];
      x[i] = s / A[i * size + i];
    }
    return x;
  };
  return { knots: U, solve };
}
function interpolate(points, { degree = 3, centripetal = true } = {}) {
  if (points.length < 2) throw new Error("interpolate: at least two points are needed");
  const p = Math.min(degree, points.length - 1);
  const params = chordParams(points, centripetal ? 0.5 : 1);
  const { knots, solve } = interpolationSolver(params, p);
  const n = points.length, cp = new Float64Array(n * 4), col = new Float64Array(n);
  for (let c = 0; c < 3; c++) {
    for (let i = 0; i < n; i++) col[i] = points[i][c] || 0;
    const x = solve(col);
    for (let i = 0; i < n; i++) cp[i * 4 + c] = x[i];
  }
  for (let i = 0; i < n; i++) cp[i * 4 + 3] = 1;
  return new NurbsCurve({ degree: p, knots, cp });
}

// src/nurbs/make.js
function line(a, b) {
  return new NurbsCurve({ degree: 1, points: [a, b] });
}
function polyline(points, { closed = false } = {}) {
  const pts = closed ? [...points, points[0]] : points;
  return new NurbsCurve({ degree: 1, points: pts });
}
function curve(points, { degree = 3, closed = false, weights } = {}) {
  if (!closed) return new NurbsCurve({ degree, points, weights });
  const p = Math.min(degree, points.length - 1);
  const pts = [...points, ...points.slice(0, p)];
  const w = weights ? [...weights, ...weights.slice(0, p)] : void 0;
  return new NurbsCurve({ degree: p, points: pts, weights: w, knots: uniformKnots(pts.length, p) });
}
function arc({
  center = [0, 0, 0],
  radius = 1,
  radiusY = radius,
  start = 0,
  end = TAU,
  xAxis = [1, 0, 0],
  yAxis = [0, 1, 0]
} = {}) {
  let theta = end - start;
  if (theta <= 0) theta += TAU;
  theta = Math.min(theta, TAU);
  const narcs = Math.max(1, Math.ceil(theta / (Math.PI / 2) - 1e-9));
  const dth = theta / narcs, w1 = Math.cos(dth / 2);
  const X = normalize(xAxis), Y = normalize(yAxis);
  const at = (ang, k) => add(center, add(scale(X, radius * k * Math.cos(ang)), scale(Y, radiusY * k * Math.sin(ang))));
  const points = [], weights = [];
  for (let i = 0; i <= 2 * narcs; i++) {
    const ang = start + i * dth / 2;
    if (i % 2 === 0) {
      points.push(at(ang, 1));
      weights.push(1);
    } else {
      points.push(at(ang, 1 / w1));
      weights.push(w1);
    }
  }
  const knots = [0, 0, 0];
  for (let i = 1; i < narcs; i++) knots.push(i / narcs, i / narcs);
  knots.push(1, 1, 1);
  return new NurbsCurve({ degree: 2, points, weights, knots });
}
function circle({ radius = 1, center = [0, 0, 0], normal } = {}) {
  if (!normal) return arc({ radius, center });
  const n = normalize(normal), x = perpendicular(n);
  return arc({ radius, center, xAxis: x, yAxis: cross(n, x) });
}
function ellipse({ radiusX = 1, radiusY = 0.6, center = [0, 0, 0] } = {}) {
  return arc({ radius: radiusX, radiusY, center });
}
function surface(grid, { degreeU = 3, degreeV = 3, closedU = false, closedV = false, weights } = {}) {
  let pts = grid, w = weights;
  const p = Math.min(degreeU, grid.length - 1), q = Math.min(degreeV, grid[0].length - 1);
  if (closedV) {
    pts = pts.map((row) => [...row, ...row.slice(0, q)]);
    if (w) w = w.map((row) => [...row, ...row.slice(0, q)]);
  }
  if (closedU) {
    pts = [...pts, ...pts.slice(0, p)];
    if (w) w = [...w, ...w.slice(0, p)];
  }
  return new NurbsSurface({
    degreeU: p,
    degreeV: q,
    points: pts,
    weights: w,
    knotsU: closedU ? uniformKnots(pts.length, p) : clampedKnots(pts.length, p),
    knotsV: closedV ? uniformKnots(pts[0].length, q) : clampedKnots(pts[0].length, q)
  });
}
function plane({ width = 2, depth = 2, segments = [1, 1], degree = 3 } = {}) {
  const [su, sv] = segments, grid = [];
  for (let i = 0; i <= su; i++) {
    const row = [];
    for (let j = 0; j <= sv; j++) row.push([(i / su - 0.5) * width, 0, (0.5 - j / sv) * depth]);
    grid.push(row);
  }
  return surface(grid, { degreeU: Math.min(degree, su), degreeV: Math.min(degree, sv) });
}
function extrude(profile, vector = [0, 1, 0]) {
  const n = profile.count, cp = new Float64Array(n * 2 * 4);
  for (let i = 0; i < n; i++) {
    const w = profile.cp[i * 4 + 3];
    for (let c = 0; c < 3; c++) {
      cp[i * 2 * 4 + c] = profile.cp[i * 4 + c];
      cp[(i * 2 + 1) * 4 + c] = profile.cp[i * 4 + c] + vector[c] * w;
    }
    cp[i * 2 * 4 + 3] = cp[(i * 2 + 1) * 4 + 3] = w;
  }
  return new NurbsSurface({
    degreeU: profile.degree,
    degreeV: 1,
    knotsU: profile.knots,
    knotsV: [0, 0, 1, 1],
    cp,
    countU: n,
    countV: 2
  });
}
function ruled(a, b) {
  return loft([a, b], { degree: 1 });
}
function revolve(profile, { axis = [0, 1, 0], origin = [0, 0, 0], angle = TAU, start = 0 } = {}) {
  const T = normalize(axis);
  const theta = Math.min(Math.abs(angle), TAU) || TAU;
  const narcs = Math.max(1, Math.ceil(theta / (Math.PI / 2) - 1e-9));
  const dth = theta / narcs, wm = Math.cos(dth / 2);
  const nu = 2 * narcs + 1, nv = profile.count;
  const cp = new Float64Array(nu * nv * 4);
  for (let j = 0; j < nv; j++) {
    const w = profile.cp[j * 4 + 3];
    const P = [profile.cp[j * 4] / w, profile.cp[j * 4 + 1] / w, profile.cp[j * 4 + 2] / w];
    const O = add(origin, scale(T, dot(sub(P, origin), T)));
    let X = sub(P, O);
    const r = length(X);
    X = r > 1e-12 ? scale(X, 1 / r) : [0, 0, 0];
    const Y = cross(T, X);
    for (let i = 0; i < nu; i++) {
      const ang = start + i * dth / 2, odd = i % 2 === 1;
      const k = odd ? r / wm : r, wi = odd ? w * wm : w;
      const Q2 = add(O, add(scale(X, k * Math.cos(ang)), scale(Y, k * Math.sin(ang))));
      const o = (i * nv + j) * 4;
      cp[o] = Q2[0] * wi;
      cp[o + 1] = Q2[1] * wi;
      cp[o + 2] = Q2[2] * wi;
      cp[o + 3] = wi;
    }
  }
  const knotsU = [0, 0, 0];
  for (let i = 1; i < narcs; i++) knotsU.push(i / narcs, i / narcs);
  knotsU.push(1, 1, 1);
  return new NurbsSurface({ degreeU: 2, degreeV: profile.degree, knotsU, knotsV: profile.knots, cp, countU: nu, countV: nv });
}
function sphere({ radius = 1 } = {}) {
  return revolve(arc({ radius, start: -Math.PI / 2, end: Math.PI / 2 }));
}
function torus({ radius = 1, tube: tube2 = 0.4 } = {}) {
  return revolve(arc({ radius: tube2, center: [radius, 0, 0] }));
}
function cylinder({ radius = 1, height = 2, caps = true } = {}) {
  const h = height / 2;
  const pts = caps ? [[0, -h, 0], [radius, -h, 0], [radius, h, 0], [0, h, 0]] : [[radius, -h, 0], [radius, h, 0]];
  return revolve(polyline(pts));
}
function cone({ radius = 1, height = 2, top = 0, caps = true } = {}) {
  const h = height / 2, pts = [];
  if (caps) pts.push([0, -h, 0]);
  pts.push([radius, -h, 0], [top, h, 0]);
  if (caps && top > 0) pts.push([0, h, 0]);
  return revolve(polyline(pts));
}
function capsule({ radius = 0.5, height = 2 } = {}) {
  const h = Math.max(0, height / 2 - radius);
  const parts = [arc({ radius, center: [0, -h, 0], start: -Math.PI / 2, end: 0 })];
  if (h > 0) parts.push(line([radius, -h, 0], [radius, h, 0]));
  parts.push(arc({ radius, center: [0, h, 0], start: 0, end: Math.PI / 2 }));
  return revolve(joinCurves(parts));
}
function loft(sections, { degree = 3, interpolate: through = true, closed = false } = {}) {
  if (sections.length < 2) throw new Error("loft: at least two sections are needed");
  const curves = makeCompatible(sections);
  const n = curves[0].count, K = curves.length, p = curves[0].degree;
  const q = Math.min(degree, K - 1);
  let rows = curves.map((c) => c.cp), knotsV;
  if (closed) {
    rows = [...rows, ...rows.slice(0, q)];
    knotsV = uniformKnots(rows.length, q);
  } else if (through && K > 2) {
    const params = new Float64Array(K);
    let used = 0;
    for (let i = 0; i < n; i++) {
      const d = new Float64Array(K);
      let total = 0;
      for (let k = 1; k < K; k++) {
        const a = rows[k - 1], b = rows[k], o = i * 4;
        const dx = b[o] / b[o + 3] - a[o] / a[o + 3];
        const dy = b[o + 1] / b[o + 3] - a[o + 1] / a[o + 3];
        const dz = b[o + 2] / b[o + 3] - a[o + 2] / a[o + 3];
        d[k] = Math.hypot(dx, dy, dz);
        total += d[k];
      }
      if (total < 1e-12) continue;
      used++;
      let acc = 0;
      for (let k = 1; k < K; k++) {
        acc += d[k];
        params[k] += acc / total;
      }
    }
    for (let k = 1; k < K; k++) params[k] = used ? params[k] / used : k / (K - 1);
    params[K - 1] = 1;
    const solver = interpolationSolver(params, q);
    knotsV = solver.knots;
    const solved = rows.map(() => new Float64Array(n * 4)), col = new Float64Array(K);
    for (let i = 0; i < n * 4; i++) {
      for (let k = 0; k < K; k++) col[k] = rows[k][i];
      const x = solver.solve(col);
      for (let k = 0; k < K; k++) solved[k][i] = x[k];
    }
    rows = solved;
  } else {
    knotsV = clampedKnots(K, q);
  }
  const nv = rows.length, cp = new Float64Array(n * nv * 4);
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < nv; k++) cp.set(rows[k].subarray(i * 4, i * 4 + 4), (i * nv + k) * 4);
  }
  return new NurbsSurface({ degreeU: p, degreeV: q, knotsU: curves[0].knots, knotsV, cp, countU: n, countV: nv });
}
function frames(path2, count, closed = path2.closed) {
  const [a, b] = path2.domain, out = [];
  const steps = closed ? count : count - 1;
  let t0 = path2.tangent(a), x0 = path2.point(a);
  let r = perpendicular(t0);
  const up = sub([0, 1, 0], scale(t0, t0[1]));
  if (length(up) > 0.1) r = normalize(up);
  out.push({ t: 0, origin: x0, tangent: t0, normal: r, binormal: cross(t0, r) });
  for (let i = 1; i <= steps; i++) {
    const u = a + (b - a) * i / steps;
    const x1 = path2.point(u), t1 = path2.tangent(u);
    const v1 = sub(x1, x0), c1 = dot(v1, v1);
    let rL = r, tL = t0;
    if (c1 > 1e-20) {
      rL = sub(r, scale(v1, 2 / c1 * dot(v1, r)));
      tL = sub(t0, scale(v1, 2 / c1 * dot(v1, t0)));
    }
    const v2 = sub(t1, tL), c2 = dot(v2, v2);
    r = c2 > 1e-20 ? sub(rL, scale(v2, 2 / c2 * dot(v2, rL))) : rL;
    r = normalize(sub(r, scale(t1, dot(r, t1))));
    x0 = x1;
    t0 = t1;
    out.push({ t: i / steps, origin: x1, tangent: t1, normal: r, binormal: cross(t1, r) });
  }
  if (closed) {
    const first = out[0], last = out.pop();
    const ang = Math.atan2(dot(last.normal, first.binormal), dot(last.normal, first.normal));
    for (const f of out) {
      const c = Math.cos(-ang * f.t), s = Math.sin(-ang * f.t);
      const n = add(scale(f.normal, c), scale(f.binormal, s));
      f.normal = n;
      f.binormal = cross(f.tangent, n);
    }
  }
  return out;
}
function sweep(profile, path2, { sections, scale: sc = 1, twist = 0, closed = path2.closed } = {}) {
  const spans = path2.count - path2.degree;
  const K = sections || Math.max(12, Math.min(160, spans * 2));
  const fr = frames(path2, closed ? K : K + 1, closed);
  const n = profile.count, nv = fr.length;
  const rows = fr.map((f) => {
    const s = typeof sc === "function" ? sc(f.t) : sc;
    const a = typeof twist === "function" ? twist(f.t) : twist * f.t;
    const [sx, sy] = Array.isArray(s) ? s : [s, s];
    const c = Math.cos(a), sn = Math.sin(a);
    const N = add(scale(f.normal, c), scale(f.binormal, sn));
    const B = add(scale(f.normal, -sn), scale(f.binormal, c));
    const row = new Float64Array(n * 4);
    for (let i = 0; i < n; i++) {
      const w = profile.cp[i * 4 + 3];
      const px = profile.cp[i * 4] / w * sx, py = profile.cp[i * 4 + 1] / w * sy;
      for (let k = 0; k < 3; k++) row[i * 4 + k] = (f.origin[k] + N[k] * px + B[k] * py) * w;
      row[i * 4 + 3] = w;
    }
    return row;
  });
  const q = Math.min(3, nv - 1);
  const all = closed ? [...rows, ...rows.slice(0, q)] : rows;
  const cp = new Float64Array(n * all.length * 4);
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < all.length; k++) cp.set(all[k].subarray(i * 4, i * 4 + 4), (i * all.length + k) * 4);
  }
  return new NurbsSurface({
    degreeU: profile.degree,
    degreeV: q,
    knotsU: profile.knots,
    knotsV: closed ? uniformKnots(all.length, q) : clampedKnots(all.length, q),
    cp,
    countU: n,
    countV: all.length
  });
}
function tube(path2, { radius = 0.1, sections, closed } = {}) {
  const opts = { sections, scale: radius };
  if (closed !== void 0) opts.closed = closed;
  return sweep(arc({ radius: 1 }), path2, opts);
}

// src/shapes.js
var shapes_exports = {};
__export(shapes_exports, {
  blob: () => blob,
  hull: () => hull,
  knot: () => knot,
  normalizeSize: () => normalizeSize,
  ribbon: () => ribbon,
  sheet: () => sheet,
  shell: () => shell,
  vase: () => vase
});
function vase({
  profile = [[0.4, -1], [0.72, -0.56], [0.8, -0.12], [0.55, 0.36], [0.27, 0.7], [0.29, 0.9], [0.4, 1]]
} = {}) {
  const pts = profile.map(([r, y]) => [r, y, 0]);
  const body = interpolate(pts);
  return revolve(joinCurves([line([0, pts[0][1], 0], pts[0]), body]));
}
function knot({ p = 2, q = 3, radius = 1, tube: tr = 0.2, spread = 0.42 } = {}) {
  const n = 26 * Math.max(p, q), pts = [];
  for (let i = 0; i < n; i++) {
    const t = i / n * TAU, r = radius * (1 + spread * Math.cos(q * t));
    pts.push([r * Math.cos(p * t), radius * spread * Math.sin(q * t), r * Math.sin(p * t)]);
  }
  return tube(curve(pts, { closed: true }), { radius: tr, sections: n, closed: true });
}
function shell({ turns = 2.75, growth = 0.17, height = 0.9 } = {}) {
  const n = Math.round(turns * 16), total = turns * TAU, pts = [];
  const size = (a) => Math.exp(growth * (a - total));
  for (let i = 0; i <= n; i++) {
    const a = i / n * total, s = size(a);
    pts.push([0.56 * s * Math.cos(a), height * (0.62 - s), -0.56 * s * Math.sin(a)]);
  }
  return sweep(arc({ radius: 1 }), interpolate(pts), {
    sections: n * 2,
    scale: (t) => 0.44 * size(t * total)
  });
}
function blob({ seed = 7, bumps = 0.32, rings = 5, around = 7 } = {}) {
  let s = seed >>> 0;
  const rand = () => {
    s = s + 1831565813 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  const noise = [];
  for (let j = 0; j < rings; j++) noise.push(Array.from({ length: around }, () => 1 + bumps * (rand() * 2 - 1)));
  const grid = [];
  for (let i = 0; i < around; i++) {
    const a = i / around * TAU, row = [[0, -1.05, 0], [0.5 * Math.cos(a), -1.05, -0.5 * Math.sin(a)]];
    for (let j = 0; j < rings; j++) {
      const lat = -Math.PI / 2 + Math.PI * (j + 1) / (rings + 1), r = 1.22 * noise[j][i];
      row.push([r * Math.cos(lat) * Math.cos(a), 1.1 * Math.sin(lat) * (0.9 + 0.1 * noise[j][i]), -r * Math.cos(lat) * Math.sin(a)]);
    }
    row.push([0.5 * Math.cos(a), 1.05, -0.5 * Math.sin(a)], [0, 1.05, 0]);
    grid.push(row);
  }
  return surface(grid, { closedU: true });
}
function ribbon({ width = 0.5, twist = Math.PI * 1.5, length: length2 = 3 } = {}) {
  const h = length2 / 2;
  const path2 = interpolate([[-h, -0.35, 0.3], [-h / 2, 0.3, -0.35], [0, -0.1, 0.25], [h / 2, 0.4, -0.3], [h, -0.2, 0.2]]);
  return sweep(line([-width / 2, 0, 0], [width / 2, 0, 0]), path2, { twist, sections: 28 });
}
function sheet({ width = 3, depth = 3, segments = 7 } = {}) {
  return plane({ width, depth, segments: [segments, segments] });
}
function hull({ length: length2 = 4, beam = 1.3, depth = 0.62 } = {}) {
  const at = [0, 0.06, 0.2, 0.38, 0.55, 0.72, 0.87, 0.96, 1];
  const width = [0, 0.3, 0.78, 1.04, 1.08, 0.94, 0.56, 0.2, 0];
  const deep = [0.5, 0.74, 0.96, 1.02, 1.02, 0.96, 0.84, 0.7, 0.5];
  const full = [0.1, 0.35, 0.8, 1, 1, 0.8, 0.45, 0.25, 0.1];
  const sheer = [0.34, 0.24, 0.08, 0, 0, 0.06, 0.18, 0.3, 0.42];
  const frames2 = at.map((t, k) => {
    const x = (t - 0.5) * length2, b = beam / 2 * width[k], d = depth * deep[k];
    const top = depth * sheer[k], f = full[k];
    const half = [
      [x, top, b],
      [x, top - d * 0.52, b * (0.84 + 0.2 * f)],
      [x, top - d * (0.82 + 0.18 * f), b * (0.3 + 0.42 * f)]
    ];
    const pts = [...half, [x, top - d, 0], ...half.slice().reverse().map(([px, py, pz]) => [px, py, -pz])];
    return curve(pts, { degree: 3 });
  });
  return loft(frames2, { degree: 3, interpolate: false });
}
function normalizeSize(s, radius = 1) {
  let r = 0;
  for (let i = 0; i < s.countU; i++) {
    for (let j = 0; j < s.countV; j++) {
      const p = s.getPoint(i, j);
      r = Math.max(r, Math.hypot(p[0], p[1], p[2]));
    }
  }
  return r > 0 ? s.transform(scaling(radius / r)) : s;
}

// src/render/node.js
var Triple = class {
  constructor(owner, x, y, z) {
    this._o = owner;
    this._x = x;
    this._y = y;
    this._z = z;
  }
  get x() {
    return this._x;
  }
  set x(v) {
    if (v !== this._x) {
      this._x = v;
      this._o._touch();
    }
  }
  get y() {
    return this._y;
  }
  set y(v) {
    if (v !== this._y) {
      this._y = v;
      this._o._touch();
    }
  }
  get z() {
    return this._z;
  }
  set z(v) {
    if (v !== this._z) {
      this._z = v;
      this._o._touch();
    }
  }
  set(x, y = x, z = x) {
    if (Array.isArray(x)) [x, y, z] = x;
    this._x = x;
    this._y = y;
    this._z = z;
    this._o._touch();
    return this;
  }
  toArray() {
    return [this._x, this._y, this._z];
  }
};
var Node = class {
  constructor() {
    this._position = new Triple(this, 0, 0, 0);
    this._rotation = new Triple(this, 0, 0, 0);
    this._scale = new Triple(this, 1, 1, 1);
    this.children = [];
    this.parent = null;
    this.scene = null;
    this._visible = true;
    this.local = identity();
    this.world = identity();
  }
  get position() {
    return this._position;
  }
  set position(v) {
    this._position.set(v);
  }
  get rotation() {
    return this._rotation;
  }
  set rotation(v) {
    this._rotation.set(v);
  }
  get scale() {
    return this._scale;
  }
  set scale(v) {
    this._scale.set(v);
  }
  get visible() {
    return this._visible;
  }
  set visible(v) {
    this._visible = !!v;
    this._touch();
  }
  _touch() {
    this.scene?.invalidate();
  }
  _attach(scene) {
    this.scene = scene;
    for (const c of this.children) c._attach(scene);
  }
  /** Add a child node; it then moves with this one. */
  add(child) {
    child.parent?.remove(child);
    child.parent = this;
    this.children.push(child);
    child._attach(this.scene);
    this.scene?._structureChanged();
    return child;
  }
  remove(child) {
    const i = this.children.indexOf(child);
    if (i >= 0) {
      this.children.splice(i, 1);
      child.parent = null;
      this.scene?._structureChanged();
      child._attach(null);
    }
    return this;
  }
  _updateWorld(parentWorld) {
    compose(this._position.toArray(), this._rotation.toArray(), this._scale.toArray(), this.local);
    if (parentWorld) multiply(parentWorld, this.local, this.world);
    else this.world.set(this.local);
    for (const c of this.children) c._updateWorld(this.world);
  }
  /** Visit this node and everything under it. */
  traverse(fn) {
    fn(this);
    for (const c of this.children) c.traverse(fn);
  }
};
var SurfaceMesh = class extends Node {
  constructor(geometry, material) {
    super();
    this.kind = "surface";
    this._geometry = geometry;
    this._material = material;
    this._compiled = null;
    this._grid = null;
    this._range = { u: [0, 1], v: [0, 1] };
    this.deform = null;
    this.castShadow = true;
  }
  get geometry() {
    return this._geometry;
  }
  set geometry(g) {
    this._geometry = g;
    this._grid = null;
    this.scene?._structureChanged();
  }
  get material() {
    return this._material;
  }
  set material(m) {
    this._material = m;
    this._compiled = null;
    this._grid = null;
    this._touch();
  }
  /**
   * The part of the surface that is drawn, as fractions of its parameter range.
   * Animate it to grow a surface into place: `mesh.range = { v: [0, t] }`.
   */
  get range() {
    return this._range;
  }
  set range(r) {
    this._range = { u: r.u || this._range.u, v: r.v || this._range.v };
    this._touch();
  }
};
var CurveMesh = class extends Node {
  constructor(geometry, style) {
    super();
    this.kind = "curve";
    this.geometry = geometry;
    this._material = style;
    this._compiled = null;
    this._range = [0, 1];
  }
  get material() {
    return this._material;
  }
  set material(m) {
    this._material = m;
    this._compiled = null;
    this._touch();
  }
  /** The drawn part of the curve as fractions of its length in parameter; animate it to draw the line on. */
  get range() {
    return this._range;
  }
  set range(r) {
    this._range = r;
    this._touch();
  }
};
var ShapeMesh = class extends Node {
  constructor(geometry, style) {
    super();
    this.kind = "shape";
    this._geometry = Array.isArray(geometry) ? geometry : [geometry];
    this._material = style;
    this._compiled = null;
    this._opacity = 1;
    this._layer = null;
  }
  get geometry() {
    return this._geometry;
  }
  set geometry(g) {
    this._geometry = Array.isArray(g) ? g : [g];
    this.scene?._structureChanged();
  }
  get material() {
    return this._material;
  }
  set material(m) {
    this._material = m;
    this._compiled = null;
    this._touch();
  }
  /** 0 to 1, on top of the style's own opacity. Stepped in twentieths so animating it stays cheap. */
  get opacity() {
    return this._opacity;
  }
  set opacity(v) {
    v = Math.round(Math.max(0, Math.min(1, v)) * 20) / 20;
    if (v !== this._opacity) {
      this._opacity = v;
      this._compiled = null;
      this._touch();
    }
  }
  get layer() {
    return this._layer;
  }
  set layer(v) {
    this._layer = v;
    this._touch();
  }
};
var PointsMesh = class extends Node {
  constructor(points, style) {
    super();
    this.kind = "points";
    this.points = points;
    this._material = style;
    this._compiled = null;
  }
  get material() {
    return this._material;
  }
  set material(m) {
    this._material = m;
    this._compiled = null;
    this._touch();
  }
};

// src/render/camera.js
var Camera = class {
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
      orthographic: !!o.orthographic
    };
    this._target = (o.target || [0, 0, 0]).slice();
    this._userTarget = !!o.target;
    if (o.position) this.position = o.position;
    this.view = new Float64Array(16);
  }
  get target() {
    return this._target;
  }
  set target(v) {
    this._target = v.slice();
    this._userTarget = true;
    this._touch();
  }
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
  _touch() {
    this._scene?.invalidate();
  }
  /** Recompute the view matrix. */
  update() {
    const e = clamp(this._v.elevation, -1.55, 1.55);
    const { distance: d, roll } = this._v, t = this._target, a = this._v.azimuth + this._v.swing;
    const eye = [t[0] + d * Math.cos(e) * Math.sin(a), t[1] + d * Math.sin(e), t[2] + d * Math.cos(e) * Math.cos(a)];
    lookAt(eye, t, [Math.sin(roll), Math.cos(roll), 0], this.view);
    return this.view;
  }
};
for (const key of ["azimuth", "elevation", "distance", "fov", "zoom", "roll", "swing", "orthographic"]) {
  Object.defineProperty(Camera.prototype, key, {
    get() {
      return this._v[key];
    },
    set(v) {
      if (this._v[key] !== v) {
        this._v[key] = v;
        this._touch();
      }
    },
    enumerable: true
  });
}

// src/render/draw.js
var r1 = (x) => Math.round(x * 10) / 10;
var MV = new Float64Array(16);
var STRIDE = 12;
var PX = new Float64Array(8);
var PY = new Float64Array(8);
var NX = new Float64Array(8);
var NY = new Float64Array(8);
var LAYERED = 1e9;
var SPREAD = 1;
var EDGEWISE = 0.35;
var Painter = class {
  constructor() {
    this.cap = 0;
    this.count = 0;
    this.styleIds = /* @__PURE__ */ new Map();
    this.css = [];
    this.cssVersion = 0;
    this.paths = [];
    this.runStyle = [];
    this.runD = [];
    this.runs = 0;
    this.shadow = "";
    this._grow(2048);
  }
  _grow(cap) {
    const key = new Float64Array(cap), sty = new Int32Array(cap);
    const kind = new Uint8Array(cap), geo = new Float32Array(cap * STRIDE);
    if (this.cap) {
      key.set(this.key);
      sty.set(this.sty);
      kind.set(this.kind);
      geo.set(this.geo);
    }
    this.key = key;
    this.sty = sty;
    this.kind = kind;
    this.geo = geo;
    this.order = new Uint32Array(cap);
    this.cap = cap;
  }
  /** Intern a CSS declaration block; returns its id. */
  style(decl) {
    let id = this.styleIds.get(decl);
    if (id === void 0) {
      id = this.css.length;
      this.styleIds.set(decl, id);
      this.css.push(decl);
      this.cssVersion++;
    }
    return id;
  }
  resetStyles() {
    this.styleIds.clear();
    this.css.length = 0;
    this.cssVersion++;
  }
  reset() {
    this.count = 0;
    this.paths.length = 0;
    this.shadow = "";
  }
  _push(kind, style, key) {
    if (this.count === this.cap) this._grow(this.cap * 2);
    const i = this.count++;
    this.kind[i] = kind;
    this.sty[i] = style;
    this.key[i] = key;
    return i * STRIDE;
  }
  /**
   * A filled polygon of n (3..6) corners. `grow` moves every edge outward by
   * that many pixels, so neighbours overlap and no hairline of background
   * shows between them (SVG anti-aliases each shape on its own).
   */
  poly(style, key, n, X, Y, grow) {
    if (!grow) {
      const o2 = this._push(n, style, key), g2 = this.geo;
      for (let i = 0; i < n; i++) {
        g2[o2 + i * 2] = X[i];
        g2[o2 + i * 2 + 1] = Y[i];
      }
      return;
    }
    let m = 0;
    for (let i = 0; i < n; i++) {
      const j = i === 0 ? n - 1 : i - 1;
      if (Math.abs(X[i] - X[j]) + Math.abs(Y[i] - Y[j]) > 1e-3) {
        PX[m] = X[i];
        PY[m++] = Y[i];
      }
    }
    if (m < 3) return;
    let area = 0;
    for (let i = 0; i < m; i++) {
      const j = i + 1 === m ? 0 : i + 1;
      const dx = PX[j] - PX[i], dy = PY[j] - PY[i], l = Math.hypot(dx, dy);
      NX[i] = dy / l;
      NY[i] = -dx / l;
      area += PX[i] * PY[j] - PX[j] * PY[i];
    }
    const s = area >= 0 ? grow : -grow;
    const o = this._push(m, style, key), g = this.geo;
    for (let i = 0; i < m; i++) {
      const h = i === 0 ? m - 1 : i - 1;
      const k = s / Math.max(0.3, 1 + NX[h] * NX[i] + NY[h] * NY[i]);
      g[o + i * 2] = PX[i] + (NX[h] + NX[i]) * k;
      g[o + i * 2 + 1] = PY[i] + (NY[h] + NY[i]) * k;
    }
  }
  seg(style, key, x0, y0, x1, y1) {
    const o = this._push(1, style, key), g = this.geo;
    g[o] = x0;
    g[o + 1] = y0;
    g[o + 2] = x1;
    g[o + 3] = y1;
  }
  dot(style, key, x, y) {
    const o = this._push(2, style, key), g = this.geo;
    g[o] = x;
    g[o + 1] = y;
  }
  path(style, key, d, alone = false) {
    const o = this._push(alone ? 7 : 0, style, key);
    this.geo[o] = this.paths.length;
    this.paths.push(d);
  }
  /** Sort far-to-near and merge runs of equal style. Results are in runStyle/runD[0..runs). */
  finish() {
    const n = this.count, key = this.key, order = this.order.subarray(0, n);
    for (let i = 0; i < n; i++) order[i] = i;
    order.sort((a, b) => key[a] - key[b] || a - b);
    const { sty, kind, geo, runStyle, runD } = this;
    let runs = 0, cur = -1, d = "", alone = false;
    for (let k = 0; k < n; k++) {
      const i = order[k], s = sty[i], o = i * STRIDE, kd = kind[i];
      if (s !== cur || alone || kd === 7) {
        if (cur >= 0) {
          runStyle[runs] = cur;
          runD[runs++] = d;
        }
        cur = s;
        d = "";
      }
      alone = kd === 7;
      if (kd >= 3 && kd < 7) {
        d += "M" + r1(geo[o]) + " " + r1(geo[o + 1]) + "L" + r1(geo[o + 2]) + " " + r1(geo[o + 3]);
        for (let v = 2; v < kd; v++) d += " " + r1(geo[o + v * 2]) + " " + r1(geo[o + v * 2 + 1]);
        d += "Z";
      } else if (kd === 1) {
        d += "M" + r1(geo[o]) + " " + r1(geo[o + 1]) + "L" + r1(geo[o + 2]) + " " + r1(geo[o + 3]);
      } else if (kd === 2) {
        d += "M" + r1(geo[o]) + " " + r1(geo[o + 1]) + "h.01";
      } else {
        d += this.paths[geo[o]];
      }
    }
    if (cur >= 0) {
      runStyle[runs] = cur;
      runD[runs++] = d;
    }
    this.runs = runs;
  }
};
function toView(pos, n, ctx, view, scr, ok) {
  const m = MV, { ortho, os, f, near, ox, oy } = ctx;
  for (let v = 0, o = 0; v < n; v++, o += 3) {
    const x = pos[o], y = pos[o + 1], z = pos[o + 2];
    const vx = m[0] * x + m[4] * y + m[8] * z + m[12];
    const vy = m[1] * x + m[5] * y + m[9] * z + m[13];
    const vz = m[2] * x + m[6] * y + m[10] * z + m[14];
    view[o] = vx;
    view[o + 1] = vy;
    view[o + 2] = vz;
    if (ortho) {
      scr[v * 2] = vx * os + ox;
      scr[v * 2 + 1] = -vy * os + oy;
      ok[v] = 1;
    } else if (vz > -near) {
      ok[v] = 0;
    } else {
      const k = f / -vz;
      scr[v * 2] = vx * k + ox;
      scr[v * 2 + 1] = -vy * k + oy;
      ok[v] = 1;
    }
  }
}
var QX = new Float64Array(8);
var QY = new Float64Array(8);
var QT = new Float64Array(8);
var AX = new Float64Array(8);
var AY = new Float64Array(8);
var AT = new Float64Array(8);
var BX = new Float64Array(8);
var BY = new Float64Array(8);
var BT = new Float64Array(8);
function clipTone(n, X, Y, T, thr, above, OX, OY, OT) {
  let m = 0;
  for (let i = 0; i < n; i++) {
    const j = i + 1 === n ? 0 : i + 1, a = T[i], b = T[j];
    const ia = above ? a >= thr : a <= thr, ib = above ? b >= thr : b <= thr;
    if (ia) {
      OX[m] = X[i];
      OY[m] = Y[i];
      OT[m++] = a;
    }
    if (ia !== ib) {
      const f = (thr - a) / (b - a);
      OX[m] = X[i] + (X[j] - X[i]) * f;
      OY[m] = Y[i] + (Y[j] - Y[i]) * f;
      OT[m++] = thr;
    }
  }
  return m;
}
function drawSurface(mesh, ctx, P) {
  const g = mesh._grid, mat = mesh._compiled;
  const { NU, NV, pos, view, screen: scr, ok, fkey, fnormal, ftone, fstate, ffacing, vnormal, vtone, vtoneBack } = g;
  if (NU < 2 || NV < 2) return;
  const NUf = NU - 1, NVf = NV - 1, nvert = NU * NV;
  multiply(ctx.view, mesh.world, MV);
  toView(pos, nvert, ctx, view, scr, ok);
  const m = MV;
  const det = m[0] * (m[5] * m[10] - m[6] * m[9]) - m[4] * (m[1] * m[10] - m[2] * m[9]) + m[8] * (m[1] * m[6] - m[2] * m[5]);
  const sign = g.sign * (mat.flip ? -1 : 1) * (det < 0 ? -1 : 1);
  const culled = mat.cull === true || mat.cull === "auto" && g.solid;
  const { ortho, eps } = ctx, [Lx, Ly, Lz] = ctx.L, [Hx, Hy, Hz] = ctx.H;
  const fill = mat.fill, lines2 = mat.lines, outline = mat.outline, dots = mat.dots;
  const ambient = fill ? fill.ambient : 0.2, wrap = fill ? fill.wrap : 0.3;
  const spec = fill ? fill.specular : 0, shin = fill ? fill.shininess : 28, backDim = fill ? fill.back : 0.78;
  const lit = 0.86 - ambient;
  const shade = (ndl, ndh) => {
    let t = ambient + lit * Math.max(0, (ndl + wrap) / (1 + wrap));
    if (spec && ndh > 0) t += spec * Math.pow(ndh, shin);
    return t < 0 ? 0 : t > 1 ? 1 : t;
  };
  const smooth = fill && fill.tones > 1 && !fill.facets;
  const spread = lines2 && lines2.spread > 0 && (lines2.u || lines2.v);
  const sh = ctx.shadow && mesh.castShadow ? ctx.shadow : null, shp = g.shadow;
  if (sh) {
    const [nx, ny, nz] = sh.n;
    for (let v = 0, o = 0; v < nvert; v++, o += 3) {
      const x = view[o], y = view[o + 1], z = view[o + 2];
      const t = Math.max(0, (nx * x + ny * y + nz * z - sh.d) / sh.nl);
      const qx = x - Lx * t, qy = y - Ly * t, qz = z - Lz * t;
      if (ortho) {
        shp[v * 2] = qx * ctx.os + ctx.ox;
        shp[v * 2 + 1] = -qy * ctx.os + ctx.oy;
      } else if (qz > -ctx.near || !ok[v]) shp[v * 2] = NaN;
      else {
        const k = ctx.f / -qz;
        shp[v * 2] = qx * k + ctx.ox;
        shp[v * 2 + 1] = -qy * k + ctx.oy;
      }
    }
  }
  let shadowD = "";
  if (smooth) vnormal.fill(0);
  for (let i = 0; i < NUf; i++) {
    for (let j = 0; j < NVf; j++) {
      const fi = i * NVf + j;
      const a = i * NV + j, b = a + NV, c = b + 1, d = a + 1;
      if (!(ok[a] && ok[b] && ok[c] && ok[d])) {
        fstate[fi] = 0;
        continue;
      }
      const a3 = a * 3, b3 = b * 3, c3 = c * 3, d3 = d * 3;
      const e1x = view[c3] - view[a3], e1y = view[c3 + 1] - view[a3 + 1], e1z = view[c3 + 2] - view[a3 + 2];
      const e2x = view[d3] - view[b3], e2y = view[d3 + 1] - view[b3 + 1], e2z = view[d3 + 2] - view[b3 + 2];
      let nx = (e1y * e2z - e1z * e2y) * sign, ny = (e1z * e2x - e1x * e2z) * sign, nz = (e1x * e2y - e1y * e2x) * sign;
      const len = Math.hypot(nx, ny, nz);
      if (len < 1e-20) {
        fstate[fi] = 0;
        continue;
      }
      nx /= len;
      ny /= len;
      nz /= len;
      if (smooth) {
        vnormal[a3] += nx;
        vnormal[a3 + 1] += ny;
        vnormal[a3 + 2] += nz;
        vnormal[b3] += nx;
        vnormal[b3 + 1] += ny;
        vnormal[b3 + 2] += nz;
        vnormal[c3] += nx;
        vnormal[c3 + 1] += ny;
        vnormal[c3 + 2] += nz;
        vnormal[d3] += nx;
        vnormal[d3 + 1] += ny;
        vnormal[d3 + 2] += nz;
      }
      const cx = (view[a3] + view[b3] + view[c3] + view[d3]) / 4;
      const cy = (view[a3 + 1] + view[b3 + 1] + view[c3 + 1] + view[d3 + 1]) / 4;
      const cz = (view[a3 + 2] + view[b3 + 2] + view[c3 + 2] + view[d3 + 2]) / 4;
      const toward = ortho ? nz : -(nx * cx + ny * cy + nz * cz), front = toward > 0;
      fnormal[fi * 3] = nx;
      fnormal[fi * 3 + 1] = ny;
      fnormal[fi * 3 + 2] = nz;
      fkey[fi] = cz;
      if (spread) ffacing[fi] = ortho ? toward : toward / Math.hypot(cx, cy, cz);
      if (sh && (!g.solid || nx * Lx + ny * Ly + nz * Lz > 0)) {
        const x0 = shp[a * 2], x1 = shp[b * 2], x2 = shp[c * 2], x3 = shp[d * 2];
        const y0 = shp[a * 2 + 1], y1 = shp[b * 2 + 1], y2 = shp[c * 2 + 1], y3 = shp[d * 2 + 1];
        const area = (x2 - x0) * (y3 - y1) - (x3 - x1) * (y2 - y0);
        if (area > 0.02) shadowD += "M" + r1(x0) + " " + r1(y0) + "L" + r1(x1) + " " + r1(y1) + " " + r1(x2) + " " + r1(y2) + " " + r1(x3) + " " + r1(y3) + "Z";
        else if (area < -0.02) shadowD += "M" + r1(x0) + " " + r1(y0) + "L" + r1(x3) + " " + r1(y3) + " " + r1(x2) + " " + r1(y2) + " " + r1(x1) + " " + r1(y1) + "Z";
      }
      if (!front && culled) {
        fstate[fi] = -1;
        continue;
      }
      fstate[fi] = front ? 1 : 2;
      const s = front ? 1 : -1;
      const t = shade((nx * Lx + ny * Ly + nz * Lz) * s, (nx * Hx + ny * Hy + nz * Hz) * s);
      ftone[fi] = front ? t : t * backDim;
    }
  }
  if (shadowD) P.shadow += shadowD;
  if (smooth) {
    const share = (v, w) => {
      for (let k = 0; k < 3; k++) {
        const sum = vnormal[v * 3 + k] + vnormal[w * 3 + k];
        vnormal[v * 3 + k] = sum;
        vnormal[w * 3 + k] = sum;
      }
    };
    if (g.closedU) for (let j = 0; j < NV; j++) share(j, NUf * NV + j);
    if (g.closedV) for (let i = 0; i < NU; i++) share(i * NV, i * NV + NVf);
    const pole = (start, stride, n) => {
      let x = 0, y = 0, z = 0;
      for (let k = 0; k < n; k++) {
        const o = (start + k * stride) * 3;
        x += vnormal[o];
        y += vnormal[o + 1];
        z += vnormal[o + 2];
      }
      for (let k = 0; k < n; k++) {
        const o = (start + k * stride) * 3;
        vnormal[o] = x;
        vnormal[o + 1] = y;
        vnormal[o + 2] = z;
      }
    };
    if (g.poles[0]) pole(0, 1, NV);
    if (g.poles[1]) pole(NUf * NV, 1, NV);
    if (g.poles[2]) pole(0, NV, NU);
    if (g.poles[3]) pole(NVf, NV, NU);
    for (let v = 0, o = 0; v < nvert; v++, o += 3) {
      const l = Math.hypot(vnormal[o], vnormal[o + 1], vnormal[o + 2]) || 1;
      const nx = vnormal[o] /= l, ny = vnormal[o + 1] /= l, nz = vnormal[o + 2] /= l;
      const ndl = nx * Lx + ny * Ly + nz * Lz, ndh = nx * Hx + ny * Hy + nz * Hz;
      vtone[v] = shade(ndl, ndh);
      if (!culled) vtoneBack[v] = shade(-ndl, -ndh) * backDim;
    }
  }
  if (fill || dots) {
    const T = fill ? fill.tones : 1, styles = fill ? fill.styles : null, grow = fill ? fill.grow : 0;
    const soft = 0.8;
    const facetAt = (i, j) => {
      if (i < 0 || i === NUf) {
        if (!g.closedU) return -1;
        i = i < 0 ? NUf - 1 : 0;
      }
      if (j < 0 || j === NVf) {
        if (!g.closedV) return -1;
        j = j < 0 ? NVf - 1 : 0;
      }
      return i * NVf + j;
    };
    const across = (f, u) => {
      const i = f / NVf | 0, a = (i * NV + f - i * NVf) * 2, b = a + NV * 2, c = b + 2, d = a + 2;
      const area = Math.abs((scr[c] - scr[a]) * (scr[d + 1] - scr[b + 1]) - (scr[d] - scr[b]) * (scr[c + 1] - scr[a + 1])) / 2;
      const sides = u ? Math.hypot(scr[c] - scr[b], scr[c + 1] - scr[b + 1]) + Math.hypot(scr[a] - scr[d], scr[a + 1] - scr[d + 1]) : Math.hypot(scr[b] - scr[a], scr[b + 1] - scr[a + 1]) + Math.hypot(scr[d] - scr[c], scr[d + 1] - scr[c + 1]);
      return sides > 1e-9 ? 2 * area / sides : 0;
    };
    const kink = outline ? outline.creaseCos : -2;
    for (let i = 0; i < NUf; i++) {
      for (let j = 0; j < NVf; j++) {
        const fi = i * NVf + j, st = fstate[fi];
        if (st <= 0) continue;
        const a = i * NV + j, b = a + NV, c = b + 1, d = a + 1, cz = fkey[fi];
        QX[0] = scr[a * 2];
        QY[0] = scr[a * 2 + 1];
        QX[1] = scr[b * 2];
        QY[1] = scr[b * 2 + 1];
        QX[2] = scr[c * 2];
        QY[2] = scr[c * 2 + 1];
        QX[3] = scr[d * 2];
        QY[3] = scr[d * 2 + 1];
        if (fill) {
          if (!smooth) {
            P.poly(styles[Math.min(T - 1, ftone[fi] * T | 0)], cz, 4, QX, QY, grow);
          } else {
            const fx = fnormal[fi * 3], fy = fnormal[fi * 3 + 1], fz = fnormal[fi * 3 + 2];
            const vt = st === 1 ? vtone : vtoneBack, flat = ftone[fi];
            let lo = T, hi = 0;
            for (let k = 0; k < 4; k++) {
              const v = k === 0 ? a : k === 1 ? b : k === 2 ? c : d;
              const t = fx * vnormal[v * 3] + fy * vnormal[v * 3 + 1] + fz * vnormal[v * 3 + 2] > soft ? vt[v] : flat;
              QT[k] = t;
              const band = Math.min(T - 1, t * T | 0);
              if (band < lo) lo = band;
              if (band > hi) hi = band;
            }
            if (lo === hi) {
              P.poly(styles[lo], cz, 4, QX, QY, grow);
            } else {
              for (let band = lo; band <= hi; band++) {
                let top = band;
                while (top < hi && styles[top + 1] === styles[band]) top++;
                let n = 4, X = QX, Y = QY, Tn = QT;
                if (band > lo) {
                  n = clipTone(n, X, Y, Tn, band / T, true, AX, AY, AT);
                  X = AX;
                  Y = AY;
                  Tn = AT;
                }
                if (top < hi && n > 2) {
                  n = clipTone(n, X, Y, Tn, (top + 1) / T, false, BX, BY, BT);
                  X = BX;
                  Y = BY;
                }
                if (n > 2 && n <= 6) P.poly(styles[band], cz, n, X, Y, grow);
                band = top;
              }
            }
          }
        }
        if (dots) {
          const ink = (dots.white - ftone[fi]) / dots.span;
          if (ink > 0) {
            const area = Math.abs((QX[2] - QX[0]) * (QY[3] - QY[1]) - (QX[3] - QX[1]) * (QY[2] - QY[0])) / 2;
            let r = Math.min(dots.size * 0.46 * Math.sqrt(area) * Math.pow(ink < 1 ? ink : 1, dots.gamma), 0.8 * Math.min(across(fi, true), across(fi, false)));
            const x = (QX[0] + QX[1] + QX[2] + QX[3]) / 4, y = (QY[0] + QY[1] + QY[2] + QY[3]) / 4;
            for (let k = 0; k < 4; k++) {
              const x0 = QX[k], y0 = QY[k], ex = QX[k + 1 & 3] - x0, ey = QY[k + 1 & 3] - y0, len = Math.hypot(ex, ey);
              if (len < 1e-6) continue;
              const nf = k === 0 ? facetAt(i, j - 1) : k === 1 ? facetAt(i + 1, j) : k === 2 ? facetAt(i, j + 1) : facetAt(i - 1, j);
              const smooth2 = nf >= 0 && fstate[nf] === st && fnormal[fi * 3] * fnormal[nf * 3] + fnormal[fi * 3 + 1] * fnormal[nf * 3 + 1] + fnormal[fi * 3 + 2] * fnormal[nf * 3 + 2] >= kink;
              r = Math.min(r, Math.abs(ex * (y - y0) - ey * (x - x0)) / len + (smooth2 ? across(nf, k % 2 === 1) : 0));
            }
            const q = Math.round(r * 8);
            if (q >= 2) {
              let key = cz;
              for (let di = -1; di <= 1; di++) {
                for (let dj = -1; dj <= 1; dj++) {
                  const nf = facetAt(i + di, j + dj);
                  if (nf >= 0 && fstate[nf] > 0 && fkey[nf] > key) key = fkey[nf];
                }
              }
              P.dot(dots.style(q), key + eps * 0.5, x, y);
            }
          }
        }
      }
    }
  }
  if (!lines2 && !outline) return;
  const hiddenMode = lines2 && !(fill && fill.grow > 0) ? lines2.hidden : 0;
  const creaseCos = outline ? outline.creaseCos : -2;
  const { zNear, zInv } = ctx;
  const edge = (va, vb, f1, f2, iso, sharp, gap, ends) => {
    const s1 = f1 >= 0 ? fstate[f1] : 0, s2 = f2 >= 0 ? fstate[f2] : 0;
    if (!s1 && !s2) return;
    const v1 = s1 > 0, v2 = s2 > 0, visible = v1 || v2;
    let kind = 0;
    if (outline) {
      if (s1 && s2) {
        if (s1 === 1 !== (s2 === 1)) kind = 1;
        else if (sharp && visible && creaseCos > -2 && fnormal[f1 * 3] * fnormal[f2 * 3] + fnormal[f1 * 3 + 1] * fnormal[f2 * 3 + 1] + fnormal[f1 * 3 + 2] * fnormal[f2 * 3 + 2] < creaseCos) kind = 1;
      } else if (outline.boundary && visible) kind = 1;
    }
    if (!kind && iso) {
      if (hiddenMode) kind = s1 === 1 || s2 === 1 ? 2 : 3;
      else kind = visible ? 2 : 0;
    }
    if (!kind) return;
    const x0 = scr[va * 2], y0 = scr[va * 2 + 1], x1 = scr[vb * 2], y1 = scr[vb * 2 + 1];
    if (Math.abs(x1 - x0) + Math.abs(y1 - y0) < 0.08) return;
    let key;
    if (visible) key = v1 && v2 ? Math.max(fkey[f1], fkey[f2]) : v1 ? fkey[f1] : fkey[f2];
    else key = s1 && s2 ? Math.max(fkey[f1], fkey[f2]) : s1 ? fkey[f1] : fkey[f2];
    if (kind === 1) {
      P.seg(outline.style, key + eps * 2, x0, y0, x1, y1);
      return;
    }
    if (kind === 3) {
      P.seg(lines2.hiddenStyle, key - eps, x0, y0, x1, y1);
      return;
    }
    let d = 0, dl = 0;
    if (lines2.shade) d = lines2.weight(v1 && v2 ? (ftone[f1] + ftone[f2]) / 2 : v1 ? ftone[f1] : ftone[f2]);
    if (gap) {
      const r = (gap[va] + gap[vb]) / 2;
      let s = lines2.spread * SPREAD * Math.tanh((r > 0 ? Math.log2(r) : -Infinity) / SPREAD);
      if (s > 0) {
        const f = v1 && v2 ? Math.min(Math.abs(ffacing[f1]), Math.abs(ffacing[f2])) : Math.abs(ffacing[v1 ? f1 : f2]);
        if (f < EDGEWISE) s *= f / EDGEWISE;
      }
      d += s;
    }
    if (lines2.depth) {
      const dn = (zNear - key) * zInv;
      dl = dn <= 0 ? 0 : dn >= 1 ? 3 : Math.round(dn * 3);
    }
    const st = lines2.style(d, dl);
    if (st < 0) return;
    if (!ends) {
      P.seg(st, key + eps, x0, y0, x1, y1);
      return;
    }
    const len = Math.hypot(x1 - x0, y1 - y0), k = Math.min(lines2.px(d) / 2, len * 0.45) / len;
    const a = ends & 1 ? k : 0, b = ends & 2 ? 1 - k : 1;
    P.seg(st, key + eps, x0 + (x1 - x0) * a, y0 + (y1 - y0) * a, x0 + (x1 - x0) * b, y0 + (y1 - y0) * b);
  };
  const { closedU, closedV } = g, isoU = lines2 && lines2.u ? g.u.iso : null, isoV = lines2 && lines2.v ? g.v.iso : null;
  const gaps = lines2 && lines2.spread && (isoU || isoV) ? g.gaps() : null;
  for (let j = 0; j < NV; j++) {
    if (j === NVf && closedV) break;
    const iso = isoV ? isoV[j] : 0, sharp = g.v.sharp[j], gap = iso && gaps ? gaps.v : null;
    if (!outline && !iso) continue;
    for (let i = 0; i < NUf; i++) {
      const below = j > 0 ? i * NVf + j - 1 : closedV ? i * NVf + NVf - 1 : -1;
      const above = j < NVf ? i * NVf + j : -1;
      const ends = closedU ? 0 : (i === 0 ? 1 : 0) | (i === NUf - 1 ? 2 : 0);
      edge(i * NV + j, (i + 1) * NV + j, below, above, iso, sharp, gap, ends);
    }
  }
  for (let i = 0; i < NU; i++) {
    if (i === NUf && closedU) break;
    const iso = isoU ? isoU[i] : 0, sharp = g.u.sharp[i], gap = iso && gaps ? gaps.u : null;
    if (!outline && !iso) continue;
    for (let j = 0; j < NVf; j++) {
      const before = i > 0 ? (i - 1) * NVf + j : closedU ? (NUf - 1) * NVf + j : -1;
      const after = i < NUf ? i * NVf + j : -1;
      const ends = closedV ? 0 : (j === 0 ? 1 : 0) | (j === NVf - 1 ? 2 : 0);
      edge(i * NV + j, i * NV + j + 1, before, after, iso, sharp, gap, ends);
    }
  }
}
function curveParams(c, per, range) {
  const br = knotBreaks(c.knots, c.degree, c.count), out = [];
  const a = br[0], b = br[br.length - 1], eps = (b - a) * 1e-9;
  const lo = a + (b - a) * Math.max(0, Math.min(1, range[0])), hi = a + (b - a) * Math.max(0, Math.min(1, range[1]));
  if (hi - lo <= eps) return new Float64Array(0);
  out.push(lo);
  for (let s = 0; s < br.length - 1; s++) {
    for (let k = 0; k < per; k++) {
      const t = br[s] + (br[s + 1] - br[s]) * k / per;
      if (t > lo + eps && t < hi - eps) out.push(t);
    }
  }
  out.push(hi);
  return Float64Array.from(out);
}
function drawCurve(mesh, ctx, P) {
  const c = mesh.geometry, mat = mesh._compiled;
  const per = c.degree === 1 ? 1 : Math.max(3, Math.round(12 * mat.detail * ctx.lod));
  const key = per + "|" + mesh._range[0] + "|" + mesh._range[1] + "|" + c.version;
  if (mesh._key !== key || mesh._geo !== c) {
    mesh._key = key;
    mesh._geo = c;
    const us = curveParams(c, per, mesh._range), n2 = us.length;
    mesh._pos = new Float64Array(n2 * 3);
    mesh._view = new Float64Array(n2 * 3);
    mesh._scr = new Float32Array(n2 * 2);
    mesh._ok = new Uint8Array(n2);
    const pt = [0, 0, 0];
    for (let i = 0; i < n2; i++) {
      c.point(us[i], pt);
      mesh._pos.set(pt, i * 3);
    }
  }
  const n = mesh._ok.length;
  if (n < 2) return;
  multiply(ctx.view, mesh.world, MV);
  const view = mesh._view, scr = mesh._scr, ok = mesh._ok;
  toView(mesh._pos, n, ctx, view, scr, ok);
  const bias = ctx.eps * 12e3;
  if (mat.dashed) {
    let d = "", z = 0, k = 0, pen = false;
    for (let i = 0; i < n; i++) {
      if (!ok[i]) {
        pen = false;
        continue;
      }
      d += (pen ? "L" : "M") + r1(scr[i * 2]) + " " + r1(scr[i * 2 + 1]);
      pen = true;
      z += view[i * 3 + 2];
      k++;
    }
    if (k > 1) P.path(mat.style(0), z / k + bias, d);
    return;
  }
  for (let i = 0; i < n - 1; i++) {
    if (!ok[i] || !ok[i + 1]) continue;
    const z = (view[i * 3 + 2] + view[i * 3 + 5]) / 2;
    let dl = 0;
    if (mat.depth) {
      const dn = (ctx.zNear - z) * ctx.zInv;
      dl = dn <= 0 ? 0 : dn >= 1 ? 3 : Math.round(dn * 3);
    }
    P.seg(mat.style(dl), z + bias, scr[i * 2], scr[i * 2 + 1], scr[i * 2 + 2], scr[i * 2 + 3]);
  }
}
var r2 = (x) => Math.round(x * 100) / 100;
var WHOLE = [0, 1];
function drawShape(mesh, ctx, P) {
  const mat = mesh._compiled, curves = mesh._geometry;
  if (mat.style < 0 || !curves.length) return;
  const per = Math.max(3, Math.round(10 * mat.detail * ctx.lod));
  let key = String(per);
  for (const c of curves) key += "|" + c.version;
  if (mesh._key !== key || mesh._geo !== curves) {
    mesh._key = key;
    mesh._geo = curves;
    const pos = [], subs2 = [], a = [0, 0, 0], b = [0, 0, 0], c3 = [0, 0, 0];
    for (const c of curves) {
      const us = curveParams(c, c.degree === 1 ? 1 : per, WHOLE);
      const closed = us.length > 2 && c.closed, n3 = closed ? us.length - 1 : us.length, start = pos.length / 3;
      for (let i = 0; i < n3; i++) {
        c.point(us[i], b);
        if (i > 0 && i < n3 - 1) {
          c.point(us[i + 1], c3);
          const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c3[0] - b[0], vy = c3[1] - b[1], vz = c3[2] - b[2];
          const cross2 = Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
          if (cross2 <= 1e-7 * Math.hypot(ux, uy, uz) * Math.hypot(vx, vy, vz) && ux * vx + uy * vy + uz * vz >= 0) continue;
        }
        pos.push(b[0], b[1], b[2]);
        a[0] = b[0];
        a[1] = b[1];
        a[2] = b[2];
      }
      subs2.push(start, pos.length / 3 - start, closed ? 1 : 0);
    }
    const n2 = pos.length / 3;
    mesh._pos = Float64Array.from(pos);
    mesh._subs = subs2;
    mesh._view = new Float64Array(n2 * 3);
    mesh._scr = new Float32Array(n2 * 2);
    mesh._ok = new Uint8Array(n2);
  }
  const n = mesh._ok.length;
  if (n < 2) return;
  multiply(ctx.view, mesh.world, MV);
  const view = mesh._view, scr = mesh._scr, ok = mesh._ok, subs = mesh._subs;
  toView(mesh._pos, n, ctx, view, scr, ok);
  let d = "", z = 0, x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let s = 0; s < subs.length; s += 3) {
    const from = subs[s], count = subs[s + 1];
    for (let i = from; i < from + count; i++) {
      if (!ok[i]) return;
      const x = scr[i * 2], y = scr[i * 2 + 1];
      d += (i === from ? "M" : i === from + 1 ? "L" : " ") + r2(x) + " " + r2(y);
      z += view[i * 3 + 2];
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
    if (subs[s + 2]) d += "Z";
  }
  if (x1 - x0 < 0.05 && y1 - y0 < 0.05) return;
  P.path(mat.style, mesh._layer != null ? LAYERED + mesh._layer : z / n + ctx.eps * 12e3, d, true);
}
function drawPoints(mesh, ctx, P) {
  const pts = mesh.points, n = pts.length, mat = mesh._compiled;
  if (!mesh._pos || mesh._pos.length !== n * 3) {
    mesh._pos = new Float64Array(n * 3);
    mesh._view = new Float64Array(n * 3);
    mesh._scr = new Float32Array(n * 2);
    mesh._ok = new Uint8Array(n);
  }
  for (let i = 0; i < n; i++) {
    mesh._pos[i * 3] = pts[i][0];
    mesh._pos[i * 3 + 1] = pts[i][1];
    mesh._pos[i * 3 + 2] = pts[i][2] || 0;
  }
  multiply(ctx.view, mesh.world, MV);
  toView(mesh._pos, n, ctx, mesh._view, mesh._scr, mesh._ok);
  const bias = ctx.eps * 2e4;
  for (let i = 0; i < n; i++) {
    if (!mesh._ok[i]) continue;
    const z = mesh._view[i * 3 + 2] + bias, x = mesh._scr[i * 2], y = mesh._scr[i * 2 + 1];
    P.dot(mat.style, z, x, y);
    if (mat.ring >= 0) P.dot(mat.ring, z + ctx.eps, x, y);
  }
}

// src/render/grid.js
function alignPerSpan(per, spans, iso) {
  if (!iso) return per;
  return Math.max(per, Math.ceil(iso * (iso >= 24 ? 1 : 2) / spans));
}
function sampleDirection(U, degree, count, per, range, iso) {
  const br = knotBreaks(U, degree, count), spans = br.length - 1;
  const total = spans * per;
  const full = [], flag = new Array(total + 1).fill(0);
  for (let k = 0; iso && k <= iso; k++) flag[Math.round(k * total / iso)] = 1;
  for (let s = 0; s < spans; s++) {
    for (let k = 0; k < per; k++) full.push(br[s] + (br[s + 1] - br[s]) * k / per);
  }
  full.push(br[spans]);
  const sharp = new Array(total + 1).fill(0);
  for (let s = 1; s < spans; s++) {
    let mult = 0;
    for (let i = degree + 1; i < count; i++) if (Math.abs(U[i] - br[s]) < 1e-12) mult++;
    if (mult >= degree) sharp[s * per] = 1;
  }
  const a = br[0], b = br[spans], eps = (b - a) * 1e-9;
  const lo = a + (b - a) * Math.max(0, Math.min(1, range[0]));
  const hi = a + (b - a) * Math.max(0, Math.min(1, range[1]));
  let params = full, flags = flag, creases = sharp, rank = full.map((_, i) => i);
  if (lo > a + eps || hi < b - eps) {
    const rankOf = (t) => {
      let i = 0;
      while (i < total - 1 && full[i + 1] <= t) i++;
      return i + (t - full[i]) / (full[i + 1] - full[i]);
    };
    params = [lo];
    flags = [0];
    creases = [0];
    rank = [rankOf(lo)];
    for (let i = 0; i < full.length; i++) {
      if (full[i] > lo + eps && full[i] < hi - eps) {
        params.push(full[i]);
        flags.push(flag[i]);
        creases.push(sharp[i]);
        rank.push(i);
      }
    }
    if (hi > lo + eps) {
      params.push(hi);
      flags.push(0);
      creases.push(0);
      rank.push(rankOf(hi));
    }
  }
  const n = params.length, p = degree;
  const span = new Int32Array(n), N = new Float64Array(n * (p + 1));
  for (let i = 0; i < n; i++) {
    span[i] = findSpan(count - 1, p, params[i], U);
    N.set(basisFuns(span[i], params[i], p, U).subarray(0, p + 1), i * (p + 1));
  }
  return { params: Float64Array.from(params), iso: Uint8Array.from(flags), sharp: Uint8Array.from(creases), rank: Float64Array.from(rank), span, N, spans };
}
function measureGaps(pos, out, iso, rank, n, stride, closed, m, step, closedAlong, tiny) {
  const period = rank[n - 1] - rank[0], perLine = [];
  for (let a = 0; a < n; a++) {
    if (!iso[a]) continue;
    let logs = 0, weight = 0;
    let a0 = a - 1, a1 = a + 1, r0 = rank[a0], r12 = rank[a1];
    if (a === 0) {
      if (closed) {
        a0 = n - 2;
        r0 = rank[a0] - period;
      } else {
        a0 = 0;
        r0 = rank[0];
      }
    }
    if (a === n - 1) {
      if (closed) {
        a1 = 1;
        r12 = rank[1] + period;
      } else {
        a1 = n - 1;
        r12 = rank[n - 1];
      }
    }
    const dr = r12 - r0;
    if (!(dr > 0)) continue;
    for (let l = 0; l < m; l++) {
      let l0 = l - 1, l1 = l + 1;
      if (l === 0) l0 = closedAlong ? m - 2 : 0;
      if (l === m - 1) l1 = closedAlong ? 1 : m - 1;
      const v = a * stride + l * step, p = (a0 * stride + l * step) * 3, q = (a1 * stride + l * step) * 3;
      const s = (a * stride + l0 * step) * 3, e = (a * stride + l1 * step) * 3;
      let dx = (pos[q] - pos[p]) / dr, dy = (pos[q + 1] - pos[p + 1]) / dr, dz = (pos[q + 2] - pos[p + 2]) / dr;
      const tx = pos[e] - pos[s], ty = pos[e + 1] - pos[s + 1], tz = pos[e + 2] - pos[s + 2], tt = tx * tx + ty * ty + tz * tz;
      if (tt > tiny) {
        const k = (dx * tx + dy * ty + dz * tz) / tt;
        dx -= k * tx;
        dy -= k * ty;
        dz -= k * tz;
      }
      const gap = Math.hypot(dx, dy, dz);
      out[v] = gap;
      if (gap > 0 && tt > tiny) {
        const w = Math.sqrt(tt) / (closedAlong || l > 0 && l < m - 1 ? 2 : 1);
        logs += w * Math.log(gap);
        weight += w;
      }
    }
    if (weight > 0) perLine.push(logs / weight);
  }
  perLine.sort((x, y) => x - y);
  const h = perLine.length >> 1;
  const usual = !perLine.length ? 1 : Math.exp(perLine.length & 1 ? perLine[h] : (perLine[h - 1] + perLine[h]) / 2);
  for (let a = 0; a < n; a++) {
    if (!iso[a]) continue;
    for (let l = 0; l < m; l++) out[a * stride + l * step] /= usual;
  }
}
var SurfaceGrid = class {
  constructor() {
    this.key = "";
    this.version = -1;
    this.NU = 0;
    this.NV = 0;
    this.pos = new Float64Array(0);
    this.center = [0, 0, 0];
    this.radius = 1;
    this.stamp = 0;
    this._gaps = null;
  }
  /** Lay out the sample grid. Cheap to call every frame: it only rebuilds when something changed. */
  build(surface2, perU, perV, range, isoU, isoV) {
    const key = [perU, perV, range.u, range.v, isoU, isoV, surface2.countU, surface2.countV].join("|");
    if (key === this.key && this.surface === surface2) return false;
    this.key = key;
    this.surface = surface2;
    this.u = sampleDirection(surface2.knotsU, surface2.degreeU, surface2.countU, perU, range.u, isoU);
    this.v = sampleDirection(surface2.knotsV, surface2.degreeV, surface2.countV, perV, range.v, isoV);
    this.NU = this.u.params.length;
    this.NV = this.v.params.length;
    const nv = this.NU * this.NV, nf = Math.max(0, (this.NU - 1) * (this.NV - 1));
    this.pos = new Float64Array(nv * 3);
    this.view = new Float64Array(nv * 3);
    this.screen = new Float32Array(nv * 2);
    this.shadow = new Float32Array(nv * 2);
    this.ok = new Uint8Array(nv);
    this.fkey = new Float64Array(nf);
    this.fnormal = new Float32Array(nf * 3);
    this.ftone = new Float32Array(nf);
    this.ffacing = new Float32Array(nf);
    this.vnormal = new Float32Array(nv * 3);
    this.vtone = new Float32Array(nv);
    this.vtoneBack = new Float32Array(nv);
    this.fstate = new Int8Array(nf);
    this.tmp = new Float64Array(surface2.countV * 4);
    this.version = -1;
    return true;
  }
  /** Compute the grid points from the current control net, then apply `deform` if given. */
  evaluate(deform, time) {
    const s = this.surface, cp = s.cp, nvc = s.countV;
    const p = s.degreeU, q = s.degreeV, { NU, NV, pos, tmp } = this;
    const us = this.u, vs = this.v;
    for (let i = 0; i < NU; i++) {
      tmp.fill(0);
      const base = us.span[i] - p;
      for (let k = 0; k <= p; k++) {
        const b = us.N[i * (p + 1) + k], row = (base + k) * nvc * 4;
        for (let j = 0; j < nvc * 4; j++) tmp[j] += b * cp[row + j];
      }
      for (let j = 0; j < NV; j++) {
        const o0 = (vs.span[j] - q) * 4;
        let x = 0, y = 0, z = 0, w = 0;
        for (let l = 0; l <= q; l++) {
          const b = vs.N[j * (q + 1) + l], o2 = o0 + l * 4;
          x += b * tmp[o2];
          y += b * tmp[o2 + 1];
          z += b * tmp[o2 + 2];
          w += b * tmp[o2 + 3];
        }
        const o = (i * NV + j) * 3;
        pos[o] = x / w;
        pos[o + 1] = y / w;
        pos[o + 2] = z / w;
      }
    }
    if (deform) {
      const pt = [0, 0, 0];
      const [ua, ub] = s.domainU, [va, vb] = s.domainV;
      for (let i = 0; i < NU; i++) {
        const u = (us.params[i] - ua) / (ub - ua);
        for (let j = 0; j < NV; j++) {
          const o = (i * NV + j) * 3;
          pt[0] = pos[o];
          pt[1] = pos[o + 1];
          pt[2] = pos[o + 2];
          deform(pt, u, (vs.params[j] - va) / (vb - va), time);
          pos[o] = pt[0];
          pos[o + 1] = pt[1];
          pos[o + 2] = pt[2];
        }
      }
    }
    this.version = s.version;
    this.stamp++;
    this.analyze();
  }
  /**
   * How far apart neighbouring iso-lines lie at every grid point on one, as a share of
   * the usual spacing on this surface: 2 where the lines have fanned out to twice it, 0.5
   * where they crowd. Measured on the surface itself, so it holds still as the view turns.
   * `u` holds it for lines of constant u, `v` for lines of constant v.
   */
  gaps() {
    const { NU, NV } = this;
    let g = this._gaps;
    if (g && g.stamp === this.stamp && g.u.length === NU * NV) return g;
    if (!g || g.u.length !== NU * NV) g = this._gaps = { u: new Float32Array(NU * NV), v: new Float32Array(NU * NV), stamp: -1 };
    const tiny = (this.radius * 1e-9) ** 2;
    measureGaps(this.pos, g.u, this.u.iso, this.u.rank, NU, NV, this.closedU, NV, 1, this.closedV, tiny);
    measureGaps(this.pos, g.v, this.v.iso, this.v.rank, NV, 1, this.closedV, NU, NV, this.closedU, tiny);
    g.stamp = this.stamp;
    return g;
  }
  /** Bounds, which edges are seams or poles, and whether the surface encloses a volume. */
  analyze() {
    const { NU, NV, pos } = this;
    let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
    for (let o = 0; o < pos.length; o += 3) {
      const x = pos[o], y = pos[o + 1], z = pos[o + 2];
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      if (z < z0) z0 = z;
      if (z > z1) z1 = z;
    }
    const c = this.center = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2];
    let r22 = 0;
    for (let o = 0; o < pos.length; o += 3) {
      const d = (pos[o] - c[0]) ** 2 + (pos[o + 1] - c[1]) ** 2 + (pos[o + 2] - c[2]) ** 2;
      if (d > r22) r22 = d;
    }
    this.radius = Math.sqrt(r22) || 1;
    const tol = this.radius * 1e-6;
    const same = (a, b) => Math.abs(pos[a * 3] - pos[b * 3]) < tol && Math.abs(pos[a * 3 + 1] - pos[b * 3 + 1]) < tol && Math.abs(pos[a * 3 + 2] - pos[b * 3 + 2]) < tol;
    const every = (n, fn) => {
      for (let i = 0; i < n; i++) if (!fn(i)) return false;
      return n > 0;
    };
    const lastU = (NU - 1) * NV;
    this.closedU = NU > 2 && every(NV, (j) => same(j, lastU + j));
    this.closedV = NV > 2 && every(NU, (i) => same(i * NV, i * NV + NV - 1));
    const poleU0 = every(NV, (j) => same(0, j)), poleU1 = every(NV, (j) => same(lastU, lastU + j));
    const poleV0 = every(NU, (i) => same(0, i * NV)), poleV1 = every(NU, (i) => same(NV - 1, i * NV + NV - 1));
    this.poles = [poleU0, poleU1, poleV0, poleV1];
    this.solid = (this.closedU || poleU0 && poleU1) && (this.closedV || poleV0 && poleV1);
    this.sign = 1;
    if (this.solid) {
      let vol = 0;
      for (let i = 0; i < NU - 1; i++) {
        for (let j = 0; j < NV - 1; j++) {
          const a = (i * NV + j) * 3, b = a + NV * 3, cc = b + 3, d = a + 3;
          vol += triple(pos, a, b, cc, c) + triple(pos, a, cc, d, c);
        }
      }
      this.sign = vol >= 0 ? 1 : -1;
    }
  }
  /**
   * For each direction: the longest polyline through the grid (object units)
   * and the most it turns (radians). Together they say how finely to dice.
   */
  extent() {
    const { NU, NV, pos } = this;
    const run = (start, stride, n) => {
      let len = 0, turn2 = 0, px = 0, py = 0, pz = 0, pl = 0;
      for (let k = 1; k < n; k++) {
        const a = (start + (k - 1) * stride) * 3, b = (start + k * stride) * 3;
        const x = pos[b] - pos[a], y = pos[b + 1] - pos[a + 1], z = pos[b + 2] - pos[a + 2];
        const l = Math.hypot(x, y, z);
        if (l < 1e-12) continue;
        if (pl) turn2 += Math.acos(Math.max(-1, Math.min(1, (x * px + y * py + z * pz) / (l * pl))));
        px = x;
        py = y;
        pz = z;
        pl = l;
        len += l;
      }
      return [len, turn2];
    };
    const out = [0, 0, 0, 0];
    for (const f of [0, 0.2, 0.4, 0.6, 0.8, 1]) {
      const u = run(Math.round(f * (NV - 1)), NV, NU), v = run(Math.round(f * (NU - 1)) * NV, 1, NV);
      if (this.closedU) u[1] = Math.max(u[1], Math.PI * 2);
      if (this.closedV) v[1] = Math.max(v[1], Math.PI * 2);
      out[0] = Math.max(out[0], u[0]);
      out[1] = Math.max(out[1], u[1]);
      out[2] = Math.max(out[2], v[0]);
      out[3] = Math.max(out[3], v[1]);
    }
    return out;
  }
};
function triple(p, a, b, c, o) {
  const ax = p[a] - o[0], ay = p[a + 1] - o[1], az = p[a + 2] - o[2];
  const bx = p[b] - o[0], by = p[b + 1] - o[1], bz = p[b + 2] - o[2];
  const cx = p[c] - o[0], cy = p[c + 1] - o[1], cz = p[c + 2] - o[2];
  return ax * (by * cz - bz * cy) + ay * (bz * cx - bx * cz) + az * (bx * cy - by * cx);
}

// src/render/color.js
var HEX = /^#([0-9a-f]{3,8})$/i;
var RGB = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i;
function parseColor(str) {
  if (typeof str !== "string") return null;
  str = str.trim();
  let m = HEX.exec(str);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join("");
    if (h.length !== 6 && h.length !== 8) return null;
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  }
  m = RGB.exec(str);
  if (m) return [m[1] / 255, m[2] / 255, m[3] / 255];
  return null;
}
var toLinear = (c) => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
var toGamma = (c) => c <= 31308e-7 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
function toOklab([r, g, b]) {
  r = toLinear(r);
  g = toLinear(g);
  b = toLinear(b);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  ];
}
function fromOklab([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    toGamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    toGamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    toGamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)
  ];
}
function toHex(rgb) {
  return "#" + rgb.map((c) => Math.round(Math.min(1, Math.max(0, c)) * 255).toString(16).padStart(2, "0")).join("");
}
function mixColors(a, b, t) {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const ca = parseColor(a), cb = parseColor(b);
  if (ca && cb) {
    const la = toOklab(ca), lb = toOklab(cb);
    return toHex(fromOklab(la.map((v, i) => v + (lb[i] - v) * t)));
  }
  return `color-mix(in oklab, ${b} ${Math.round(t * 1e3) / 10}%, ${a})`;
}
function ramp(stops, tones) {
  if (Array.isArray(stops[0])) return placedRamp(stops, tones);
  if (stops.length === 1) return new Array(Math.max(1, tones)).fill(stops[0]);
  if (stops.length === tones) return stops.slice();
  const out = [];
  for (let i = 0; i < tones; i++) {
    const x = (i + 0.5) / tones * (stops.length - 1);
    const s = Math.min(stops.length - 2, Math.floor(x));
    out.push(mixColors(stops[s], stops[s + 1], x - s));
  }
  return out;
}
function placedRamp(stops, tones) {
  const out = [], last = stops.length - 1;
  for (let i = 0, s = 0; i < tones; i++) {
    const x = (i + 0.5) / tones;
    while (s < last && stops[s + 1][0] <= x) s++;
    const [a, ca] = stops[s], [b, cb] = stops[Math.min(last, s + 1)];
    out.push(x <= a || s === last || ca === cb ? ca : mixColors(ca, cb, (x - a) / (b - a)));
  }
  return out;
}
function shadeStops(color) {
  const rgb = parseColor(color);
  if (!rgb) {
    return [
      `color-mix(in oklab, ${color}, #0a1430 58%)`,
      `color-mix(in oklab, ${color}, #0a1430 22%)`,
      color,
      `color-mix(in oklab, ${color}, #fff8ec 45%)`,
      `color-mix(in oklab, ${color}, #fffdf8 82%)`
    ];
  }
  const [L, a, b] = toOklab(rgb);
  const C = Math.hypot(a, b), h = Math.atan2(b, a);
  const toward = (target, amount) => {
    let d = target - h;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    return h + Math.sign(d) * Math.min(Math.abs(d), amount);
  };
  const cool = toward(4.62, 0.35), warm = toward(1.66, 0.22);
  const stop = (l, c, hue) => toHex(fromOklab([l, c * Math.cos(hue), c * Math.sin(hue)]));
  return [
    stop(L * 0.46, C * 0.82, cool),
    stop(L * 0.74, C * 1, toward(4.62, 0.14)),
    stop(L, C, h),
    stop(L + (1 - L) * 0.42, C * 0.7, warm),
    stop(L + (1 - L) * 0.86, C * 0.2, warm)
  ];
}

// src/render/material.js
var pick = (o, d) => ({ ...d, ...o });
var STEPS = 12;
var LIGHTEST = -7 * STEPS;
var HEAVIEST = 4 * STEPS;
var looks = {
  /** Soft matte shading, no lines. */
  clay: ({ color = "accent" } = {}) => ({
    fill: { color, tones: 20, specular: 0.14 }
  }),
  /**
   * Pulp-poster cel shading: seven flat tones and a firm outline. From shadow to light:
   * black, a deep olive and a khaki shade of the colour, a vermilion band where light
   * turns to shade, a tan, the colour itself, and a cream highlight.
   */
  toon: ({ color = "#E7CC91" } = {}) => ({
    fill: {
      color,
      tones: 7,
      ambient: 0.1,
      wrap: 0,
      specular: 0.2,
      ramp: (base) => [
        "#0B0806",
        mixColors(base, "#0B0806", 0.72),
        mixColors(base, "#0B0806", 0.45),
        "#E94225",
        mixColors(base, "#0B0806", 0.2),
        base,
        mixColors(base, "#FFF6DC", 0.45)
      ]
    },
    outline: { width: 2 }
  }),
  /** Technical pen: paper-coloured faces, outline and a few construction lines. Hidden lines are covered. */
  ink: ({ color = "paper" } = {}) => ({
    fill: { color, flat: true },
    lines: { u: 12, v: 8, width: 0.6 },
    outline: { width: 1.5 }
  }),
  /** See-through wireframe; lines on the far side fade. */
  wire: () => ({
    lines: { u: 16, v: 12, width: 0.8, hidden: "faint", depth: 0.45 },
    outline: { width: 1.1 }
  }),
  /**
   * Banknote engraving: one family of lines whose weight carries the shading. Where the
   * lines fan apart they swell, and where they crowd they thin, so the tone holds.
   */
  engrave: ({ color = "paper" } = {}) => ({
    fill: { color, flat: true },
    lines: { v: 44, width: 0.95, shade: 1, spread: 1.5 },
    outline: { width: 1.2 }
  }),
  /**
   * Dots that swell in the shadows. The lights are left bare, and in the deepest shadows
   * the dots grow past their facets and run together.
   */
  halftone: ({ color = "paper" } = {}) => ({
    fill: { color, flat: true },
    dots: { size: 1.3, gamma: 1.5, white: 0.8, black: 0.32 },
    outline: { width: 1.2 }
  })
};
var LAYERS = ["fill", "lines", "outline", "dots"];
function layer(name, v) {
  if (v === true) return {};
  if (v == null || v === false) return null;
  if (typeof v === "string") return name === "fill" ? { color: v } : { color: v };
  if (typeof v === "number") {
    if (name === "lines") return { u: v, v };
    return name === "dots" ? { size: v } : { width: v };
  }
  return v;
}
function resolveMaterial(m) {
  if (m == null) m = "clay";
  if (typeof m === "string") {
    if (!looks[m]) throw new Error(`Unknown look "${m}". Available looks: ${Object.keys(looks).join(", ")}.`);
    return looks[m]();
  }
  if (!m.look) {
    const out2 = { ...m };
    for (const k of LAYERS) out2[k] = layer(k, m[k]);
    return out2;
  }
  if (!looks[m.look]) throw new Error(`Unknown look "${m.look}". Available looks: ${Object.keys(looks).join(", ")}.`);
  const base = looks[m.look](m), out = { ...m, ...base };
  for (const k of LAYERS) {
    if (!(k in m)) continue;
    const v = layer(k, m[k]);
    out[k] = v && base[k] ? { ...base[k], ...v } : v;
  }
  return out;
}
function compileSurface(spec, env) {
  const m = resolveMaterial(spec), out = { cull: m.cull ?? "auto", flip: !!m.flip, detail: m.detail ?? 1 };
  if (m.fill) {
    const f = pick(m.fill, { color: "accent", tones: 24, ambient: 0.2, wrap: 0.3, specular: 0, shininess: 28, opacity: 1, back: 0.78 });
    const given = typeof f.ramp === "function" ? f.ramp(env.color(f.color)) : f.ramp;
    const stops = given ? given.map((s) => Array.isArray(s) ? [s[0], env.color(s[1])] : env.color(s)) : f.flat ? [env.color(f.color)] : shadeStops(env.color(f.color));
    const tones = f.flat ? 1 : Math.max(1, Math.round(f.tones));
    const op = f.opacity < 1 ? `;fill-opacity:${f.opacity}` : "";
    out.fill = {
      styles: Int32Array.from(ramp(stops, tones).map((c) => env.style(`fill:${c}${op}`))),
      tones,
      facets: !!f.facets,
      ambient: f.ambient,
      wrap: f.wrap,
      specular: f.specular,
      shininess: f.shininess,
      back: f.back,
      grow: f.opacity < 1 ? 0 : 0.45
    };
  }
  if (m.lines) {
    const l = pick(m.lines, { u: 0, v: 0, color: "ink", width: 0.8, hidden: "none", shade: 0, depth: 0, opacity: 1, spread: 0 });
    const color = env.color(l.color), cache = [];
    const decl = (w, o) => `stroke:${color};stroke-width:${Math.round(env.px(w) * 100) / 100}` + (o < 0.995 ? `;stroke-opacity:${Math.round(o * 100) / 100}` : "");
    const shade = l.shade;
    const step = (d) => {
      const s = Math.round(d * STEPS);
      return s < LIGHTEST ? LIGHTEST : s > HEAVIEST ? HEAVIEST : s;
    };
    out.lines = {
      u: l.u,
      v: l.v,
      shade,
      depth: l.depth,
      spread: Math.max(0, l.spread),
      hidden: l.hidden === "faint" ? 1 : l.hidden === "dashed" ? 2 : 0,
      /** How many doublings heavier than `width` a line is where the surface has this tone (0 dark, 1 light). */
      weight: (tone) => Math.log2(Math.max(1e-6, 1 - shade + shade * (0.06 + 2.4 * Math.pow(1 - tone, 1.4)))),
      /** The stroke width in pixels of a line `d` doublings heavier than `width`. */
      px: (d) => env.px(l.width * Math.pow(2, step(d) / STEPS)),
      /** d: doublings heavier than `width` (1 = twice as wide), dl: depth level 0..3 (3 = farthest) */
      style(d, dl) {
        const s = step(d), i = (s - LIGHTEST) * 4 + dl;
        if (cache[i] === void 0) {
          const w = l.width * Math.pow(2, s / STEPS);
          cache[i] = env.px(w) < 0.07 ? -1 : env.style(decl(w, l.opacity * (1 - l.depth * (dl / 3) * 0.85)));
        }
        return cache[i];
      }
    };
    if (out.lines.hidden === 1) out.lines.hiddenStyle = env.style(decl(l.width * 0.8, l.opacity * 0.22));
    if (out.lines.hidden === 2) {
      const d = Math.round(env.px(3) * 10) / 10;
      out.lines.hiddenStyle = env.style(decl(l.width * 0.8, l.opacity * 0.5) + `;stroke-dasharray:${d} ${d}`);
    }
  }
  if (m.outline) {
    const o = pick(m.outline, { color: "ink", width: 1.5, crease: 40, boundary: true });
    out.outline = {
      style: env.style(`stroke:${env.color(o.color)};stroke-width:${Math.round(env.px(o.width) * 100) / 100}`),
      creaseCos: o.crease === false ? -2 : Math.cos(o.crease * Math.PI / 180),
      boundary: o.boundary
    };
  }
  if (m.dots) {
    const d = pick(m.dots, { color: "ink", size: 1, gamma: 1.15, white: 1, black: 0 });
    const color = env.color(d.color), cache = /* @__PURE__ */ new Map();
    out.dots = {
      size: d.size,
      gamma: d.gamma,
      white: d.white,
      span: Math.max(1e-3, d.white - d.black),
      /** q: dot diameter in quarter pixels */
      style(q) {
        let s = cache.get(q);
        if (s === void 0) cache.set(q, s = env.style(`stroke:${color};stroke-width:${q / 4}`));
        return s;
      }
    };
  }
  return out;
}
function compileCurve(spec, env) {
  const s = pick(typeof spec === "string" ? { color: spec } : spec || {}, { color: "ink", width: 1.5, opacity: 1, depth: 0, dash: null, detail: 1 });
  const color = env.color(s.color), cache = [];
  const base = (o) => `stroke:${color};stroke-width:${Math.round(env.px(s.width) * 100) / 100}` + (o < 0.995 ? `;stroke-opacity:${Math.round(o * 100) / 100}` : "");
  const dash = s.dash ? `;stroke-dasharray:${[].concat(s.dash).map((d) => Math.round(env.px(d) * 10) / 10).join(" ")}` : "";
  return {
    dashed: !!s.dash,
    depth: s.depth,
    detail: s.detail,
    style(dl) {
      if (cache[dl] === void 0) cache[dl] = env.style(base(s.opacity * (1 - s.depth * (dl / 3) * 0.85)) + dash);
      return cache[dl];
    }
  };
}
function compileShape(spec, env, opacity = 1) {
  const s = pick(typeof spec === "string" ? { fill: spec } : spec || {}, { fill: "paper", stroke: "ink", width: 1.5, opacity: 1, dash: null, detail: 1 });
  const o = Math.round(s.opacity * opacity * 100) / 100, decl = [];
  if (s.fill) decl.push(`fill:${env.color(s.fill)}`);
  if (s.stroke && s.width > 0) {
    decl.push(`stroke:${env.color(s.stroke)}`, `stroke-width:${Math.round(env.px(s.width) * 100) / 100}`);
    if (s.dash) decl.push(`stroke-dasharray:${[].concat(s.dash).map((d) => Math.round(env.px(d) * 10) / 10).join(" ")}`);
  }
  if (o < 0.995) decl.push(`opacity:${o}`);
  return { style: decl.length && o > 5e-3 && (s.fill || decl.length > 1) ? env.style(decl.join(";")) : -1, detail: s.detail };
}
function compilePoints(spec, env) {
  const s = pick(typeof spec === "string" ? { color: spec } : spec || {}, { color: "ink", size: 5, ring: null });
  const d = Math.round(env.px(s.size) * 100) / 100;
  return {
    style: env.style(`stroke:${env.color(s.color)};stroke-width:${d}`),
    ring: s.ring ? env.style(`stroke:${env.color(s.ring)};stroke-width:${Math.max(0.5, Math.round((d - env.px(2.4)) * 100) / 100)}`) : -1
  };
}

// src/motion.js
function cubicBezier(x1, y1, x2, y2) {
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
var ease = {
  out: cubicBezier(0.2, 0.8, 0.2, 1),
  enter: cubicBezier(0.22, 1, 0.36, 1),
  inOut: cubicBezier(0.65, 0, 0.35, 1),
  linear: (t) => t
};
var awake = /* @__PURE__ */ new Set();
var raf = 0;
function frame(now) {
  try {
    for (const s of [...awake]) s._tick(now);
  } finally {
    raf = awake.size ? requestAnimationFrame(frame) : 0;
  }
}
function wake(scene) {
  awake.add(scene);
  if (!raf && typeof requestAnimationFrame === "function") raf = requestAnimationFrame(frame);
}
function sleep(scene) {
  awake.delete(scene);
}
var CSS = `
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
function injectStyles() {
  if (typeof document === "undefined" || document.getElementById("loft-styles")) return;
  const el = document.createElement("style");
  el.id = "loft-styles";
  el.textContent = CSS;
  document.head.appendChild(el);
}
var ICON_PAUSE = '<svg viewBox="0 0 12 12" aria-hidden="true"><rect x="2" y="1.5" width="3" height="9" rx=".6"/><rect x="7" y="1.5" width="3" height="9" rx=".6"/></svg>';
var ICON_PLAY = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 1.6v8.8a.5.5 0 0 0 .77.42l6.6-4.4a.5.5 0 0 0 0-.84l-6.6-4.4A.5.5 0 0 0 3 1.6z"/></svg>';
function createPauseButton(scene) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "loft-pause";
  const sync = () => {
    b.setAttribute("aria-pressed", String(scene.paused));
    b.setAttribute("aria-label", scene.paused ? "Play animation" : "Pause animation");
    b.innerHTML = scene.paused ? ICON_PLAY : ICON_PAUSE;
  };
  b.addEventListener("click", () => {
    if (scene.paused) scene.resume();
    else scene.pause();
    sync();
  });
  b.sync = sync;
  sync();
  scene.host.appendChild(b);
  return b;
}
var Orbit = class {
  constructor(scene, {
    drag = true,
    auto = 0,
    inertia = true,
    hover = 0,
    keys = true,
    minElevation = -1.2,
    maxElevation = 1.2,
    resume = 2e3
  } = {}) {
    this.scene = scene;
    this.auto = auto;
    this.inertia = inertia;
    this.hover = hover;
    this.min = minElevation;
    this.max = maxElevation;
    this.resume = resume;
    this._vAz = 0;
    this._vEl = 0;
    this._drag = null;
    this._idle = Infinity;
    this._gain = 1;
    this._hx = 0;
    this._hy = 0;
    this._tx = 0;
    this._ty = 0;
    this._off = [];
    const svg = scene.svg, cam = scene.camera;
    this._home = [cam.azimuth, cam.elevation];
    if (!svg) return;
    const on = (el, type, fn, opts) => {
      el.addEventListener(type, fn, opts);
      this._off.push(() => el.removeEventListener(type, fn, opts));
    };
    if (drag) {
      svg.classList.add("loft-grab");
      on(svg, "pointerdown", (e) => {
        if (e.button !== 0) return;
        svg.setPointerCapture?.(e.pointerId);
        svg.classList.add("is-dragging");
        this._drag = { x: e.clientX, y: e.clientY, t: e.timeStamp, k: Math.PI / Math.max(120, Math.min(scene.W, scene.H)) };
        this._vAz = this._vEl = 0;
        this._idle = 0;
        this._gain = 0;
      });
      on(svg, "pointermove", (e) => {
        const d = this._drag;
        if (!d) return;
        const dx = (e.clientX - d.x) * d.k, dy = (e.clientY - d.y) * d.k, dt = Math.max(1, e.timeStamp - d.t) / 1e3;
        d.x = e.clientX;
        d.y = e.clientY;
        d.t = e.timeStamp;
        cam.azimuth -= dx;
        cam.elevation = Math.max(this.min, Math.min(this.max, cam.elevation + dy));
        this._vAz = 0.6 * this._vAz + 0.4 * (-dx / dt);
        this._vEl = 0.6 * this._vEl + 0.4 * (dy / dt);
      });
      const end = (e) => {
        if (!this._drag) return;
        if (e.timeStamp - this._drag.t > 80) this._vAz = this._vEl = 0;
        this._drag = null;
        svg.classList.remove("is-dragging");
        this._idle = 0;
        scene.invalidate();
      };
      on(svg, "pointerup", end);
      on(svg, "pointercancel", end);
    }
    if (keys) {
      if (!svg.hasAttribute("tabindex")) svg.setAttribute("tabindex", "0");
      scene._describe("Drag or use the arrow keys to turn it.");
      on(svg, "keydown", (e) => {
        const step = 0.2618;
        let az = 0, el = 0;
        if (e.key === "ArrowLeft") az = -step;
        else if (e.key === "ArrowRight") az = step;
        else if (e.key === "ArrowUp") el = step;
        else if (e.key === "ArrowDown") el = -step;
        else if (e.key === "Home") {
          e.preventDefault();
          this._idle = 0;
          this._gain = 0;
          scene.tween(cam, { azimuth: this._home[0], elevation: this._home[1] }, { duration: 320 });
          return;
        } else return;
        e.preventDefault();
        this._idle = 0;
        this._gain = 0;
        scene.tween(cam, {
          azimuth: cam.azimuth + az,
          elevation: Math.max(this.min, Math.min(this.max, cam.elevation + el))
        }, { duration: 220 });
      });
    }
    if (hover && typeof matchMedia === "function" && matchMedia("(hover: hover) and (pointer: fine)").matches) {
      let rect3 = null;
      on(svg, "pointerenter", () => {
        rect3 = svg.getBoundingClientRect();
      });
      on(svg, "pointermove", (e) => {
        if (!rect3 || this._drag) return;
        this._tx = ((e.clientX - rect3.left) / rect3.width - 0.5) * 2;
        this._ty = ((e.clientY - rect3.top) / rect3.height - 0.5) * 2;
        scene.invalidate();
      });
      on(svg, "pointerleave", () => {
        this._tx = this._ty = 0;
        scene.invalidate();
      });
    }
  }
  /** True while the orbit moves by itself, so the scene knows to keep ticking. */
  get moving() {
    if (this.scene.reducedMotion) return false;
    return this.auto !== 0 || Math.abs(this._vAz) + Math.abs(this._vEl) > 1e-3 || Math.abs(this._tx - this._hx) + Math.abs(this._ty - this._hy) > 1e-3;
  }
  get autonomous() {
    return this.auto !== 0;
  }
  update(dt) {
    const cam = this.scene.camera, still = this.scene.reducedMotion;
    if (this._drag) return;
    this._idle += dt * 1e3;
    if (!still && this.inertia && Math.abs(this._vAz) + Math.abs(this._vEl) > 1e-3) {
      cam.azimuth += this._vAz * dt;
      cam.elevation = Math.max(this.min, Math.min(this.max, cam.elevation + this._vEl * dt));
      const k = Math.exp(-dt * 4.2);
      this._vAz *= k;
      this._vEl *= k;
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
      this._hx = hx;
      this._hy = hy;
    }
  }
  dispose() {
    for (const off of this._off) off();
    this._off.length = 0;
    this.scene.svg?.classList.remove("loft-grab", "is-dragging");
    this.scene._controllers.delete(this);
  }
};

// src/scene.js
var NS = "http://www.w3.org/2000/svg";
var HAS_DOM = typeof document !== "undefined";
var uid = 0;
var DEFAULTS = {
  width: 640,
  height: 480,
  fit: true,
  frame: null,
  padding: 0.08,
  offset: [0, 0],
  detail: 1,
  reference: 480,
  shadow: false,
  label: "",
  background: null,
  palette: {},
  motion: "auto",
  pauseButton: "auto",
  poster: 0
};
function interp(a, b, t) {
  if (typeof b === "number") return a + (b - a) * t;
  if (Array.isArray(b)) return b.map((v, i) => interp(a[i], v, t));
  if (b && typeof b === "object") {
    const out = { ...a };
    for (const k in b) out[k] = interp(a[k], b[k], t);
    return out;
  }
  return t < 1 ? a : b;
}
function perSpan(lengthPx, turning, spans, tol, iso) {
  const segs = Math.max(Math.sqrt(turning * lengthPx / (8 * tol)), lengthPx / (110 * tol), turning / 0.5236, 1);
  const per = clamp(Math.ceil(segs / spans), 1, Math.max(1, Math.ceil(144 / spans)));
  return alignPerSpan(per, spans, iso);
}
var Scene = class {
  /**
   * @param {Element|string|object} [target] element, selector, or the options when headless
   * @param {object} [options]
   */
  constructor(target, options) {
    if (target && typeof target === "object" && !("nodeType" in target)) {
      options = target;
      target = null;
    }
    const o = this.options = { ...DEFAULTS, ...options };
    this.id = o.id || `lf${++uid}`;
    this.W = o.width;
    this.H = o.height;
    this.camera = o.camera instanceof Camera ? o.camera : new Camera(o.camera);
    this.camera._scene = this;
    this.light = { direction: [-0.5, 0.72, 0.6], space: "view", ...o.light };
    this.palette = { ...o.palette };
    this.root = new Node();
    this.root._attach(this);
    this.painter = new Painter();
    this.time = 0;
    this.lod = 1;
    this.paused = false;
    this._loops = /* @__PURE__ */ new Set();
    this._tweens = /* @__PURE__ */ new Set();
    this._controllers = /* @__PURE__ */ new Set();
    this._dirty = true;
    this._visible = true;
    this._bounds = null;
    this._strokeScale = 0;
    this._restyle = false;
    this._paper = "Canvas";
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
      style: (d) => this.painter.style(d)
    };
    if (typeof target === "string") target = HAS_DOM ? document.querySelector(target) : null;
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
    else throw new Error("scene.add: expected a NurbsSurface, a NurbsCurve, an array of points, or a Node");
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
    if (c === "ink" || c === "paper" || c === "accent") return this.palette[c] || this._resolved[c] || `var(--lf-${c})`;
    if (c === "tint") return mixColors(this._color("paper"), this._color("ink"), 0.07);
    if (c === "soft") return mixColors(this._color("paper"), this._color("ink"), 0.22);
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
    const probe = document.createElement("span");
    probe.style.cssText = "position:absolute;width:0;height:0;visibility:hidden;pointer-events:none";
    this.host.appendChild(probe);
    const read = (value) => {
      probe.style.color = value;
      const rgb = parseColor(getComputedStyle(probe).color);
      return rgb ? toHex(rgb) : null;
    };
    this._resolved = {
      ink: read("var(--loft-ink, var(--ink, currentColor))"),
      paper: read(`var(--loft-paper, var(--bg, ${this._paper}))`),
      accent: read("var(--loft-accent, var(--accent, #c4532f))")
    };
    probe.remove();
  }
  _css() {
    const p = this.palette, id = this.id;
    let s = `.${id}{--lf-ink:${p.ink || "var(--loft-ink,var(--ink,currentColor))"};--lf-paper:${p.paper || `var(--loft-paper,var(--bg,${this._paper}))`};--lf-accent:${p.accent || "var(--loft-accent,var(--accent,#c4532f))"}}`;
    const css = this.painter.css;
    for (let i = 0; i < css.length; i++) s += `.${id}-${i}{${css[i]}}`;
    const sh = this._shadowOptions();
    if (sh) s += `.${id}-sh{fill:${this._color(sh.color)};fill-opacity:${sh.opacity}}`;
    return s;
  }
  _shadowOptions() {
    const s = this.options.shadow;
    return s ? { color: "ink", opacity: 0.14, blur: 0, y: null, ...s === true ? {} : s } : null;
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
    if (m.kind === "surface") {
      if (!m._compiled) {
        m._compiled = compileSurface(m.material, this._env);
        m._resKey = null;
      }
      if (!m._grid) {
        m._grid = new SurfaceGrid();
        m._res = null;
        m._resKey = null;
      }
      const s = m._geometry, lines2 = m._compiled.lines;
      const iu = lines2 ? lines2.u : 0, iv = lines2 ? lines2.v : 0;
      if (!m._res) {
        m._res = [
          alignPerSpan(s.degreeU === 1 ? 2 : 6, s.countU - s.degreeU, iu),
          alignPerSpan(s.degreeV === 1 ? 2 : 6, s.countV - s.degreeV, iv)
        ];
      }
      const g = m._grid;
      const built = g.build(s, m._res[0], m._res[1], m._range, iu, iv);
      if (built || g.version !== s.version || m.deform && g.time !== this.time) {
        g.evaluate(m.deform, this.time);
        g.time = this.time;
      }
    } else if (!m._compiled) {
      m._compiled = m.kind === "curve" ? compileCurve(m.material, this._env) : m.kind === "shape" ? compileShape(m.material, this._env, m._opacity) : compilePoints(m.material, this._env);
    }
  }
  /** Choose how finely each surface is diced, from its size on screen. */
  _detail(m, pxPerUnit) {
    const w = m.world;
    const det = Math.abs(w[0] * (w[5] * w[10] - w[6] * w[9]) - w[4] * (w[1] * w[10] - w[2] * w[9]) + w[8] * (w[1] * w[6] - w[2] * w[5]));
    const px = pxPerUnit * Math.cbrt(det);
    const key = Math.round(Math.log2(Math.max(px, 1e-6)) * 3) + "|" + this.lod + "|" + this.options.detail;
    if (m._resKey === key) return;
    m._resKey = key;
    const g = m._grid, s = m._geometry, lines2 = m._compiled.lines;
    const [lu, tu, lv, tv] = g.extent();
    const tol = 0.3 / (this.options.detail * m._compiled.detail * this.lod);
    const next = [
      perSpan(lu * px, tu, g.u.spans, tol, lines2 ? lines2.u : 0),
      perSpan(lv * px, tv, g.v.spans, tol, lines2 ? lines2.v : 0)
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
      if (X < x0) x0 = X;
      if (X > x1) x1 = X;
      if (Y < y0) y0 = Y;
      if (Y > y1) y1 = Y;
      if (Z < z0) z0 = Z;
      if (Z > z1) z1 = Z;
    };
    for (const m of list) {
      if (m.kind === "surface") {
        const p = m._grid.pos;
        for (let o = 0; o < p.length; o += 3) eat(m, p[o], p[o + 1], p[o + 2]);
      } else if (m.kind === "curve") {
        for (const p of m.geometry.sample(48)) eat(m, p[0], p[1], p[2]);
      } else if (m.kind === "shape") {
        for (const c2 of m.geometry) for (const p of c2.sample(48)) eat(m, p[0], p[1], p[2]);
      } else {
        for (const p of m.points) eat(m, p[0], p[1], p[2] || 0);
      }
    }
    if (!pts.length) return { center: [0, 0, 0], radius: 1, rxz: 1, hy: 1, ground: -1 };
    const c = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2];
    let r22 = 0, rxz2 = 0;
    for (let o = 0; o < pts.length; o += 3) {
      const dx = pts[o] - c[0], dy = pts[o + 1] - c[1], dz = pts[o + 2] - c[2];
      r22 = Math.max(r22, dx * dx + dy * dy + dz * dz);
      rxz2 = Math.max(rxz2, dx * dx + dz * dz);
    }
    return { center: c, radius: Math.sqrt(r22) || 1, rxz: Math.sqrt(rxz2) || 1e-6, hy: (y1 - y0) / 2 || 1e-6, ground: y0 };
  }
  /** Aim the camera and fill in the per-frame drawing context. Returns pixels per world unit at the target. */
  _frame() {
    const cam = this.camera, b = this._bounds, { W, H } = this, o = this.options, ctx = this._ctx;
    const use = Math.max(0.05, 1 - 2 * o.padding);
    const tanHalf = Math.tan(cam.fov * Math.PI / 360);
    let f = H / 2 / tanHalf, s;
    if (o.fit) {
      if (!cam._userTarget) cam._target = b.center.slice();
      const e = clamp(cam.elevation, -1.55, 1.55), ce = Math.cos(e), se = Math.abs(Math.sin(e));
      const halfW = b.rxz, halfH = b.hy * ce + b.rxz * se;
      s = Math.min(W * use / (2 * halfW), H * use / (2 * halfH)) * cam.zoom;
      if (!cam.orthographic) cam._v.distance = f / s + (b.flat ? 0 : 0.55 * (b.rxz * ce + b.hy * se));
    } else {
      s = f / cam.distance * cam.zoom;
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
    const L = this.light.space === "world" ? transformDirection(cam.view, this.light.direction) : this.light.direction;
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
    if (ss !== this._strokeScale) {
      this._strokeScale = ss;
      this._restyle = true;
    }
    if (this._restyle) {
      this._restyle = false;
      P.resetStyles();
      this._cls.length = 0;
      this.root.traverse((n) => {
        n._compiled = null;
      });
    }
    this.root._updateWorld(null);
    const list = this._collect(this.root, []);
    for (const m of list) this._prepare(m);
    if (!this._bounds) this._bounds = this.options.frame ? frameBounds(this.options.frame) : this._computeBounds(list);
    const pxPerUnit = this._frame();
    for (const m of list) if (m.kind === "surface") this._detail(m, pxPerUnit);
    P.reset();
    const ctx = this._ctx;
    for (const m of list) {
      if (m.kind === "surface") drawSurface(m, ctx, P);
      else if (m.kind === "curve") drawCurve(m, ctx, P);
      else if (m.kind === "shape") drawShape(m, ctx, P);
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
    if (this._shadowPath) this._shadowPath.setAttribute("d", P.shadow);
    const pool = this._pool, g = this._g, n = P.runs;
    for (let i = 0; i < n; i++) {
      let el = pool[i];
      if (!el) {
        el = pool[i] = document.createElementNS(NS, "path");
        el._s = -1;
        g.appendChild(el);
      }
      const s = P.runStyle[i];
      if (el._s !== s) {
        el._s = s;
        el.setAttribute("class", this._class(s));
      }
      el.setAttribute("d", P.runD[i]);
    }
    for (let i = n; i < this._drawn; i++) pool[i].setAttribute("d", "");
    this._drawn = n;
  }
  /**
   * The current picture as SVG markup: for server rendering, static export, or
   * an <img>. Colours given as palette words stay as CSS variables unless the
   * palette is set to fixed colours.
   */
  toSVG({ width = this.W, height = this.H } = {}) {
    if (!this.svg) {
      this.W = width;
      this.H = height;
    }
    this.render();
    const P = this.painter, { W, H, id } = this, o = this.options;
    const sh = this._shadowOptions();
    let s = `<svg xmlns="${NS}" viewBox="${-W / 2} ${-H / 2} ${W} ${H}" width="${width}" height="${height}" class="${id} loft-svg" data-loft` + (o.label ? ` role="img" aria-label="${escapeAttr(o.label)}">` : ' aria-hidden="true">');
    if (o.label) s += `<title>${escapeAttr(o.label)}</title>`;
    s += `<style>${this._css()}</style>`;
    if (sh && sh.blur) s += `<filter id="${id}-blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${sh.blur}"/></filter>`;
    if (o.background) s += `<rect x="${-W / 2}" y="${-H / 2}" width="${W}" height="${H}" fill="${this._color(o.background)}"/>`;
    if (sh && P.shadow) s += `<path class="${id}-sh"${sh.blur ? ` filter="url(#${id}-blur)"` : ""} d="${P.shadow}"/>`;
    s += '<g fill="none" stroke-linecap="round" stroke-linejoin="round">';
    for (let i = 0; i < P.runs; i++) s += `<path class="${this._class(P.runStyle[i])}" d="${P.runD[i]}"/>`;
    return s + "</g></svg>";
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
    host.querySelector(":scope > svg[data-loft]")?.remove();
    if (getComputedStyle(host).position === "static") host.classList.add("loft-rel");
    if (host.clientHeight < 2) host.style.aspectRatio = `${o.width} / ${o.height}`;
    if (host.clientWidth < 2) host.style.width = "100%";
    const svg = this.svg = document.createElementNS(NS, "svg");
    svg.setAttribute("class", `${this.id} loft-svg`);
    svg.setAttribute("data-loft", "");
    this._title = document.createElementNS(NS, "title");
    this._desc = document.createElementNS(NS, "desc");
    this._style = document.createElementNS(NS, "style");
    svg.append(this._title, this._desc, this._style);
    const sh = this._shadowOptions();
    if (o.background) {
      this._bg = document.createElementNS(NS, "rect");
      this._bg.setAttribute("fill", this._color(o.background));
      svg.appendChild(this._bg);
    }
    if (sh) {
      if (sh.blur) {
        const f = document.createElementNS(NS, "filter");
        f.id = `${this.id}-blur`;
        for (const [k, v] of [["x", "-50%"], ["y", "-50%"], ["width", "200%"], ["height", "200%"]]) f.setAttribute(k, v);
        const b = document.createElementNS(NS, "feGaussianBlur");
        b.setAttribute("stdDeviation", sh.blur);
        f.appendChild(b);
        svg.appendChild(f);
      }
      this._shadowPath = document.createElementNS(NS, "path");
      this._shadowPath.setAttribute("class", `${this.id}-sh`);
      if (sh.blur) this._shadowPath.setAttribute("filter", `url(#${this.id}-blur)`);
      svg.appendChild(this._shadowPath);
    }
    this._g = document.createElementNS(NS, "g");
    this._g.setAttribute("fill", "none");
    this._g.setAttribute("stroke-linecap", "round");
    this._g.setAttribute("stroke-linejoin", "round");
    svg.appendChild(this._g);
    this.label = o.label;
    host.appendChild(svg);
    this._readPage();
    this._resize(host.clientWidth || o.width, host.clientHeight || o.height);
    if (typeof ResizeObserver === "function") {
      this._ro = new ResizeObserver((entries) => {
        const r = entries[entries.length - 1].contentRect;
        if (r.width > 0 && r.height > 0) this._resize(r.width, r.height);
      });
      this._ro.observe(host);
    }
    if (typeof IntersectionObserver === "function") {
      this._io = new IntersectionObserver((entries) => {
        this._visible = entries[entries.length - 1].isIntersecting;
        if (this._visible && this._dirty) wake(this);
      }, { rootMargin: "120px" });
      this._io.observe(host);
    }
    if (typeof matchMedia === "function") {
      this._mqReduce = matchMedia("(prefers-reduced-motion: reduce)");
      this._mqDark = matchMedia("(prefers-color-scheme: dark)");
      this._onReduce = () => {
        this._pauseBtn?.remove();
        this._pauseBtn = null;
        this._last = 0;
        this.invalidate();
      };
      this._onScheme = () => this.setPalette();
      this._mqReduce.addEventListener?.("change", this._onReduce);
      this._mqDark.addEventListener?.("change", this._onScheme);
    }
    if (typeof MutationObserver === "function") {
      let queued = false;
      this._mo = new MutationObserver(() => {
        if (queued) return;
        queued = true;
        requestAnimationFrame(() => {
          queued = false;
          if (this.svg) this.setPalette();
        });
      });
      const watch = { attributes: true, attributeFilter: ["class", "style", "data-theme", "data-mode", "data-color-scheme"] };
      this._mo.observe(document.documentElement, watch);
      if (document.body) this._mo.observe(document.body, watch);
    }
  }
  _resize(w, h) {
    w = Math.round(w);
    h = Math.round(h);
    if (w === this.W && h === this.H && this.svg.hasAttribute("viewBox")) return;
    this.W = w;
    this.H = h;
    this.svg.setAttribute("viewBox", `${-w / 2} ${-h / 2} ${w} ${h}`);
    if (this._bg) for (const [k, v] of [["x", -w / 2], ["y", -h / 2], ["width", w], ["height", h]]) this._bg.setAttribute(k, v);
    this.invalidate();
  }
  /** The accessible name. With a label the picture is announced as an image; without one it is hidden from assistive technology as decoration. */
  get label() {
    return this.options.label;
  }
  set label(text) {
    this.options.label = text || "";
    if (!this.svg) return;
    this._title.textContent = text || "";
    if (text) {
      this.svg.setAttribute("role", "img");
      this.svg.setAttribute("aria-label", text);
      this.svg.removeAttribute("aria-hidden");
    } else if (this.svg.hasAttribute("tabindex")) {
      this.svg.setAttribute("role", "img");
      this.svg.setAttribute("aria-label", "3D illustration");
      this.svg.removeAttribute("aria-hidden");
    } else {
      this.svg.removeAttribute("role");
      this.svg.removeAttribute("aria-label");
      this.svg.setAttribute("aria-hidden", "true");
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
    if (m === "always") return false;
    if (m === "off") return true;
    if (HAS_DOM && document.documentElement.dataset.motion === "off") return true;
    return !!this._mqReduce?.matches;
  }
  /**
   * Run `fn({ time, dt })` every frame, then redraw if anything changed. Time is
   * in seconds. Returns a function that stops it.
   *
   * Under reduced motion, or when headless, `fn` runs once at the poster time so
   * the scene still shows a finished frame.
   */
  loop(fn = () => {
  }) {
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
    return () => {
      this._loops.delete(entry);
    };
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
  tween(target, to, { duration = 600, ease: curve2 = ease.out, delay = 0, onUpdate } = {}) {
    for (const t of this._tweens) {
      if (t.target === target) for (const k in to) delete t.to[k];
    }
    const from = {};
    for (const k in to) from[k] = target[k];
    let done;
    const promise = new Promise((r) => {
      done = r;
    });
    const tw = { target, from, to: { ...to }, t: -delay / 1e3, dur: duration / 1e3, curve: curve2, onUpdate, done };
    promise.cancel = () => {
      if (this._tweens.delete(tw)) done(false);
    };
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
  intro({ turn: turn2 = 0.5, duration = 1100, scale: scale2 = 0.98 } = {}) {
    if (this.reducedMotion || !this.svg) return Promise.resolve(false);
    this.camera._v.swing = -turn2;
    if (scale2 !== 1 && this.svg.animate) {
      this.svg.animate([{ transform: `scale(${scale2})` }, { transform: "none" }], { duration: Math.min(duration, 900), easing: "cubic-bezier(.22,1,.36,1)" });
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
    if (node.kind === "surface" && node._grid && node._grid.version !== node._geometry.version) return true;
    for (const c of node.children) if (this._geometryChanged(c)) return true;
    return false;
  }
  _hasDeform(node) {
    if (node.deform) return true;
    for (const c of node.children) if (this._hasDeform(c)) return true;
    return false;
  }
  _tick(now) {
    if (this.paused) {
      sleep(this);
      return;
    }
    if (now === this._last) return;
    const dt = this._last ? Math.min(0.1, (now - this._last) / 1e3) : 0;
    this._last = now;
    const still = this.reducedMotion;
    if (!still) this.time += dt;
    if (!this._visible) return;
    for (const tw of this._tweens) {
      tw.t += dt;
      if (tw.t < 0) continue;
      const k = tw.dur > 0 ? Math.min(1, tw.t / tw.dur) : 1;
      this._applyTween(tw, tw.curve(k));
      if (k >= 1) {
        this._tweens.delete(tw);
        tw.done(true);
      }
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
      if (cost > 20 && autonomous) {
        if (++this._slow > 14 && this.lod > 0.45) {
          this.lod = Math.max(0.45, this.lod * 0.8);
          this._slow = 0;
          this._dirty = true;
        }
      } else if (this._slow > 0) this._slow--;
      if (autonomous) {
        this._streak = now - this._lastRender < 400 ? this._streak + (now - this._lastRender) : 0;
        if (this._streak > 5e3 && this.options.pauseButton && !this._pauseBtn && this.host) this._pauseBtn = createPauseButton(this);
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
    this._mqReduce?.removeEventListener?.("change", this._onReduce);
    this._mqDark?.removeEventListener?.("change", this._onScheme);
    this._pauseBtn?.remove();
    this.svg?.remove();
    this.svg = null;
    this._loops.clear();
    this._tweens.clear();
  }
};
function frameBounds([w, h, d = 0]) {
  return { center: [0, 0, 0], radius: Math.hypot(w, h, d) / 2 || 1, rxz: w / 2 || 1e-6, hy: h / 2 || 1e-6, ground: -h / 2, flat: true };
}
function escapeAttr(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function detectPaper(el) {
  for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
    const bg = getComputedStyle(n).backgroundColor;
    if (bg && bg !== "transparent" && !/^rgba\(.*,\s*0\)$/.test(bg) && !/\/\s*0\)$/.test(bg)) return bg;
  }
  return "Canvas";
}

// src/helpers.js
function controlNet(geometry, { color = "ink", width = 0.8, size = 5.5, dash = [3, 3.5], ring = "paper" } = {}) {
  const group = new Node();
  const isCurve = geometry instanceof NurbsCurve;
  const read = () => {
    if (isCurve) return { rows: [geometry.points], all: geometry.points };
    const rows = [], all = [];
    for (let i = 0; i < geometry.countU; i++) {
      const r = [];
      for (let j = 0; j < geometry.countV; j++) r.push(geometry.getPoint(i, j));
      rows.push(r);
      all.push(...r);
    }
    for (let j = 0; j < geometry.countV; j++) rows.push(rows.slice(0, geometry.countU).map((r) => r[j]));
    return { rows, all };
  };
  const first = read();
  const lines2 = first.rows.map((pts) => group.add(new CurveMesh(new NurbsCurve({ degree: 1, points: pts }), { color, width, dash })));
  const dots = group.add(new PointsMesh(first.all, { color, size, ring }));
  group.update = () => {
    const now = read();
    now.rows.forEach((pts, k) => {
      pts.forEach((p, i) => lines2[k].geometry.setPoint(i, p));
    });
    dots.points = now.all;
    group._touch();
    return group;
  };
  return group;
}
function morph(a, b) {
  const ok = a.matches ? a.matches(b) : a.count === b.count && a.degree === b.degree;
  if (!ok) throw new Error("morph: both shapes need the same degrees, knots and number of control points. Build them with the same constructor and the same number of profile points.");
  const out = a.clone();
  let t = 0;
  Object.defineProperty(out, "t", {
    get: () => t,
    set(v) {
      t = v;
      const A = a.cp, B = b.cp, C = out.cp;
      for (let i = 0; i < C.length; i++) C[i] = A[i] + (B[i] - A[i]) * v;
      out.version++;
    },
    enumerable: true
  });
  return out;
}

// src/spot/kit.js
var kit_exports = {};
__export(kit_exports, {
  bubble: () => bubble,
  check: () => check,
  circle: () => circle2,
  command: () => command,
  line: () => line2,
  lines: () => lines,
  path: () => path,
  pieces: () => pieces,
  polyline: () => polyline2,
  rays: () => rays,
  rect: () => rect,
  shift: () => shift,
  sparkle: () => sparkle,
  turn: () => turn
});
var TAU2 = Math.PI * 2;
var Pen = class {
  constructor() {
    this.subs = [];
    this.sub = null;
  }
  move(x, y) {
    this.sub = { segs: [], start: [x, y], at: [x, y] };
    this.subs.push(this.sub);
    return this;
  }
  _to(x, y, make) {
    if (!this.sub) this.move(x, y);
    const [ax, ay] = this.sub.at;
    const seg = make(ax, ay);
    if (seg) this.sub.segs.push(seg);
    this.sub.at = [x, y];
    return this;
  }
  line(x, y) {
    return this._to(x, y, (ax, ay) => Math.hypot(x - ax, y - ay) < 1e-9 ? null : new NurbsCurve({ degree: 1, points: [[ax, ay, 0], [x, y, 0]] }));
  }
  quad(x1, y1, x, y) {
    return this._to(x, y, (ax, ay) => new NurbsCurve({ degree: 2, points: [[ax, ay, 0], [x1, y1, 0], [x, y, 0]] }));
  }
  cubic(x1, y1, x2, y2, x, y) {
    return this._to(x, y, (ax, ay) => new NurbsCurve({ degree: 3, points: [[ax, ay, 0], [x1, y1, 0], [x2, y2, 0], [x, y, 0]] }));
  }
  /**
   * A circular or elliptical arc about (cx, cy) from angle a0 to a1, in radians
   * clockwise from the x axis (y runs down). a1 < a0 goes anticlockwise. The pen
   * is expected to be at the arc's start already.
   */
  arc(cx, cy, r, a0, a1, { ry = r, tilt = 0 } = {}) {
    if (Math.abs(a1 - a0) < 1e-9) return this;
    const c = Math.cos(tilt), s = Math.sin(tilt), back = a1 < a0;
    const curve2 = arc({
      center: [cx, cy, 0],
      radius: r,
      radiusY: ry,
      xAxis: [c, s, 0],
      yAxis: back ? [s, -c, 0] : [-s, c, 0],
      start: back ? -a0 : a0,
      end: back ? -a1 : a1
    });
    const e = curve2.point(curve2.domain[1]);
    return this._to(e[0], e[1], () => curve2);
  }
  close() {
    const s = this.sub;
    if (s) {
      this.line(s.start[0], s.start[1]);
      s.closed = true;
    }
    return this;
  }
  curves() {
    return this.subs.filter((s) => s.segs.length).map((s) => s.segs.length === 1 ? s.segs[0] : joinCurves(s.segs));
  }
};
function rect(x, y, w, h, r = 0) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  const p = new Pen().move(x + r, y).line(x + w - r, y);
  if (r) p.arc(x + w - r, y + r, r, -TAU2 / 4, 0);
  p.line(x + w, y + h - r);
  if (r) p.arc(x + w - r, y + h - r, r, 0, TAU2 / 4);
  p.line(x + r, y + h);
  if (r) p.arc(x + r, y + h - r, r, TAU2 / 4, TAU2 / 2);
  p.line(x, y + r);
  if (r) p.arc(x + r, y + r, r, TAU2 / 2, TAU2 * 3 / 4);
  return p.close().curves();
}
function circle2(cx, cy, r) {
  return [arc({ center: [cx, cy, 0], radius: r })];
}
function line2(x1, y1, x2, y2) {
  return [new NurbsCurve({ degree: 1, points: [[x1, y1, 0], [x2, y2, 0]] })];
}
function polyline2(points, { closed = false } = {}) {
  const pts = points.map(([x, y]) => [x, y, 0]);
  if (closed) pts.push(pts[0]);
  return [new NurbsCurve({ degree: 1, points: pts })];
}
function lines(x, y, widths, gap = 12) {
  return widths.flatMap((w, i) => line2(x, y + i * gap, x + w, y + i * gap));
}
function sparkle(cx, cy, r, pinch = 0.72) {
  const k = r * (1 - pinch) * Math.SQRT1_2;
  const p = new Pen().move(cx, cy - r);
  p.quad(cx + k, cy - k, cx + r, cy).quad(cx + k, cy + k, cx, cy + r).quad(cx - k, cy + k, cx - r, cy).quad(cx - k, cy - k, cx, cy - r);
  return p.close().curves();
}
function bubble(x, y, w, h, r = 6, tail = 7) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  const t = Math.abs(tail), p = new Pen().move(x + r, y).line(x + w - r, y);
  p.arc(x + w - r, y + r, r, -TAU2 / 4, 0).line(x + w, y + h - r).arc(x + w - r, y + h - r, r, 0, TAU2 / 4);
  if (tail < 0) p.line(x + w - r - t * 0.2, y + h).line(x + w - r * 0.5, y + h + t).line(x + w - r - t * 1.5, y + h);
  else if (tail > 0) p.line(x + r + t * 1.5, y + h).line(x + r * 0.5, y + h + t).line(x + r + t * 0.2, y + h);
  p.line(x + r, y + h).arc(x + r, y + h - r, r, TAU2 / 4, TAU2 / 2).line(x, y + r).arc(x + r, y + r, r, TAU2 / 2, TAU2 * 3 / 4);
  return p.close().curves();
}
function check(cx, cy, size = 20) {
  const s = size / 20;
  return polyline2([[cx - 9 * s, cy + 0.5 * s], [cx - 3 * s, cy + 6.5 * s], [cx + 9 * s, cy - 6 * s]]);
}
function rays(cx, cy, r0, r12, angles) {
  return angles.flatMap((a) => line2(cx + r0 * Math.cos(a), cy + r0 * Math.sin(a), cx + r12 * Math.cos(a), cy + r12 * Math.sin(a)));
}
function command(cx, cy, size = 5) {
  const a = size * 0.44, q = size * 0.5, o = a + q, h = TAU2 / 4;
  const p = new Pen().move(cx - a, cy + o).line(cx - a, cy - o);
  p.arc(cx - o, cy - o, q, 0, -3 * h).line(cx + o, cy - a);
  p.arc(cx + o, cy - o, q, h, -2 * h).line(cx + a, cy + o);
  p.arc(cx + o, cy + o, q, 2 * h, -h).line(cx - o, cy + a);
  p.arc(cx - o, cy + o, q, 3 * h, 0);
  return p.close().curves();
}
var ARGS = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };
function path(d) {
  const pen = new Pen(), tokens = String(d).match(/[a-zA-Z]|-?(?:\d*\.\d+|\d+\.?)(?:e[-+]?\d+)?/gi) || [];
  let i = 0, x = 0, y = 0, sx = 0, sy = 0, cmd = "", prev = "", px = 0, py = 0;
  while (i < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[i])) cmd = tokens[i++];
    const C = cmd.toUpperCase(), rel = cmd !== C, n = ARGS[C];
    if (n === void 0) throw new Error(`kit.path: unknown command "${cmd}"`);
    const a = tokens.slice(i, i + n).map(Number);
    if (a.length < n || a.some(Number.isNaN)) throw new Error(`kit.path: "${cmd}" needs ${n} numbers`);
    i += n;
    const X = (v) => rel ? x + v : v, Y = (v) => rel ? y + v : v;
    if (C === "M") {
      x = X(a[0]);
      y = Y(a[1]);
      sx = x;
      sy = y;
      pen.move(x, y);
      cmd = rel ? "l" : "L";
    } else if (C === "L") {
      x = X(a[0]);
      y = Y(a[1]);
      pen.line(x, y);
    } else if (C === "H") {
      x = X(a[0]);
      pen.line(x, y);
    } else if (C === "V") {
      y = Y(a[0]);
      pen.line(x, y);
    } else if (C === "C" || C === "S") {
      const smooth = prev === "C" || prev === "S", o = C === "C" ? 2 : 0;
      const x1 = C === "C" ? X(a[0]) : smooth ? 2 * x - px : x, y1 = C === "C" ? Y(a[1]) : smooth ? 2 * y - py : y;
      px = X(a[o]);
      py = Y(a[o + 1]);
      const ex = X(a[o + 2]), ey = Y(a[o + 3]);
      pen.cubic(x1, y1, px, py, ex, ey);
      x = ex;
      y = ey;
    } else if (C === "Q" || C === "T") {
      const smooth = prev === "Q" || prev === "T", o = C === "Q" ? 2 : 0;
      const qx = C === "Q" ? X(a[0]) : smooth ? 2 * x - px : x, qy = C === "Q" ? Y(a[1]) : smooth ? 2 * y - py : y;
      const ex = X(a[o]), ey = Y(a[o + 1]);
      pen.quad(qx, qy, ex, ey);
      px = qx;
      py = qy;
      x = ex;
      y = ey;
    } else if (C === "A") {
      const ex = X(a[5]), ey = Y(a[6]);
      svgArc(pen, x, y, Math.abs(a[0]), Math.abs(a[1]), a[2] * Math.PI / 180, !!a[3], !!a[4], ex, ey);
      x = ex;
      y = ey;
    } else {
      pen.close();
      x = sx;
      y = sy;
    }
    prev = C;
  }
  return pen.curves();
}
function svgArc(pen, x1, y1, rx, ry, phi, large, sweep2, x2, y2) {
  if (Math.hypot(x2 - x1, y2 - y1) < 1e-9) return;
  if (rx < 1e-9 || ry < 1e-9) {
    pen.line(x2, y2);
    return;
  }
  const c = Math.cos(phi), s = Math.sin(phi);
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
  const u = c * dx + s * dy, v = -s * dx + c * dy;
  const grow = Math.sqrt(u * u / (rx * rx) + v * v / (ry * ry));
  if (grow > 1) {
    rx *= grow;
    ry *= grow;
  }
  const num = rx * rx * ry * ry - rx * rx * v * v - ry * ry * u * u, den = rx * rx * v * v + ry * ry * u * u;
  const k = (large === sweep2 ? -1 : 1) * Math.sqrt(Math.max(0, num / den));
  const cu = k * rx * v / ry, cv = -k * ry * u / rx;
  const cx = c * cu - s * cv + (x1 + x2) / 2, cy = s * cu + c * cv + (y1 + y2) / 2;
  const a0 = Math.atan2((v - cv) / ry, (u - cu) / rx);
  let da = Math.atan2((-v - cv) / ry, (-u - cu) / rx) - a0;
  if (sweep2 && da < 0) da += TAU2;
  if (!sweep2 && da > 0) da -= TAU2;
  pen.arc(cx, cy, rx, a0, a0 + da, { ry, tilt: phi });
  pen.sub.at = [x2, y2];
}
function turn(curves, angle, cx = 0, cy = 0) {
  const c = Math.cos(angle), s = Math.sin(angle);
  const m = new Float64Array([c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, cx - c * cx + s * cy, cy - s * cx - c * cy, 0, 1]);
  return [].concat(curves).map((k) => k.transform(m));
}
function shift(curves, dx = 0, dy = 0) {
  const m = new Float64Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, dx, dy, 0, 1]);
  return [].concat(curves).map((k) => k.transform(m));
}
var trace = (curves) => [].concat(curves).map((k) => ({ pts: k.params(12).map((u) => k.point(u)), closed: isClosed(k) }));
var isClosed = (k) => {
  const a = k.at(0), b = k.at(1);
  return Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-6;
};
var box = (lines2) => {
  const b = [Infinity, Infinity, -Infinity, -Infinity];
  for (const { pts } of lines2) for (const [x, y] of pts) {
    b[0] = Math.min(b[0], x);
    b[1] = Math.min(b[1], y);
    b[2] = Math.max(b[2], x);
    b[3] = Math.max(b[3], y);
  }
  return b;
};
function segGap(a, b, c, d) {
  const cross2 = (o, p, q) => (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0]);
  const d1 = cross2(a, b, c), d2 = cross2(a, b, d), d3 = cross2(c, d, a), d4 = cross2(c, d, b);
  if ((d1 > 0 && d2 < 0 || d1 < 0 && d2 > 0) && (d3 > 0 && d4 < 0 || d3 < 0 && d4 > 0)) return 0;
  const toSeg = (p, s, e) => {
    const dx = e[0] - s[0], dy = e[1] - s[1], L = dx * dx + dy * dy;
    const t = L ? Math.max(0, Math.min(1, ((p[0] - s[0]) * dx + (p[1] - s[1]) * dy) / L)) : 0;
    return Math.hypot(p[0] - s[0] - t * dx, p[1] - s[1] - t * dy);
  };
  return Math.min(toSeg(a, c, d), toSeg(b, c, d), toSeg(c, a, b), toSeg(d, a, b));
}
function inside(p, pts) {
  let hit = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if (yi > p[1] !== yj > p[1] && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}
function touches(A, B, gap, filled) {
  for (const a of A.lines) for (const b of B.lines) {
    for (let i = 1; i < a.pts.length; i++) for (let j = 1; j < b.pts.length; j++) {
      if (segGap(a.pts[i - 1], a.pts[i], b.pts[j - 1], b.pts[j]) <= gap) return true;
    }
  }
  if (filled) {
    for (const a of A.lines) if (a.closed) {
      for (const b of B.lines) if (inside(b.pts[0], a.pts)) return true;
    }
    for (const b of B.lines) if (b.closed) {
      for (const a of A.lines) if (inside(a.pts[0], b.pts)) return true;
    }
  }
  return false;
}
function pieces(outlines, { gap = 1, filled = false } = {}) {
  const items = outlines.map((o) => {
    const lines2 = trace(o);
    return { lines: lines2, box: box(lines2) };
  });
  const root = items.map((_, i) => i);
  const find = (i) => root[i] === i ? i : root[i] = find(root[i]);
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i].box, b = items[j].box;
      const near = a[0] - gap <= b[2] && b[0] - gap <= a[2] && a[1] - gap <= b[3] && b[1] - gap <= a[3];
      if (near && find(i) !== find(j) && touches(items[i], items[j], gap, filled)) root[find(j)] = find(i);
    }
  }
  const groups = /* @__PURE__ */ new Map();
  outlines.forEach((o, i) => {
    const r = find(i);
    if (!groups.has(r)) groups.set(r, { shape: [], members: [] });
    const g = groups.get(r);
    g.shape.push(...[].concat(o));
    g.members.push(i);
  });
  return [...groups.values()];
}

// src/spot/recipes.js
var Q = Math.PI / 2;
var round = 1;
var corner = (r, w, h) => Math.min(r * round, w / 2, h / 2);
var rect2 = (x, y, w, h, r = 0) => rect(x, y, w, h, corner(r, w, h));
var bubble2 = (x, y, w, h, r = 6, tail = 7) => bubble(x, y, w, h, corner(r, w, h), tail);
function assist() {
  return {
    size: [240, 200],
    duration: 1700,
    parts: [
      { shape: rect2(40, 44, 160, 120, 14) },
      { shape: line2(40, 74, 200, 74) },
      { shape: [...circle2(59, 59, 3.4), ...circle2(74, 59, 3.4), ...circle2(89, 59, 3.4)], fill: "soft", stroke: false },
      { shape: bubble2(59, 90, 82, 27, 7), fill: "tint", lift: 16, hover: [{ t: 0.3, y: -3 }, { t: 0.7, y: 0 }] },
      {
        group: [
          { shape: rect2(60, 131, 122, 18, 9) },
          { shape: line2(72, 136.5, 72, 143.5), hover: [{ t: 0.2, opacity: 0 }, { t: 0.4, opacity: 1 }, { t: 0.6, opacity: 0 }, { t: 0.8, opacity: 1 }] }
        ],
        lift: 8
      },
      {
        shape: sparkle(172, 100, 14),
        fill: "accent",
        stroke: "accent",
        width: 1.6,
        lift: 30,
        hover: [{ t: 0.5, rz: Q / 2, scale: 1.22, z: 10 }, { t: 1, rz: Q, scale: 1, z: 0 }]
      },
      {
        shape: sparkle(205, 42, 7.5),
        fill: "accent",
        stroke: "accent",
        width: 1.4,
        lift: 42,
        hover: [{ t: 0.25 }, { t: 0.65, rz: -Q / 2, scale: 1.45 }, { t: 1, rz: -Q, scale: 1 }]
      }
    ]
  };
}
function paste() {
  const sheet2 = (shape) => turn(shape, -0.15, 132.5, 109.5);
  return {
    size: [240, 200],
    duration: 1500,
    parts: [
      { shape: rect2(30, 49, 95, 118, 12) },
      { shape: rect2(58, 35, 38, 20, 8), fill: "tint", lift: 6 },
      {
        group: [
          { shape: rect2(40, 119, 53, 37, 8) },
          { shape: [...command(56.5, 137.5, 5.2), ...polyline2([[70.5, 132], [75.5, 143], [80.5, 132]])], fill: false, width: 2.1 }
        ],
        lift: 10,
        hover: [{ t: 0.14, z: -10, scale: 0.93 }, { t: 0.34, z: 0, scale: 1 }]
      },
      {
        group: [
          { shape: sheet2(rect2(95, 62, 75, 95, 7)) },
          { shape: sheet2(lines(108, 80, [50, 50, 50, 50, 30], 11.5)), stroke: "soft" }
        ],
        lift: 14,
        hover: [{ t: 0.16 }, { t: 0.8, x: 15, y: -7, z: 30, ry: -0.38, rz: 0.07 }]
      },
      {
        shape: [...line2(185, 76, 204, 68), ...line2(190, 92, 209, 89)],
        stroke: "soft",
        lift: 26,
        hover: [{ t: 0.3 }, { t: 0.85, x: 16, y: -5, scale: 1.3 }]
      }
    ]
  };
}
function plugin() {
  return {
    size: [240, 200],
    duration: 1900,
    parts: [
      { shape: rect2(28, 39, 138, 110, 12) },
      { shape: lines(50, 70, [64, 50, 60], 19), stroke: "soft" },
      {
        shape: rays(160, 95, 36, 52, [-0.62, 0, 0.62]),
        stroke: "soft",
        lift: 12,
        hover: [{ t: 0.5, opacity: 0, scale: 0.7 }, { t: 0.56, opacity: 0, scale: 0.7 }, { t: 0.74, opacity: 1, scale: 1.12 }, { t: 1, scale: 1 }]
      },
      {
        shape: [...rect2(137, 68, 32, 51, 5), ...circle2(138, 93.5, 9), ...circle2(168.5, 93.5, 9)],
        fill: "ink",
        lift: 14,
        hover: [{ t: 0.3, x: 30, z: 26, ry: -0.6 }, { t: 0.42, x: 30, z: 26, ry: -0.6 }, { t: 0.58, x: 0, z: 0, ry: 0, ease: (t) => t * t * t }]
      },
      {
        group: [
          { shape: circle2(57, 138, 23), fill: "accent", stroke: false },
          { shape: check(57, 138, 21), stroke: "ink", width: 3.6 }
        ],
        lift: 24,
        hover: [{ t: 0.58 }, { t: 0.76, scale: 1.1, z: 10, ry: 0.5 }, { t: 1, scale: 1, z: 0, ry: 0 }]
      }
    ]
  };
}
function search() {
  const row = (y, w, hit) => [
    { shape: rect2(48, y - 6, 12, 12, 4), fill: hit ? "accent" : "tint", stroke: false, ...hit ? { lift: 10, hover: [{ t: 0.7 }, { t: 0.84, scale: 1.5, z: 8 }, { t: 1, scale: 1, z: 0 }] } : {} },
    { shape: line2(70, y, 70 + w, y), stroke: "soft" }
  ];
  return {
    size: [240, 200],
    duration: 2100,
    parts: [
      { shape: rect2(34, 38, 172, 32, 16) },
      { shape: line2(52, 54, 104, 54), stroke: "soft" },
      { shape: line2(112, 48.5, 112, 59.5), hover: [{ t: 0.15, opacity: 0 }, { t: 0.3, opacity: 1 }, { t: 0.45, opacity: 0 }, { t: 0.6, opacity: 1 }] },
      { shape: rect2(34, 84, 172, 80, 12) },
      ...row(104, 92),
      ...row(124, 70, true),
      ...row(144, 104),
      {
        group: [
          { shape: line2(183, 135, 198, 150), width: 5.5 },
          { shape: circle2(168, 120, 21) },
          { shape: path("M156 116 A13 13 0 0 1 168 107"), stroke: "soft" }
        ],
        lift: 34,
        hover: [{ t: 0.3, x: -70, y: -14, ry: 0.25 }, { t: 0.62, x: -94, y: 4, ry: 0.35 }, { t: 1, x: 0, y: 0, ry: 0 }]
      }
    ]
  };
}
function toggle() {
  const on = (y) => [
    { shape: rect2(148, y - 10, 36, 20, 10), fill: "accent" },
    { shape: circle2(174, y, 5.5), fill: "ink" }
  ];
  return {
    size: [240, 200],
    duration: 1300,
    parts: [
      { shape: rect2(40, 36, 160, 128, 14) },
      { shape: [...line2(60, 66, 118, 66), ...line2(60, 100, 104, 100), ...line2(60, 134, 124, 134)], stroke: "soft" },
      ...on(66),
      // The middle switch is off: an "on" track with an "off" one over it, which fades as the knob crosses.
      { shape: rect2(148, 90, 36, 20, 10), fill: "accent" },
      { shape: rect2(148, 90, 36, 20, 10), fill: "tint", hover: [{ t: 0.2 }, { t: 0.6, opacity: 0 }] },
      { shape: rect2(148, 90, 36, 20, 10), fill: false },
      { shape: circle2(158, 100, 5.5), fill: "ink", lift: 12, hover: [{ t: 0.15, z: 10 }, { t: 0.65, x: 16, z: 10 }, { t: 0.85, x: 16, z: 0 }] },
      ...on(134),
      { shape: sparkle(213, 31, 8), fill: "accent", stroke: "accent", width: 1.4, lift: 36, hover: [{ t: 0.55, opacity: 0, scale: 0.4 }, { t: 0.6, opacity: 0, scale: 0.4 }, { t: 0.85, opacity: 1, scale: 1.3, rz: Q / 2 }, { t: 1, scale: 1, rz: Q }] }
    ]
  };
}
function stack() {
  return {
    size: [240, 200],
    duration: 1400,
    lean: [0.16, -0.3],
    parts: [
      { shape: rect2(78, 36, 124, 84, 12), fill: "tint", hover: [{ t: 1, x: 8, y: -8 }] },
      { shape: rect2(58, 58, 124, 84, 12), lift: 26 },
      {
        group: [
          { shape: rect2(38, 80, 124, 84, 12) },
          { shape: lines(58, 122, [70, 46], 16), stroke: "soft" },
          { shape: circle2(64, 101, 7), fill: "accent", stroke: false }
        ],
        lift: 52,
        hover: [{ t: 1, x: -8, y: 8 }]
      }
    ]
  };
}
function recipeWithRadius(name, radius = 1) {
  round = radius;
  try {
    return recipes[name]();
  } finally {
    round = 1;
  }
}
var recipes = { assist, paste, plugin, search, toggle, stack };

// src/spot/spot.js
var REST = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, scale: 1, opacity: 1 };
var PROPS = Object.keys(REST);
var clamp1 = (v) => v < -1 ? -1 : v > 1 ? 1 : v;
var swell = (v) => Math.sign(v) * Math.pow(Math.abs(v), 1.5);
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
function extent(part, box2 = [Infinity, Infinity, -Infinity, -Infinity]) {
  if (part.group) for (const child of part.group) extent(child, box2);
  else {
    for (const c of [].concat(part.shape)) {
      for (const p of c.sample(c.degree === 1 ? c.count : 33)) {
        if (p[0] < box2[0]) box2[0] = p[0];
        if (p[0] > box2[2]) box2[2] = p[0];
        if (p[1] < box2[1]) box2[1] = p[1];
        if (p[1] > box2[3]) box2[3] = p[1];
      }
    }
  }
  return box2;
}
var Spot = class {
  constructor(target, recipe = "assist", options = {}) {
    if (typeof recipe === "string") {
      if (!recipes[recipe]) throw new Error(`Spot: unknown illustration "${recipe}". Ready-made ones: ${Object.keys(recipes).join(", ")}.`);
      recipe = recipeWithRadius(recipe, options.radius ?? 1);
    } else if (typeof recipe === "function") recipe = recipe();
    if (!recipe || !Array.isArray(recipe.parts)) throw new Error("Spot: a recipe is { size: [width, height], parts: [...] }");
    const { hover = "loop", trigger, lean, follow = 0.32, duration, hold, stroke, radius, ...sceneOptions } = options;
    const [W, H] = this.size = recipe.size || [240, 200];
    this.hover = hover;
    this.follow = follow;
    this.lean = lean || recipe.lean || [0.09, -0.21];
    this.duration = (duration ?? recipe.duration ?? 1500) / 1e3;
    this.hold = (hold ?? recipe.hold ?? 450) / 1e3;
    this._stroke = stroke ?? recipe.stroke ?? 2.6;
    this.scene = new Scene(target, {
      width: W,
      height: H,
      frame: [W, H, Math.min(W, H) * 0.4],
      reference: Math.min(W, H),
      padding: 0.03,
      pauseButton: false,
      // it moves only while someone points at it
      camera: { azimuth: 0, elevation: 0, fov: 32 },
      ...sceneOptions
    });
    this.root = this.scene.group();
    this._layers = 0;
    this._tree = recipe.parts.map((part) => this._build(part, this.root, [W / 2, H / 2]));
    this.parts = [];
    const list = (e) => {
      this.parts.push(e.node);
      e.children.forEach(list);
    };
    this._tree.forEach(list);
    const tracks = [];
    const gather = (e) => {
      if (e.track) tracks.push(e.track);
      e.children.forEach(gather);
    };
    this._tree.forEach(gather);
    this.cycle = recipe.cycle ?? tracks.every((tr) => PROPS.every((k) => Math.abs(tr[tr.length - 1][k] - REST[k]) < 1e-9));
    this._w = 0;
    this._p = 0;
    this._dir = 1;
    this._wait = 0;
    this._lx = 0;
    this._ly = 0;
    this._tx = 0;
    this._ty = 0;
    this._over = false;
    this._focus = false;
    this._forced = null;
    this._pointer = false;
    this._stop = null;
    this._v = { ...REST };
    this._off = [];
    if (this.scene.svg) this._listen(trigger);
  }
  _build(part, parent, origin) {
    const box2 = extent(part);
    const pivot = part.pivot || [(box2[0] + box2[2]) / 2, (box2[1] + box2[3]) / 2];
    let node;
    if (part.group) node = new Node();
    else {
      const m = new Float64Array([1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1, 0, -pivot[0], pivot[1], 0, 1]);
      const curves = [].concat(part.shape).map((c) => c.transform(m));
      const open = curves.every((c) => !c.closed);
      node = new ShapeMesh(curves, {
        fill: part.fill ?? (open ? false : "paper"),
        stroke: part.stroke ?? "ink",
        width: part.width ?? this._stroke,
        dash: part.dash,
        opacity: part.opacity ?? 1
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
    const el = this.trigger = typeof trigger === "string" ? host.closest(trigger) || document.querySelector(trigger) || host : trigger || host;
    const on = (type, fn) => {
      el.addEventListener(type, fn);
      this._off.push(() => el.removeEventListener(type, fn));
    };
    let rect3 = null;
    const point = (e) => {
      if (!rect3 || e.pointerType === "touch") return;
      this._pointer = true;
      this._tx = clamp1(((e.clientX - rect3.left) / rect3.width - 0.5) * 2);
      this._ty = clamp1(((e.clientY - rect3.top) / rect3.height - 0.5) * 2);
    };
    on("pointerenter", (e) => {
      rect3 = el.getBoundingClientRect();
      point(e);
      this._over = true;
      this._sync();
    });
    on("pointermove", point);
    const left = () => {
      this._over = this._pointer = false;
      this._tx = this._ty = 0;
      this._sync();
    };
    on("pointerleave", left);
    on("pointercancel", left);
    on("focusin", (e) => {
      let keyboard = true;
      try {
        keyboard = e.target.matches(":focus-visible");
      } catch {
      }
      if (keyboard) {
        this._focus = true;
        this._sync();
      }
    });
    on("focusout", () => {
      this._focus = false;
      this._sync();
    });
  }
  /** True while the motion is being asked for: hovered, focused, or played from script. */
  get active() {
    return !!this._forced || !!this.hover && (this._over || this._focus);
  }
  get _mode() {
    return this._forced || this.hover || "loop";
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
    else if (this._w < 2e-3 && Math.abs(this._lx) + Math.abs(this._ly) < 2e-3) {
      this._w = this._p = this._lx = this._ly = this._wait = 0;
      this._dir = 1;
      this._stop?.();
      this._stop = null;
    }
    const now = `${this._w.toFixed(4)} ${this._p.toFixed(4)} ${this._lx.toFixed(4)} ${this._ly.toFixed(4)}`;
    if (now !== this._drawn) {
      this._drawn = now;
      this._apply();
    }
  }
  /** Where the lean is heading: after the pointer when there is one, else the picture's own lean. */
  _aim() {
    if (!this._pointer || !this.follow) return this._pointer ? [0, 0] : this.lean;
    const x = this._tx, y = this._ty, corner2 = 1 + 0.2 * Math.abs(x * y);
    return [-0.8 * this.follow * swell(y) * corner2, this.follow * swell(x) * corner2];
  }
  _advance(dt) {
    if (this._wait > 0) {
      this._wait -= dt;
      return;
    }
    this._p += this._dir * dt / this.duration;
    const loop = this._mode === "loop";
    if (this._p >= 1) {
      this._p = 1;
      if (!loop) return;
      this._wait = this.hold;
      if (this.cycle) this._p = 0;
      else this._dir = -1;
    } else if (this._p <= 0) {
      this._p = 0;
      this._dir = 1;
      this._wait = this.hold;
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
  play(mode = this.hover || "loop") {
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
};
export {
  Camera,
  CurveMesh,
  Node,
  NurbsCurve,
  NurbsSurface,
  Orbit,
  PointsMesh,
  Scene,
  ShapeMesh,
  Spot,
  SurfaceMesh,
  arc,
  averagedKnots,
  basisFuns,
  binomial,
  capsule,
  chordParams,
  circle,
  clampedKnots,
  cone,
  controlNet,
  cubicBezier,
  curve,
  cylinder,
  dersBasisFuns,
  ease,
  elevateDegree,
  ellipse,
  extrude,
  findSpan,
  frames,
  insertKnot,
  interpolate,
  interpolationSolver,
  joinCurves,
  kit_exports as kit,
  knotBreaks,
  line,
  loft,
  looks,
  makeCompatible,
  math_exports as math,
  mixColors,
  morph,
  parseColor,
  plane,
  polyline,
  ramp,
  refineCurve,
  refineKnots,
  refineSurface,
  resolveMaterial,
  revolve,
  ruled,
  shadeStops,
  shapes_exports as shapes,
  sphere,
  splitCurve,
  recipes as spots,
  subcurve,
  surface,
  sweep,
  toBezier,
  torus,
  tube,
  uniformKnots
};
