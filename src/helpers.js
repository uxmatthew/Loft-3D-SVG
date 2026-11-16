import { Node, CurveMesh, PointsMesh } from './render/node.js';
import { NurbsCurve } from './nurbs/curve.js';

/**
 * The control net of a curve or surface as something you can add to a scene:
 * dashed polygon lines and a dot on every control point. Call `update()` on the
 * returned node after editing the geometry.
 */
export function controlNet(geometry, { color = 'ink', width = 0.8, size = 5.5, dash = [3, 3.5], ring = 'paper' } = {}) {
  const group = new Node();
  const isCurve = geometry instanceof NurbsCurve;
  const read = () => {
    if (isCurve) return { rows: [geometry.points], all: geometry.points };
    const rows = [], all = [];
    for (let i = 0; i < geometry.countU; i++) {
      const r = [];
      for (let j = 0; j < geometry.countV; j++) r.push(geometry.getPoint(i, j));
      rows.push(r); all.push(...r);
    }
    for (let j = 0; j < geometry.countV; j++) rows.push(rows.slice(0, geometry.countU).map((r) => r[j]));
    return { rows, all };
  };
  const first = read();
  const lines = first.rows.map((pts) => group.add(new CurveMesh(new NurbsCurve({ degree: 1, points: pts }), { color, width, dash })));
  const dots = group.add(new PointsMesh(first.all, { color, size, ring }));
  group.update = () => {
    const now = read();
    now.rows.forEach((pts, k) => { pts.forEach((p, i) => lines[k].geometry.setPoint(i, p)); });
    dots.points = now.all;
    group._touch();
    return group;
  };
  return group;
}

/**
 * A surface (or curve) that blends between two others: set `.t` from 0 (a) to 1 (b).
 * Both must be built the same way so their control nets line up; `a.matches(b)` tells you.
 *
 *   const m = morph(vaseA, vaseB);
 *   scene.add(m, 'clay');
 *   scene.tween(m, { t: 1 }, { duration: 900 });
 */
export function morph(a, b) {
  const ok = a.matches ? a.matches(b) : a.count === b.count && a.degree === b.degree;
  if (!ok) throw new Error('morph: both shapes need the same degrees, knots and number of control points. Build them with the same constructor and the same number of profile points.');
  const out = a.clone();
  let t = 0;
  Object.defineProperty(out, 't', {
    get: () => t,
    set(v) {
      t = v;
      const A = a.cp, B = b.cp, C = out.cp;
      for (let i = 0; i < C.length; i++) C[i] = A[i] + (B[i] - A[i]) * v;
      out.version++;
    },
    enumerable: true,
  });
  return out;
}
