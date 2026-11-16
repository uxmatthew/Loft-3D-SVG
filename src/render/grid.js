// Turns a NURBS surface into a grid of points for drawing. The basis functions
// depend only on where the samples are, so they are tabulated once; moving the
// control points afterwards (animation) costs a handful of weighted sums.

import { findSpan, basisFuns, knotBreaks } from '../nurbs/basis.js';

/** Samples per knot span so the grid has enough lines to place `iso` evenly spaced iso-lines on. */
export function alignPerSpan(per, spans, iso) {
  if (!iso) return per;
  return Math.max(per, Math.ceil((iso * (iso >= 24 ? 1 : 2)) / spans));
}

function sampleDirection(U, degree, count, per, range, iso) {
  const br = knotBreaks(U, degree, count), spans = br.length - 1;
  const total = spans * per;
  const full = [], flag = new Array(total + 1).fill(0);
  // Iso-lines sit on the grid lines nearest to an even spacing.
  for (let k = 0; iso && k <= iso; k++) flag[Math.round((k * total) / iso)] = 1;
  for (let s = 0; s < spans; s++) {
    for (let k = 0; k < per; k++) full.push(br[s] + ((br[s + 1] - br[s]) * k) / per);
  }
  full.push(br[spans]);
  // Grid lines where the surface may have a real crease: knots repeated `degree` times.
  const sharp = new Array(total + 1).fill(0);
  for (let s = 1; s < spans; s++) {
    let mult = 0;
    for (let i = degree + 1; i < count; i++) if (Math.abs(U[i] - br[s]) < 1e-12) mult++;
    if (mult >= degree) sharp[s * per] = 1;
  }

  const a = br[0], b = br[spans], eps = (b - a) * 1e-9;
  const lo = a + (b - a) * Math.max(0, Math.min(1, range[0]));
  const hi = a + (b - a) * Math.max(0, Math.min(1, range[1]));
  // `rank` is where each sample falls on the whole grid, counted in grid lines. Iso-lines
  // are evenly spaced in it, which is what measuring the gap between them relies on.
  let params = full, flags = flag, creases = sharp, rank = full.map((_, i) => i);
  if (lo > a + eps || hi < b - eps) {
    const rankOf = (t) => {
      let i = 0;
      while (i < total - 1 && full[i + 1] <= t) i++;
      return i + (t - full[i]) / (full[i + 1] - full[i]);
    };
    params = [lo]; flags = [0]; creases = [0]; rank = [rankOf(lo)];
    for (let i = 0; i < full.length; i++) {
      if (full[i] > lo + eps && full[i] < hi - eps) { params.push(full[i]); flags.push(flag[i]); creases.push(sharp[i]); rank.push(i); }
    }
    if (hi > lo + eps) { params.push(hi); flags.push(0); creases.push(0); rank.push(rankOf(hi)); }
  }
  const n = params.length, p = degree;
  const span = new Int32Array(n), N = new Float64Array(n * (p + 1));
  for (let i = 0; i < n; i++) {
    span[i] = findSpan(count - 1, p, params[i], U);
    N.set(basisFuns(span[i], params[i], p, U).subarray(0, p + 1), i * (p + 1));
  }
  return { params: Float64Array.from(params), iso: Uint8Array.from(flags), sharp: Uint8Array.from(creases), rank: Float64Array.from(rank), span, N, spans };
}

/**
 * For one family of iso-lines, how far each line lies from its neighbours at every
 * sample along it: the distance across the lines that one grid line covers, square to
 * the line. Written to `out` as a share of the spacing around the family's middle line
 * (the median of each line's own average), so that line keeps its weight, lines that
 * have fanned out from it gain and lines that crowd lose.
 *
 * `iso` and `rank` belong to the direction across the lines (n samples, `stride` apart
 * in the grid); the lines run along the other direction (m samples, `step` apart).
 */
function measureGaps(pos, out, iso, rank, n, stride, closed, m, step, closedAlong, tiny) {
  const period = rank[n - 1] - rank[0], perLine = [];
  for (let a = 0; a < n; a++) {
    if (!iso[a]) continue;
    let logs = 0, weight = 0;
    // Neighbours across: around the seam of a closed direction (whose last sample repeats its first), else one-sided at the ends.
    let a0 = a - 1, a1 = a + 1, r0 = rank[a0], r1 = rank[a1];
    if (a === 0) { if (closed) { a0 = n - 2; r0 = rank[a0] - period; } else { a0 = 0; r0 = rank[0]; } }
    if (a === n - 1) { if (closed) { a1 = 1; r1 = rank[1] + period; } else { a1 = n - 1; r1 = rank[n - 1]; } }
    const dr = r1 - r0;
    if (!(dr > 0)) continue;
    for (let l = 0; l < m; l++) {
      let l0 = l - 1, l1 = l + 1;
      if (l === 0) l0 = closedAlong ? m - 2 : 0;
      if (l === m - 1) l1 = closedAlong ? 1 : m - 1;
      const v = a * stride + l * step, p = (a0 * stride + l * step) * 3, q = (a1 * stride + l * step) * 3;
      const s = (a * stride + l0 * step) * 3, e = (a * stride + l1 * step) * 3;
      // Across the lines, per grid line...
      let dx = (pos[q] - pos[p]) / dr, dy = (pos[q + 1] - pos[p + 1]) / dr, dz = (pos[q + 2] - pos[p + 2]) / dr;
      // ...less whatever runs along the line, where the grid is sheared.
      const tx = pos[e] - pos[s], ty = pos[e + 1] - pos[s + 1], tz = pos[e + 2] - pos[s + 2], tt = tx * tx + ty * ty + tz * tz;
      if (tt > tiny) {
        const k = (dx * tx + dy * ty + dz * tz) / tt;
        dx -= k * tx; dy -= k * ty; dz -= k * tz;
      }
      const gap = Math.hypot(dx, dy, dz);
      out[v] = gap;
      if (gap > 0 && tt > tiny) {
        const w = Math.sqrt(tt) / (closedAlong || (l > 0 && l < m - 1) ? 2 : 1); // the length of line this sample stands for
        logs += w * Math.log(gap);
        weight += w;
      }
    }
    if (weight > 0) perLine.push(logs / weight); // a line shrunk to a point (a pole) has no say
  }
  perLine.sort((x, y) => x - y);
  const h = perLine.length >> 1;
  const usual = !perLine.length ? 1 : Math.exp(perLine.length & 1 ? perLine[h] : (perLine[h - 1] + perLine[h]) / 2);
  for (let a = 0; a < n; a++) {
    if (!iso[a]) continue;
    for (let l = 0; l < m; l++) out[a * stride + l * step] /= usual;
  }
}

export class SurfaceGrid {
  constructor() {
    this.key = '';
    this.version = -1;
    this.NU = 0;
    this.NV = 0;
    this.pos = new Float64Array(0);
    this.center = [0, 0, 0];
    this.radius = 1;
    this.stamp = 0; // counts evaluations, so anything measured from the points knows when it is stale
    this._gaps = null;
  }

  /** Lay out the sample grid. Cheap to call every frame: it only rebuilds when something changed. */
  build(surface, perU, perV, range, isoU, isoV) {
    const key = [perU, perV, range.u, range.v, isoU, isoV, surface.countU, surface.countV].join('|');
    if (key === this.key && this.surface === surface) return false;
    this.key = key;
    this.surface = surface;
    this.u = sampleDirection(surface.knotsU, surface.degreeU, surface.countU, perU, range.u, isoU);
    this.v = sampleDirection(surface.knotsV, surface.degreeV, surface.countV, perV, range.v, isoV);
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
    this.tmp = new Float64Array(surface.countV * 4);
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
          const b = vs.N[j * (q + 1) + l], o = o0 + l * 4;
          x += b * tmp[o]; y += b * tmp[o + 1]; z += b * tmp[o + 2]; w += b * tmp[o + 3];
        }
        const o = (i * NV + j) * 3;
        pos[o] = x / w; pos[o + 1] = y / w; pos[o + 2] = z / w;
      }
    }
    if (deform) {
      const pt = [0, 0, 0];
      const [ua, ub] = s.domainU, [va, vb] = s.domainV;
      for (let i = 0; i < NU; i++) {
        const u = (us.params[i] - ua) / (ub - ua);
        for (let j = 0; j < NV; j++) {
          const o = (i * NV + j) * 3;
          pt[0] = pos[o]; pt[1] = pos[o + 1]; pt[2] = pos[o + 2];
          deform(pt, u, (vs.params[j] - va) / (vb - va), time);
          pos[o] = pt[0]; pos[o + 1] = pt[1]; pos[o + 2] = pt[2];
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
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
      if (z < z0) z0 = z; if (z > z1) z1 = z;
    }
    const c = (this.center = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2]);
    let r2 = 0;
    for (let o = 0; o < pos.length; o += 3) {
      const d = (pos[o] - c[0]) ** 2 + (pos[o + 1] - c[1]) ** 2 + (pos[o + 2] - c[2]) ** 2;
      if (d > r2) r2 = d;
    }
    this.radius = Math.sqrt(r2) || 1;
    const tol = this.radius * 1e-6;
    const same = (a, b) =>
      Math.abs(pos[a * 3] - pos[b * 3]) < tol &&
      Math.abs(pos[a * 3 + 1] - pos[b * 3 + 1]) < tol &&
      Math.abs(pos[a * 3 + 2] - pos[b * 3 + 2]) < tol;
    const every = (n, fn) => { for (let i = 0; i < n; i++) if (!fn(i)) return false; return n > 0; };
    const lastU = (NU - 1) * NV;
    this.closedU = NU > 2 && every(NV, (j) => same(j, lastU + j));
    this.closedV = NV > 2 && every(NU, (i) => same(i * NV, i * NV + NV - 1));
    const poleU0 = every(NV, (j) => same(0, j)), poleU1 = every(NV, (j) => same(lastU, lastU + j));
    const poleV0 = every(NU, (i) => same(0, i * NV)), poleV1 = every(NU, (i) => same(NV - 1, i * NV + NV - 1));
    this.poles = [poleU0, poleU1, poleV0, poleV1];
    this.solid = (this.closedU || (poleU0 && poleU1)) && (this.closedV || (poleV0 && poleV1));
    // Signed volume tells which way S_u × S_v points: outward (+1) or inward (-1).
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
      let len = 0, turn = 0, px = 0, py = 0, pz = 0, pl = 0;
      for (let k = 1; k < n; k++) {
        const a = (start + (k - 1) * stride) * 3, b = (start + k * stride) * 3;
        const x = pos[b] - pos[a], y = pos[b + 1] - pos[a + 1], z = pos[b + 2] - pos[a + 2];
        const l = Math.hypot(x, y, z);
        if (l < 1e-12) continue;
        if (pl) turn += Math.acos(Math.max(-1, Math.min(1, (x * px + y * py + z * pz) / (l * pl))));
        px = x; py = y; pz = z; pl = l;
        len += l;
      }
      return [len, turn];
    };
    const out = [0, 0, 0, 0];
    for (const f of [0, 0.2, 0.4, 0.6, 0.8, 1]) {
      const u = run(Math.round(f * (NV - 1)), NV, NU), v = run(Math.round(f * (NU - 1)) * NV, 1, NV);
      if (this.closedU) u[1] = Math.max(u[1], Math.PI * 2);
      if (this.closedV) v[1] = Math.max(v[1], Math.PI * 2);
      out[0] = Math.max(out[0], u[0]); out[1] = Math.max(out[1], u[1]);
      out[2] = Math.max(out[2], v[0]); out[3] = Math.max(out[3], v[1]);
    }
    return out;
  }
}

function triple(p, a, b, c, o) {
  const ax = p[a] - o[0], ay = p[a + 1] - o[1], az = p[a + 2] - o[2];
  const bx = p[b] - o[0], by = p[b + 1] - o[1], bz = p[b + 2] - o[2];
  const cx = p[c] - o[0], cy = p[c + 1] - o[1], cz = p[c + 2] - o[2];
  return ax * (by * cz - bz * cy) + ay * (bz * cx - bx * cz) + az * (bx * cy - by * cx);
}
