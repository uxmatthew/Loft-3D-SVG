import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NurbsCurve, findSpan, basisFuns, dersBasisFuns, clampedKnots,
  arc, circle, curve, line, interpolate, sphere, torus, revolve, loft, sweep, tube, capsule, cylinder, surface,
  insertKnot, refineCurve, refineSurface, subcurve, splitCurve, toBezier, elevateDegree, joinCurves, makeCompatible,
  frames,
} from '../src/index.js';

const close = (a, b, tol = 1e-9, msg) => assert.ok(Math.abs(a - b) <= tol, msg || `${a} ≉ ${b}`);
const closeP = (a, b, tol = 1e-9) => a.forEach((v, i) => close(v, b[i], tol, `[${a}] ≉ [${b}]`));
const wavy = () => new NurbsCurve({
  degree: 3,
  points: [[0, 0, 0], [1, 2, 0], [2, -1, 1], [3, 1, 0], [4, 0, -1], [5, 2, 0], [6, 0, 0]],
  weights: [1, 2, 0.5, 1, 3, 1, 1],
});
const sameShape = (a, b, tol = 1e-9) => {
  const [a0, a1] = a.domain, [b0, b1] = b.domain;
  for (let i = 0; i <= 40; i++) closeP(a.point(a0 + ((a1 - a0) * i) / 40), b.point(b0 + ((b1 - b0) * i) / 40), tol);
};

test('basis functions are non-negative and sum to one', () => {
  const p = 3, U = clampedKnots(8, p);
  for (let i = 0; i <= 50; i++) {
    const u = i / 50, span = findSpan(7, p, u, U), N = basisFuns(span, u, p, U);
    let s = 0;
    for (let k = 0; k <= p; k++) { assert.ok(N[k] >= -1e-15); s += N[k]; }
    close(s, 1, 1e-12);
  }
});

test('basis derivatives match finite differences', () => {
  const p = 3, U = [0, 0, 0, 0, 0.2, 0.5, 0.5, 0.9, 1, 1, 1, 1], n = U.length - p - 2, u = 0.37, h = 1e-6;
  const span = findSpan(n, p, u, U), D = dersBasisFuns(span, u, p, 2, U);
  const a = Float64Array.from(basisFuns(span, u - h, p, U)), b = Float64Array.from(basisFuns(span, u + h, p, U));
  for (let k = 0; k <= p; k++) close(D[1][k], (b[k] - a[k]) / (2 * h), 1e-6);
});

test('a circle built from rational quadratics is exact', () => {
  const c = circle({ radius: 2.5, center: [1, -1, 0] });
  for (let i = 0; i <= 200; i++) {
    const p = c.at(i / 200);
    close(Math.hypot(p[0] - 1, p[1] + 1), 2.5, 1e-12);
  }
  assert.ok(c.closed);
});

test('arc ends where asked', () => {
  const a = arc({ radius: 1, start: 0.3, end: 2.1 });
  closeP(a.at(0), [Math.cos(0.3), Math.sin(0.3), 0], 1e-12);
  closeP(a.at(1), [Math.cos(2.1), Math.sin(2.1), 0], 1e-12);
});

test('rational curve derivatives match finite differences', () => {
  const c = wavy(), u = 0.41, h = 1e-5;
  const [, d1, d2] = c.derivatives(u, 2);
  const a = c.point(u - h), m = c.point(u), b = c.point(u + h);
  for (let k = 0; k < 3; k++) {
    close(d1[k], (b[k] - a[k]) / (2 * h), 1e-5);
    close(d2[k], (b[k] - 2 * m[k] + a[k]) / (h * h), 1e-3);
  }
});

test('knot insertion and refinement leave the curve unchanged', () => {
  const c = wavy();
  sameShape(c, insertKnot(c, 0.33, 2));
  const r = refineCurve(c, [0.1, 0.1, 0.25, 0.6, 0.6, 0.6, 0.93]);
  assert.equal(r.count, c.count + 7);
  sameShape(c, r);
});

test('split, subcurve and Bézier decomposition preserve geometry', () => {
  const c = wavy();
  const [l, r] = splitCurve(c, 0.4);
  closeP(l.at(1), c.point(0.4));
  closeP(r.at(0), c.point(0.4));
  closeP(l.at(0), c.at(0));
  closeP(r.at(1), c.at(1));
  const sub = subcurve(c, 0.2, 0.7);
  for (let i = 0; i <= 20; i++) closeP(sub.point(0.2 + 0.025 * i), c.point(0.2 + 0.025 * i));
  const segs = toBezier(c);
  assert.equal(segs.length, c.count - c.degree);
  for (const s of segs) {
    assert.equal(s.count, c.degree + 1);
    const [a, b] = s.domain;
    closeP(s.point((a + b) / 2), c.point((a + b) / 2));
  }
});

test('degree elevation preserves geometry', () => {
  const c = wavy(), e = elevateDegree(c, 2);
  assert.equal(e.degree, 5);
  sameShape(c, e, 1e-9);
  sameShape(circle(), elevateDegree(circle()), 1e-12);
});

test('a periodic closed curve clamps without changing shape', () => {
  const c = curve([[1, 0, 0], [0, 1, 0], [-1, 0, 0], [0, -1, 0], [0.5, -0.5, 1]], { closed: true });
  assert.ok(c.closed);
  sameShape(c, subcurve(c), 1e-9);
});

test('joined curves trace their parts', () => {
  const a = line([0, 0, 0], [1, 0, 0]);
  const b = arc({ center: [1, 1, 0], radius: 1, start: -Math.PI / 2, end: 0 });
  const j = joinCurves([a, b]);
  closeP(j.at(0), [0, 0, 0]);
  closeP(j.at(1), [2, 1, 0], 1e-12);
  closeP(j.point(0.5), [0.5, 0, 0], 1e-12);
  const q = j.point(1.5);
  close(Math.hypot(q[0] - 1, q[1] - 1), 1, 1e-12);
});

test('compatible curves share knots and keep their shapes', () => {
  const a = wavy(), b = circle(), c = line([0, 0, 0], [1, 1, 1]);
  const out = makeCompatible([a, b, c]);
  assert.equal(new Set(out.map((x) => x.count)).size, 1);
  assert.equal(new Set(out.map((x) => x.degree)).size, 1);
  sameShape(a, out[0]); sameShape(b, out[1], 1e-12); sameShape(c, out[2], 1e-12);
});

test('interpolation passes through every point', () => {
  const pts = [[0, 0, 0], [1, 2, 0], [3, 1, 1], [4, 4, 0], [6, 0, -2], [7, 1, 0]];
  const c = interpolate(pts, { centripetal: false });
  // chord-length parameters are known, so check at those
  let total = 0;
  const d = [0];
  for (let i = 1; i < pts.length; i++) { total += Math.hypot(...pts[i].map((v, k) => v - pts[i - 1][k])); d.push(total); }
  pts.forEach((p, i) => closeP(c.point(d[i] / total), p, 1e-9));
});

test('sphere and torus are exact', () => {
  const s = sphere({ radius: 3 });
  for (let i = 0; i <= 12; i++) for (let j = 0; j <= 12; j++) {
    close(Math.hypot(...s.at(i / 12, j / 12)), 3, 1e-12);
  }
  const t = torus({ radius: 2, tube: 0.5 });
  for (let i = 0; i <= 12; i++) for (let j = 0; j <= 12; j++) {
    const p = t.at(i / 12, j / 12);
    close(Math.hypot(Math.hypot(p[0], p[2]) - 2, p[1]), 0.5, 1e-12);
  }
});

test('surface normals point outward on a sphere and match finite differences', () => {
  const s = sphere({ radius: 2 });
  const n = s.normal(0.3, 0.6), p = s.point(0.3, 0.6);
  closeP(n, p.map((v) => v / 2), 1e-9);
  const { du } = s.derivatives(0.3, 0.6), h = 1e-6;
  const a = s.point(0.3 - h, 0.6), b = s.point(0.3 + h, 0.6);
  for (let k = 0; k < 3; k++) close(du[k], (b[k] - a[k]) / (2 * h), 1e-5);
});

test('surface refinement and iso-curves preserve geometry', () => {
  const s = torus();
  const r = refineSurface(refineSurface(s, 'u', [0.1, 0.4, 0.4]), 'v', [0.3, 0.77]);
  for (let i = 0; i <= 8; i++) for (let j = 0; j <= 8; j++) closeP(r.at(i / 8, j / 8), s.at(i / 8, j / 8), 1e-12);
  const iso = s.isoCurve('u', 0.37);
  for (let j = 0; j <= 8; j++) closeP(iso.at(j / 8), s.point(0.37, j / 8), 1e-12);
});

test('a loft passes through its sections', () => {
  const sections = [0, 1, 2, 3].map((k) => circle({ radius: 1 + 0.5 * Math.sin(k), center: [0, 0, k] }));
  const s = loft(sections);
  // first and last sections are reproduced exactly at the ends of v
  for (let i = 0; i <= 16; i++) {
    closeP(s.at(i / 16, 0), sections[0].at(i / 16), 1e-9);
    closeP(s.at(i / 16, 1), sections[3].at(i / 16), 1e-9);
  }
  // an interior section lies on the surface: every point has z = 1 for some v
  const mid = s.isoCurve('u', 0.2);
  let best = Infinity;
  for (let j = 0; j <= 2000; j++) {
    const p = mid.at(j / 2000), q = sections[1].point(0.2);
    best = Math.min(best, Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]));
  }
  assert.ok(best < 1e-3, `interior section missed by ${best}`);
});

test('rotation-minimising frames stay orthonormal and close up on a loop', () => {
  const path = circle({ radius: 2, normal: [0, 1, 0] });
  const fr = frames(path, 24);
  assert.equal(fr.length, 24);
  for (const f of fr) {
    close(Math.hypot(...f.normal), 1, 1e-9);
    close(f.normal[0] * f.tangent[0] + f.normal[1] * f.tangent[1] + f.normal[2] * f.tangent[2], 0, 1e-9);
  }
});

test('swept tubes, capsules and cylinders build valid surfaces', () => {
  const path = interpolate([[0, 0, 0], [1, 1, 0], [2, 0, 1], [3, 1, 1]]);
  const t = tube(path, { radius: 0.2 });
  closeP(t.at(0.3, 0).map((v, k) => v - path.at(0)[k]).map(Math.abs).reduce((a, b) => [Math.hypot(a[0], b)], [0]), [0.2], 1e-9);
  const loop = tube(circle({ radius: 2, normal: [0, 1, 0] }), { radius: 0.3 });
  closeP(loop.at(0.2, 0), loop.at(0.2, 1), 1e-9);
  const c = capsule({ radius: 0.5, height: 3 });
  closeP(c.at(0, 0), [0, -1.5, 0], 1e-12);
  closeP(c.at(0, 1), [0, 1.5, 0], 1e-12);
  const cyl = cylinder({ radius: 1, height: 2 });
  closeP(cyl.at(0, 0), [0, -1, 0], 1e-12);
  const s = surface([[[0, 0, 0], [0, 0, 1]], [[1, 0, 0], [1, 1, 1]], [[2, 0, 0], [2, 0, 1]]], { degreeU: 2, degreeV: 1 });
  closeP(s.at(0, 0), [0, 0, 0]);
  const twisted = sweep(line([-0.5, 0, 0], [0.5, 0, 0]), path, { twist: Math.PI });
  assert.equal(twisted.degreeU, 1);
});
