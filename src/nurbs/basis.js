// B-spline basis functions (Cox–de Boor), after Piegl & Tiller, "The NURBS Book":
// A2.1 FindSpan, A2.2 BasisFuns, A2.3 DersBasisFuns.
//
// Conventions used throughout: a curve of degree p with n+1 control points has a
// knot vector U of n+p+2 nondecreasing values, and is defined on [U[p], U[n+1]].

const scratch = [];
function buffers(p) {
  return (scratch[p] ||= {
    N: new Float64Array(p + 1),
    left: new Float64Array(p + 1),
    right: new Float64Array(p + 1),
  });
}

/** Index of the knot span containing u: U[span] <= u < U[span+1]. `n` is the last control point index. */
export function findSpan(n, p, u, U) {
  if (u >= U[n + 1]) return n;
  if (u <= U[p]) return p;
  let low = p, high = n + 1, mid = (low + high) >> 1;
  while (u < U[mid] || u >= U[mid + 1]) {
    if (u < U[mid]) high = mid;
    else low = mid;
    mid = (low + high) >> 1;
  }
  return mid;
}

/**
 * The p+1 basis functions that are non-zero on `span`, evaluated at u.
 * Returns a shared scratch array unless `out` is given; copy it if you keep it.
 */
export function basisFuns(span, u, p, U, out) {
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

/** Basis functions and their derivatives up to order `nd`: result[k][j] = d^k N_{span-p+j} / du^k. */
export function dersBasisFuns(span, u, p, nd, U) {
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
      const t = s1; s1 = s2; s2 = t;
    }
  }
  let f = p;
  for (let k = 1; k <= nd; k++) {
    for (let j = 0; j <= p; j++) ders[k][j] *= f;
    f *= p - k;
  }
  return ders;
}

/** Clamped uniform knot vector on [0, 1]: the curve starts and ends on its end control points. */
export function clampedKnots(count, degree) {
  const U = new Float64Array(count + degree + 1);
  const spans = count - degree;
  for (let i = 0; i < U.length; i++) {
    U[i] = i <= degree ? 0 : i >= count ? 1 : (i - degree) / spans;
  }
  return U;
}

/** Unclamped uniform knot vector whose domain [U[p], U[count]] is [0, 1]; used for periodic (closed) shapes. */
export function uniformKnots(count, degree) {
  const U = new Float64Array(count + degree + 1);
  const spans = count - degree;
  for (let i = 0; i < U.length; i++) U[i] = (i - degree) / spans;
  return U;
}

/** Distinct knot values inside the domain, ends included. Each consecutive pair is one polynomial span. */
export function knotBreaks(U, degree, count) {
  const a = U[degree], b = U[count];
  const out = [a];
  for (let i = degree + 1; i < count; i++) {
    if (U[i] > out[out.length - 1] + 1e-12 && U[i] < b - 1e-12) out.push(U[i]);
  }
  out.push(b);
  return out;
}

export function binomial(n, k) {
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
}
