// Shape-preserving operations on NURBS: knot refinement (A5.4), extraction of a
// sub-curve, Bézier decomposition, degree elevation, joining and compatibility.
// None of these change the geometry; they only change how it is represented.

import { findSpan } from './basis.js';
import { NurbsCurve } from './curve.js';
import { NurbsSurface } from './surface.js';

const TOL = 1e-9;

function copy4(dst, di, src, si) {
  di *= 4; si *= 4;
  dst[di] = src[si]; dst[di + 1] = src[si + 1]; dst[di + 2] = src[si + 2]; dst[di + 3] = src[si + 3];
}

/**
 * Insert every knot in X (sorted, inside the domain) into a homogeneous control polygon.
 * Piegl & Tiller A5.4.
 */
export function refineKnots(p, U, Pw, X) {
  if (!X.length) return { knots: Float64Array.from(U), cp: Float64Array.from(Pw) };
  const n = Pw.length / 4 - 1, r = X.length - 1, m = n + p + 1;
  const a = findSpan(n, p, X[0], U), b = findSpan(n, p, X[r], U) + 1;
  const Q = new Float64Array((n + r + 2) * 4), Ub = new Float64Array(m + r + 2);
  for (let j = 0; j <= a - p; j++) copy4(Q, j, Pw, j);
  for (let j = b - 1; j <= n; j++) copy4(Q, j + r + 1, Pw, j);
  for (let j = 0; j <= a; j++) Ub[j] = U[j];
  for (let j = b + p; j <= m; j++) Ub[j + r + 1] = U[j];
  let i = b + p - 1, k = b + p + r;
  for (let j = r; j >= 0; j--) {
    while (X[j] <= U[i] && i > a) {
      copy4(Q, k - p - 1, Pw, i - p - 1);
      Ub[k] = U[i];
      k--; i--;
    }
    copy4(Q, k - p - 1, Q, k - p);
    for (let l = 1; l <= p; l++) {
      const ind = k - p + l;
      let alfa = Ub[k + l] - X[j];
      if (Math.abs(alfa) === 0) {
        copy4(Q, ind - 1, Q, ind);
      } else {
        alfa /= Ub[k + l] - U[i - p + l];
        for (let c = 0; c < 4; c++) {
          Q[(ind - 1) * 4 + c] = alfa * Q[(ind - 1) * 4 + c] + (1 - alfa) * Q[ind * 4 + c];
        }
      }
    }
    Ub[k] = X[j];
    k--;
  }
  return { knots: Ub, cp: Q };
}

function multiplicity(U, t) {
  let s = 0;
  for (let i = 0; i < U.length; i++) if (Math.abs(U[i] - t) < TOL) s++;
  return s;
}

function interior(curve, X) {
  const [a, b] = curve.domain;
  return X.filter((x) => x > a + TOL && x < b - TOL).sort((x, y) => x - y);
}

/** A copy of the curve with the given knots added. The shape is unchanged; the control polygon gets closer to it. */
export function refineCurve(curve, X) {
  const { knots, cp } = refineKnots(curve.degree, curve.knots, curve.cp, interior(curve, Array.from(X)));
  return new NurbsCurve({ degree: curve.degree, knots, cp });
}

/** Insert knot u `times` times (never beyond multiplicity = degree). */
export function insertKnot(curve, u, times = 1) {
  const room = curve.degree - multiplicity(curve.knots, u);
  return refineCurve(curve, new Array(Math.max(0, Math.min(times, room))).fill(u));
}

/** A copy of the surface with knots added in the 'u' or 'v' direction. */
export function refineSurface(surface, dir, X) {
  const { countU: nu, countV: nv, cp } = surface;
  const U = dir === 'u' ? surface.knotsU : surface.knotsV;
  const p = dir === 'u' ? surface.degreeU : surface.degreeV;
  const lo = U[p], hi = U[dir === 'u' ? nu : nv];
  X = Array.from(X).filter((x) => x > lo + TOL && x < hi - TOL).sort((a, b) => a - b);
  if (!X.length) return surface.clone();
  const len = dir === 'u' ? nu : nv, lines = dir === 'u' ? nv : nu, len2 = len + X.length;
  const out = new Float64Array(len2 * lines * 4), row = new Float64Array(len * 4);
  let knots;
  for (let l = 0; l < lines; l++) {
    for (let i = 0; i < len; i++) {
      copy4(row, i, cp, dir === 'u' ? i * nv + l : l * nv + i);
    }
    const r = refineKnots(p, U, row, X);
    knots = r.knots;
    for (let i = 0; i < len2; i++) {
      copy4(out, dir === 'u' ? i * lines + l : l * len2 + i, r.cp, i);
    }
  }
  return new NurbsSurface({
    degreeU: surface.degreeU, degreeV: surface.degreeV,
    knotsU: dir === 'u' ? knots : surface.knotsU,
    knotsV: dir === 'v' ? knots : surface.knotsV,
    cp: out, countU: dir === 'u' ? len2 : nu, countV: dir === 'v' ? len2 : nv,
  });
}

/**
 * The piece of the curve between parameters a and b as a clamped curve of its own.
 * Also turns a periodic (unclamped) curve into a clamped one when given its full domain.
 */
export function subcurve(curve, a = curve.domain[0], b = curve.domain[1]) {
  const p = curve.degree;
  const X = [];
  for (const t of [a, b]) {
    const need = p - multiplicity(curve.knots, t);
    for (let i = 0; i < need; i++) X.push(t);
  }
  X.sort((x, y) => x - y);
  const { knots: U, cp } = refineKnots(p, curve.knots, curve.cp, X);
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

/** Split a curve at parameter u into two curves. */
export function splitCurve(curve, u) {
  const [a, b] = curve.domain;
  return [subcurve(curve, a, u), subcurve(curve, u, b)];
}

/** The curve as a list of rational Bézier segments (each a clamped curve with degree + 1 points). */
export function toBezier(curve) {
  const c = subcurve(curve), p = c.degree;
  const X = [];
  for (let i = p + 1; i < c.count; ) {
    const t = c.knots[i];
    let s = 0;
    while (i < c.count && Math.abs(c.knots[i] - t) < TOL) { s++; i++; }
    for (let k = s; k < p; k++) X.push(t);
  }
  const { knots, cp } = refineKnots(p, c.knots, c.cp, X);
  const segments = (cp.length / 4 - 1) / p, out = [];
  for (let s = 0; s < segments; s++) {
    const a = knots[s * p + p], b = knots[s * p + p + 1];
    const k = new Float64Array(2 * p + 2);
    k.fill(a, 0, p + 1); k.fill(b, p + 1);
    out.push(new NurbsCurve({ degree: p, knots: k, cp: cp.slice(s * p * 4, (s * p + p + 1) * 4) }));
  }
  return out;
}

/**
 * Raise the degree by `times` without changing the shape. The result is in
 * piecewise-Bézier form (interior knots have full multiplicity), which is exact
 * and simple; it carries more control points than a minimal elevation would.
 */
export function elevateDegree(curve, times = 1) {
  let segs = toBezier(curve);
  let p = curve.degree;
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
      k.fill(s.knots[0], 0, p + 2); k.fill(s.knots[s.knots.length - 1], p + 2);
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

/**
 * Join curves end to end into one curve. Each must start where the previous one
 * ends. Lower-degree pieces are elevated; joints keep a sharp corner if the
 * pieces meet at an angle.
 */
export function joinCurves(curves) {
  const p = Math.max(...curves.map((c) => c.degree));
  const parts = curves.map((c) => {
    c = subcurve(c);
    return c.degree < p ? elevateDegree(c, p - c.degree) : c;
  });
  const cps = [], knots = [];
  let prevW = 1;
  parts.forEach((c, k) => {
    const [a, b] = c.domain, cp = c.cp.slice();
    if (k > 0) {
      const prev = cps[cps.length - 1];
      const end = prev.subarray(prev.length - 4);
      const s = prevW / cp[3];
      for (let i = 0; i < cp.length; i++) cp[i] *= s;
      const gap = Math.hypot(end[0] - cp[0], end[1] - cp[1], end[2] - cp[2]);
      if (gap > 1e-6 * (1 + Math.abs(prevW))) {
        throw new Error(`joinCurves: curve ${k} does not start where curve ${k - 1} ends`);
      }
    }
    prevW = cp[cp.length - 1];
    cps.push(k === 0 ? cp : cp.subarray(4));
    const inner = Array.from(c.knots.subarray(p + 1, c.count)).map((u) => k + (u - a) / (b - a));
    if (k === 0) for (let i = 0; i <= p; i++) knots.push(0);
    knots.push(...inner);
    for (let i = 0; i < (k === parts.length - 1 ? p + 1 : p); i++) knots.push(k + 1);
  });
  const total = cps.reduce((s, c) => s + c.length, 0), cp = new Float64Array(total);
  let o = 0;
  for (const c of cps) { cp.set(c, o); o += c.length; }
  return new NurbsCurve({ degree: p, knots, cp });
}

/**
 * Rewrite a set of curves so they share one degree and one knot vector on [0, 1],
 * and therefore the same number of control points. Lofting and morphing need this.
 */
export function makeCompatible(curves) {
  const p = Math.max(...curves.map((c) => c.degree));
  let list = curves.map((c) => {
    c = subcurve(c);
    if (c.degree < p) c = elevateDegree(c, p - c.degree);
    const [a, b] = c.domain, knots = c.knots.map((u) => (u - a) / (b - a));
    return new NurbsCurve({ degree: p, knots, cp: c.cp });
  });
  // Union of interior knots, keeping the highest multiplicity seen.
  const union = [];
  for (const c of list) {
    const mine = Array.from(c.knots.subarray(p + 1, c.count));
    let i = 0;
    for (let k = 0; k < mine.length; ) {
      const t = mine[k];
      let s = 0;
      while (k < mine.length && Math.abs(mine[k] - t) < TOL) { s++; k++; }
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
  // Snap to one shared knot vector so later comparisons are exact.
  const knots = list[0].knots;
  return list.map((c) => new NurbsCurve({ degree: p, knots, cp: c.cp }));
}
