// Constructors: the ways a designer actually makes NURBS geometry.
// Conics and surfaces of revolution are exact (rational quadratics, A7.1 and A8.1).

import { NurbsCurve } from './curve.js';
import { NurbsSurface } from './surface.js';
import { uniformKnots, clampedKnots } from './basis.js';
import { makeCompatible, joinCurves } from './ops.js';
import { interpolationSolver, interpolate } from './fit.js';
import { TAU, add, sub, scale, dot, cross, normalize, length, perpendicular } from '../math.js';

// ── Curves ──────────────────────────────────────────────────────────────────

/** A straight segment from a to b. */
export function line(a, b) {
  return new NurbsCurve({ degree: 1, points: [a, b] });
}

/** Straight segments through the points, with sharp corners. */
export function polyline(points, { closed = false } = {}) {
  const pts = closed ? [...points, points[0]] : points;
  return new NurbsCurve({ degree: 1, points: pts });
}

/**
 * A B-spline shaped by control points: it starts and ends on the end points and
 * is pulled toward the others. `closed` makes a seamless periodic loop instead.
 */
export function curve(points, { degree = 3, closed = false, weights } = {}) {
  if (!closed) return new NurbsCurve({ degree, points, weights });
  const p = Math.min(degree, points.length - 1);
  const pts = [...points, ...points.slice(0, p)];
  const w = weights ? [...weights, ...weights.slice(0, p)] : undefined;
  return new NurbsCurve({ degree: p, points: pts, weights: w, knots: uniformKnots(pts.length, p) });
}

/**
 * An exact circular or elliptical arc as a rational quadratic. Angles in radians,
 * measured from xAxis toward yAxis.
 */
export function arc({
  center = [0, 0, 0], radius = 1, radiusY = radius,
  start = 0, end = TAU, xAxis = [1, 0, 0], yAxis = [0, 1, 0],
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
    const ang = start + (i * dth) / 2;
    if (i % 2 === 0) { points.push(at(ang, 1)); weights.push(1); }
    else { points.push(at(ang, 1 / w1)); weights.push(w1); }
  }
  const knots = [0, 0, 0];
  for (let i = 1; i < narcs; i++) knots.push(i / narcs, i / narcs);
  knots.push(1, 1, 1);
  return new NurbsCurve({ degree: 2, points, weights, knots });
}

/** A full circle. `normal` sets the plane it lies in (default: the XY plane). */
export function circle({ radius = 1, center = [0, 0, 0], normal } = {}) {
  if (!normal) return arc({ radius, center });
  const n = normalize(normal), x = perpendicular(n);
  return arc({ radius, center, xAxis: x, yAxis: cross(n, x) });
}

export function ellipse({ radiusX = 1, radiusY = 0.6, center = [0, 0, 0] } = {}) {
  return arc({ radius: radiusX, radiusY, center });
}

// ── Surfaces from a control net ─────────────────────────────────────────────

/**
 * A surface shaped by a grid of control points, grid[i][j]. Closing a direction
 * makes it seamless (a tube or a ring) instead of ending on its edge rows.
 */
export function surface(grid, { degreeU = 3, degreeV = 3, closedU = false, closedV = false, weights } = {}) {
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
    degreeU: p, degreeV: q, points: pts, weights: w,
    knotsU: closedU ? uniformKnots(pts.length, p) : clampedKnots(pts.length, p),
    knotsV: closedV ? uniformKnots(pts[0].length, q) : clampedKnots(pts[0].length, q),
  });
}

/** A flat rectangle in the XZ plane, facing up. Give `segments` to get a net you can ripple. */
export function plane({ width = 2, depth = 2, segments = [1, 1], degree = 3 } = {}) {
  const [su, sv] = segments, grid = [];
  for (let i = 0; i <= su; i++) {
    const row = [];
    for (let j = 0; j <= sv; j++) row.push([(i / su - 0.5) * width, 0, (0.5 - j / sv) * depth]);
    grid.push(row);
  }
  return surface(grid, { degreeU: Math.min(degree, su), degreeV: Math.min(degree, sv) });
}

/** Sweep a curve in a straight line along `vector`. */
export function extrude(profile, vector = [0, 1, 0]) {
  const n = profile.count, cp = new Float64Array(n * 2 * 4);
  for (let i = 0; i < n; i++) {
    const w = profile.cp[i * 4 + 3];
    for (let c = 0; c < 3; c++) {
      cp[(i * 2) * 4 + c] = profile.cp[i * 4 + c];
      cp[(i * 2 + 1) * 4 + c] = profile.cp[i * 4 + c] + vector[c] * w;
    }
    cp[(i * 2) * 4 + 3] = cp[(i * 2 + 1) * 4 + 3] = w;
  }
  return new NurbsSurface({
    degreeU: profile.degree, degreeV: 1, knotsU: profile.knots, knotsV: [0, 0, 1, 1],
    cp, countU: n, countV: 2,
  });
}

/** Straight lines joining two curves, point for point. */
export function ruled(a, b) {
  return loft([a, b], { degree: 1 });
}

/**
 * Spin a profile curve around an axis: vases, bowls, wheels, domes. The result
 * is exact; a full turn is four rational quadratic quarter-arcs.
 * u runs around the axis, v runs along the profile.
 */
export function revolve(profile, { axis = [0, 1, 0], origin = [0, 0, 0], angle = TAU, start = 0 } = {}) {
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
      const ang = start + (i * dth) / 2, odd = i % 2 === 1;
      const k = odd ? r / wm : r, wi = odd ? w * wm : w;
      const Q = add(O, add(scale(X, k * Math.cos(ang)), scale(Y, k * Math.sin(ang))));
      const o = (i * nv + j) * 4;
      cp[o] = Q[0] * wi; cp[o + 1] = Q[1] * wi; cp[o + 2] = Q[2] * wi; cp[o + 3] = wi;
    }
  }
  const knotsU = [0, 0, 0];
  for (let i = 1; i < narcs; i++) knotsU.push(i / narcs, i / narcs);
  knotsU.push(1, 1, 1);
  return new NurbsSurface({ degreeU: 2, degreeV: profile.degree, knotsU, knotsV: profile.knots, cp, countU: nu, countV: nv });
}

// ── Solids of revolution ────────────────────────────────────────────────────

export function sphere({ radius = 1 } = {}) {
  return revolve(arc({ radius, start: -Math.PI / 2, end: Math.PI / 2 }));
}

/** A ring: `radius` to the centre of the tube, `tube` the tube's own radius. */
export function torus({ radius = 1, tube = 0.4 } = {}) {
  return revolve(arc({ radius: tube, center: [radius, 0, 0] }));
}

export function cylinder({ radius = 1, height = 2, caps = true } = {}) {
  const h = height / 2;
  const pts = caps
    ? [[0, -h, 0], [radius, -h, 0], [radius, h, 0], [0, h, 0]]
    : [[radius, -h, 0], [radius, h, 0]];
  return revolve(polyline(pts));
}

export function cone({ radius = 1, height = 2, top = 0, caps = true } = {}) {
  const h = height / 2, pts = [];
  if (caps) pts.push([0, -h, 0]);
  pts.push([radius, -h, 0], [top, h, 0]);
  if (caps && top > 0) pts.push([0, h, 0]);
  return revolve(polyline(pts));
}

/** A cylinder with hemispherical ends. `height` is the full length, ends included. */
export function capsule({ radius = 0.5, height = 2 } = {}) {
  const h = Math.max(0, height / 2 - radius);
  const parts = [arc({ radius, center: [0, -h, 0], start: -Math.PI / 2, end: 0 })];
  if (h > 0) parts.push(line([radius, -h, 0], [radius, h, 0]));
  parts.push(arc({ radius, center: [0, h, 0], start: 0, end: Math.PI / 2 }));
  return revolve(joinCurves(parts));
}

// ── Lofting and sweeping ────────────────────────────────────────────────────

/**
 * Skin a surface over a row of section curves, the way a hull is planked over
 * its frames. With `interpolate` (default) the surface passes through every
 * section; without it the sections act as control rows. `closed` joins the last
 * section back to the first.
 * u runs along each section, v runs from section to section.
 */
export function loft(sections, { degree = 3, interpolate: through = true, closed = false } = {}) {
  if (sections.length < 2) throw new Error('loft: at least two sections are needed');
  const curves = makeCompatible(sections);
  const n = curves[0].count, K = curves.length, p = curves[0].degree;
  const q = Math.min(degree, K - 1);
  let rows = curves.map((c) => c.cp), knotsV;

  if (closed) {
    rows = [...rows, ...rows.slice(0, q)];
    knotsV = uniformKnots(rows.length, q);
  } else if (through && K > 2) {
    // Parameters across the sections: averaged chord length over every control column.
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
      for (let k = 1; k < K; k++) { acc += d[k]; params[k] += acc / total; }
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

/**
 * Rotation-minimising frames along a curve (double reflection, Wang et al. 2008).
 * Unlike Frenet frames these never flip at inflections, so swept sections do not twist.
 */
export function frames(path, count, closed = path.closed) {
  const [a, b] = path.domain, out = [];
  const steps = closed ? count : count - 1;
  let t0 = path.tangent(a), x0 = path.point(a);
  let r = perpendicular(t0);
  // Prefer "up" as the starting normal when possible, so results are predictable.
  const up = sub([0, 1, 0], scale(t0, t0[1]));
  if (length(up) > 0.1) r = normalize(up);
  out.push({ t: 0, origin: x0, tangent: t0, normal: r, binormal: cross(t0, r) });
  for (let i = 1; i <= steps; i++) {
    const u = a + ((b - a) * i) / steps;
    const x1 = path.point(u), t1 = path.tangent(u);
    const v1 = sub(x1, x0), c1 = dot(v1, v1);
    let rL = r, tL = t0;
    if (c1 > 1e-20) {
      rL = sub(r, scale(v1, (2 / c1) * dot(v1, r)));
      tL = sub(t0, scale(v1, (2 / c1) * dot(v1, t0)));
    }
    const v2 = sub(t1, tL), c2 = dot(v2, v2);
    r = c2 > 1e-20 ? sub(rL, scale(v2, (2 / c2) * dot(v2, rL))) : rL;
    r = normalize(sub(r, scale(t1, dot(r, t1))));
    x0 = x1; t0 = t1;
    out.push({ t: i / steps, origin: x1, tangent: t1, normal: r, binormal: cross(t1, r) });
  }
  if (closed) {
    // The frame comes back rotated by some angle; spread the correction along the loop.
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

/**
 * Carry a profile curve along a path: tubes, horns, ribbons, knots. The profile
 * is drawn in its own XY plane; `scale` and `twist` may be numbers or functions
 * of t ∈ [0, 1] along the path. A closed path gives a seamless loop.
 * u runs around the profile, v runs along the path.
 */
export function sweep(profile, path, { sections, scale: sc = 1, twist = 0, closed = path.closed } = {}) {
  const spans = path.count - path.degree;
  const K = sections || Math.max(12, Math.min(160, spans * 2));
  const fr = frames(path, closed ? K : K + 1, closed);
  const n = profile.count, nv = fr.length;
  const rows = fr.map((f) => {
    const s = typeof sc === 'function' ? sc(f.t) : sc;
    const a = typeof twist === 'function' ? twist(f.t) : twist * f.t;
    const [sx, sy] = Array.isArray(s) ? s : [s, s];
    const c = Math.cos(a), sn = Math.sin(a);
    const N = add(scale(f.normal, c), scale(f.binormal, sn));
    const B = add(scale(f.normal, -sn), scale(f.binormal, c));
    const row = new Float64Array(n * 4);
    for (let i = 0; i < n; i++) {
      const w = profile.cp[i * 4 + 3];
      const px = (profile.cp[i * 4] / w) * sx, py = (profile.cp[i * 4 + 1] / w) * sy;
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
    degreeU: profile.degree, degreeV: q, knotsU: profile.knots,
    knotsV: closed ? uniformKnots(all.length, q) : clampedKnots(all.length, q),
    cp, countU: n, countV: all.length,
  });
}

/** A round tube along a path. `radius` may be a function of t ∈ [0, 1]. */
export function tube(path, { radius = 0.1, sections, closed } = {}) {
  const opts = { sections, scale: radius };
  if (closed !== undefined) opts.closed = closed;
  return sweep(arc({ radius: 1 }), path, opts);
}

export { interpolate };
