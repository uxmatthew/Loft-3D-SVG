// Global interpolation: find the B-spline that passes through given points
// (Piegl & Tiller §9.2, A9.1). One small dense linear system per fit.

import { findSpan, basisFuns } from './basis.js';
import { NurbsCurve } from './curve.js';

/** Chord-length (alpha = 1) or centripetal (alpha = 0.5) parameters in [0, 1] for a point sequence. */
export function chordParams(points, alpha = 1) {
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

/** Knots by averaging the parameters (eq. 9.8), which keeps the system well conditioned. */
export function averagedKnots(params, p) {
  const n = params.length - 1, U = new Float64Array(n + p + 2);
  for (let i = n + 1; i < U.length; i++) U[i] = 1;
  for (let j = 1; j <= n - p; j++) {
    let s = 0;
    for (let i = j; i < j + p; i++) s += params[i];
    U[j + p] = s / p;
  }
  return U;
}

/**
 * Prepare an interpolation through values given at `params`. Returns the knot
 * vector and a `solve` that maps a column of data to a column of control values,
 * so one factorisation serves x, y, z, w and every row of a surface.
 */
export function interpolationSolver(params, p) {
  const n = params.length - 1, size = n + 1;
  const U = averagedKnots(params, p);
  const A = new Float64Array(size * size);
  for (let k = 0; k <= n; k++) {
    const span = findSpan(n, p, params[k], U), N = basisFuns(span, params[k], p, U);
    for (let j = 0; j <= p; j++) A[k * size + span - p + j] = N[j];
  }
  // LU factorisation with partial pivoting.
  const piv = new Int32Array(size);
  for (let i = 0; i < size; i++) piv[i] = i;
  for (let c = 0; c < size; c++) {
    let best = c, max = Math.abs(A[c * size + c]);
    for (let r = c + 1; r < size; r++) {
      const v = Math.abs(A[r * size + c]);
      if (v > max) { max = v; best = r; }
    }
    if (max < 1e-14) throw new Error('interpolate: points are degenerate (two samples share a parameter)');
    if (best !== c) {
      for (let k = 0; k < size; k++) {
        const t = A[c * size + k]; A[c * size + k] = A[best * size + k]; A[best * size + k] = t;
      }
      const t = piv[c]; piv[c] = piv[best]; piv[best] = t;
    }
    for (let r = c + 1; r < size; r++) {
      const f = (A[r * size + c] /= A[c * size + c]);
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

/**
 * A smooth curve that passes through every given point.
 * @param {number[][]} points
 * @param {object} [o]
 * @param {number} [o.degree=3]
 * @param {boolean} [o.centripetal=true] gentler through uneven spacing than chord-length
 */
export function interpolate(points, { degree = 3, centripetal = true } = {}) {
  if (points.length < 2) throw new Error('interpolate: at least two points are needed');
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
