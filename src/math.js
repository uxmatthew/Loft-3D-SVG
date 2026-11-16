// Small vector and matrix helpers. Points are plain [x, y, z] arrays at the API
// surface; matrices are column-major Float64Array(16), the same layout WebGL uses.

export const TAU = Math.PI * 2;
export const EPS = 1e-9;

export const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);
export const lerp = (a, b, t) => a + (b - a) * t;

export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const length = (a) => Math.hypot(a[0], a[1], a[2]);
export const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
export function normalize(a) {
  const l = length(a);
  return l > 1e-14 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 0, 0];
}

/** Any unit vector perpendicular to `v`. */
export function perpendicular(v) {
  const a = Math.abs(v[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  return normalize(cross(v, a));
}

// ── 4×4 matrices ────────────────────────────────────────────────────────────

export function identity(out = new Float64Array(16)) {
  out.fill(0);
  out[0] = out[5] = out[10] = out[15] = 1;
  return out;
}

/** out = a · b */
export function multiply(a, b, out = new Float64Array(16)) {
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

/** Translation · rotation (Euler XYZ, radians) · scale. */
export function compose(p, r, s, out = new Float64Array(16)) {
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

export function translation(v) {
  const m = identity();
  m[12] = v[0]; m[13] = v[1]; m[14] = v[2];
  return m;
}

export function scaling(v) {
  const s = typeof v === 'number' ? [v, v, v] : v;
  const m = identity();
  m[0] = s[0]; m[5] = s[1]; m[10] = s[2];
  return m;
}

/** Rotation by `angle` radians about a unit `axis` through the origin. */
export function rotation(axis, angle) {
  const [x, y, z] = normalize(axis);
  const c = Math.cos(angle), s = Math.sin(angle), t = 1 - c;
  const m = identity();
  m[0] = t * x * x + c; m[1] = t * x * y + s * z; m[2] = t * x * z - s * y;
  m[4] = t * x * y - s * z; m[5] = t * y * y + c; m[6] = t * y * z + s * x;
  m[8] = t * x * z + s * y; m[9] = t * y * z - s * x; m[10] = t * z * z + c;
  return m;
}

/** View matrix for a camera at `eye` looking at `target`. */
export function lookAt(eye, target, up, out = new Float64Array(16)) {
  let z = normalize(sub(eye, target));
  if (length(z) === 0) z = [0, 0, 1];
  let x = normalize(cross(up, z));
  if (length(x) === 0) x = perpendicular(z);
  const y = cross(z, x);
  out[0] = x[0]; out[1] = y[0]; out[2] = z[0]; out[3] = 0;
  out[4] = x[1]; out[5] = y[1]; out[6] = z[1]; out[7] = 0;
  out[8] = x[2]; out[9] = y[2]; out[10] = z[2]; out[11] = 0;
  out[12] = -dot(x, eye); out[13] = -dot(y, eye); out[14] = -dot(z, eye); out[15] = 1;
  return out;
}

export function transformPoint(m, p) {
  return [
    m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
    m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
    m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
  ];
}

export function transformDirection(m, v) {
  return [
    m[0] * v[0] + m[4] * v[1] + m[8] * v[2],
    m[1] * v[0] + m[5] * v[1] + m[9] * v[2],
    m[2] * v[0] + m[6] * v[1] + m[10] * v[2],
  ];
}
