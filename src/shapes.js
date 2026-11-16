// Ready-made shapes, each built from the constructors in nurbs/make.js. They are
// starting points: every one returns an ordinary NurbsSurface you can edit.

import { arc, line, curve, revolve, sweep, tube, loft, surface, plane, interpolate } from './nurbs/make.js';
import { joinCurves } from './nurbs/ops.js';
import { TAU, scaling } from './math.js';

/**
 * A turned vase. `profile` is a list of [radius, height] pairs from foot to lip;
 * the body passes smoothly through them and the foot is closed flat.
 */
export function vase({
  profile = [[0.4, -1], [0.72, -0.56], [0.8, -0.12], [0.55, 0.36], [0.27, 0.7], [0.29, 0.9], [0.4, 1]],
} = {}) {
  const pts = profile.map(([r, y]) => [r, y, 0]);
  const body = interpolate(pts);
  return revolve(joinCurves([line([0, pts[0][1], 0], pts[0]), body]));
}

/** A (p, q) torus knot as a seamless tube: p turns around the axis, q through the hole. */
export function knot({ p = 2, q = 3, radius = 1, tube: tr = 0.2, spread = 0.42 } = {}) {
  const n = 26 * Math.max(p, q), pts = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * TAU, r = radius * (1 + spread * Math.cos(q * t));
    pts.push([r * Math.cos(p * t), radius * spread * Math.sin(q * t), r * Math.sin(p * t)]);
  }
  return tube(curve(pts, { closed: true }), { radius: tr, sections: n, closed: true });
}

/** A spiral seashell: a circle swept along a widening spiral while it grows. */
export function shell({ turns = 2.75, growth = 0.17, height = 0.9 } = {}) {
  const n = Math.round(turns * 16), total = turns * TAU, pts = [];
  const size = (a) => Math.exp(growth * (a - total));
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * total, s = size(a);
    pts.push([0.56 * s * Math.cos(a), height * (0.62 - s), -0.56 * s * Math.sin(a)]);
  }
  return sweep(arc({ radius: 1 }), interpolate(pts), {
    sections: n * 2,
    scale: (t) => 0.44 * size(t * total),
  });
}

/** A smooth organic lump: a sphere-like net with its control points pushed in and out. Same seed, same blob. */
export function blob({ seed = 7, bumps = 0.32, rings = 5, around = 7 } = {}) {
  let s = seed >>> 0;
  const rand = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const noise = [];
  for (let j = 0; j < rings; j++) noise.push(Array.from({ length: around }, () => 1 + bumps * (rand() * 2 - 1)));
  const grid = [];
  for (let i = 0; i < around; i++) {
    const a = (i / around) * TAU, row = [[0, -1.05, 0], [0.5 * Math.cos(a), -1.05, -0.5 * Math.sin(a)]];
    for (let j = 0; j < rings; j++) {
      const lat = -Math.PI / 2 + (Math.PI * (j + 1)) / (rings + 1), r = 1.22 * noise[j][i];
      row.push([r * Math.cos(lat) * Math.cos(a), 1.1 * Math.sin(lat) * (0.9 + 0.1 * noise[j][i]), -r * Math.cos(lat) * Math.sin(a)]);
    }
    row.push([0.5 * Math.cos(a), 1.05, -0.5 * Math.sin(a)], [0, 1.05, 0]);
    grid.push(row);
  }
  return surface(grid, { closedU: true });
}

/** A flat band that twists as it travels along a rising curve. Open, so both sides show. */
export function ribbon({ width = 0.5, twist = Math.PI * 1.5, length = 3 } = {}) {
  const h = length / 2;
  const path = interpolate([[-h, -0.35, 0.3], [-h / 2, 0.3, -0.35], [0, -0.1, 0.25], [h / 2, 0.4, -0.3], [h, -0.2, 0.2]]);
  return sweep(line([-width / 2, 0, 0], [width / 2, 0, 0]), path, { twist, sections: 28 });
}

/** A flat sheet with a cubic control net, ready to ripple. */
export function sheet({ width = 3, depth = 3, segments = 7 } = {}) {
  return plane({ width, depth, segments: [segments, segments] });
}

/**
 * A double-ended open boat hull, lofted through its frames the way hulls have
 * always been drawn: u runs across each frame (rail to rail), v runs stern to bow.
 */
export function hull({ length = 4, beam = 1.3, depth = 0.62 } = {}) {
  //             stern                                          bow
  const at =    [0,    0.06, 0.2,  0.38, 0.55, 0.72, 0.87, 0.96, 1];
  const width = [0,    0.3,  0.78, 1.04, 1.08, 0.94, 0.56, 0.2,  0];
  const deep =  [0.5,  0.74, 0.96, 1.02, 1.02, 0.96, 0.84, 0.7,  0.5];
  const full =  [0.1,  0.35, 0.8,  1,    1,    0.8,  0.45, 0.25, 0.1];
  const sheer = [0.34, 0.24, 0.08, 0,    0,    0.06, 0.18, 0.3,  0.42];
  const frames = at.map((t, k) => {
    const x = (t - 0.5) * length, b = (beam / 2) * width[k], d = depth * deep[k];
    const top = depth * sheer[k], f = full[k];
    // Rail, topside, turn of the bilge, keel; then the same mirrored to the other side.
    const half = [
      [x, top, b],
      [x, top - d * 0.52, b * (0.84 + 0.2 * f)],
      [x, top - d * (0.82 + 0.18 * f), b * (0.3 + 0.42 * f)],
    ];
    const pts = [...half, [x, top - d, 0], ...half.slice().reverse().map(([px, py, pz]) => [px, py, -pz])];
    return curve(pts, { degree: 3 });
  });
  // The frames act as control rows rather than being passed through exactly:
  // a hull that narrows this fast would ripple if forced through every frame.
  return loft(frames, { degree: 3, interpolate: false });
}

/** Scale a surface so it fits a sphere of the given radius around the origin. */
export function normalizeSize(s, radius = 1) {
  let r = 0;
  for (let i = 0; i < s.countU; i++) {
    for (let j = 0; j < s.countV; j++) {
      const p = s.getPoint(i, j);
      r = Math.max(r, Math.hypot(p[0], p[1], p[2]));
    }
  }
  return r > 0 ? s.transform(scaling(radius / r)) : s;
}
