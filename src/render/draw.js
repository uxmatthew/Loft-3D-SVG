// The painter. Every frame it turns surfaces, curves and points into small 2D
// primitives (facets, line segments, dots), sorts them far-to-near, and merges
// neighbours that share a style into one SVG path. There is no depth buffer in
// SVG, so drawing order is the only thing that hides what is behind.

import { multiply } from '../math.js';
import { knotBreaks } from '../nurbs/basis.js';

const r1 = (x) => Math.round(x * 10) / 10;
const MV = new Float64Array(16);
const STRIDE = 12; // room for a polygon of up to six corners
const PX = new Float64Array(8), PY = new Float64Array(8), NX = new Float64Array(8), NY = new Float64Array(8);
// Primitive kinds: 3..6 = filled polygon with that many corners, 1 = line segment, 2 = dot, 0 = ready-made path,
// 7 = a ready-made path that must stay a path of its own (a flat shape whose stroke its neighbours may cover).
const LAYERED = 1e9; // sort keys from here up are explicit layers, in front of everything sorted by depth
// At `lines.spread` 1, spacing moves a line's weight by up to a doubling either way (twice as heavy, or
// half), easing toward that limit: lines spread far apart read as stripes, not as a tone, however heavy.
const SPREAD = 1;
// Toward the outline, where the surface turns away from the viewer (the cosine of the angle falls
// below this), the weight a line gains from spreading fades to nothing, so it never sticks out past it.
const EDGEWISE = 0.35;

export class Painter {
  constructor() {
    this.cap = 0;
    this.count = 0;
    this.styleIds = new Map();
    this.css = [];
    this.cssVersion = 0;
    this.paths = [];
    this.runStyle = [];
    this.runD = [];
    this.runs = 0;
    this.shadow = '';
    this._grow(2048);
  }

  _grow(cap) {
    const key = new Float64Array(cap), sty = new Int32Array(cap);
    const kind = new Uint8Array(cap), geo = new Float32Array(cap * STRIDE);
    if (this.cap) { key.set(this.key); sty.set(this.sty); kind.set(this.kind); geo.set(this.geo); }
    this.key = key; this.sty = sty; this.kind = kind; this.geo = geo;
    this.order = new Uint32Array(cap);
    this.cap = cap;
  }

  /** Intern a CSS declaration block; returns its id. */
  style(decl) {
    let id = this.styleIds.get(decl);
    if (id === undefined) {
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
    this.shadow = '';
  }

  _push(kind, style, key) {
    if (this.count === this.cap) this._grow(this.cap * 2);
    const i = this.count++;
    this.kind[i] = kind; this.sty[i] = style; this.key[i] = key;
    return i * STRIDE;
  }

  /**
   * A filled polygon of n (3..6) corners. `grow` moves every edge outward by
   * that many pixels, so neighbours overlap and no hairline of background
   * shows between them (SVG anti-aliases each shape on its own).
   */
  poly(style, key, n, X, Y, grow) {
    if (!grow) {
      const o = this._push(n, style, key), g = this.geo;
      for (let i = 0; i < n; i++) { g[o + i * 2] = X[i]; g[o + i * 2 + 1] = Y[i]; }
      return;
    }
    // Drop repeated corners (facets at a pole are triangles in disguise).
    let m = 0;
    for (let i = 0; i < n; i++) {
      const j = i === 0 ? n - 1 : i - 1;
      if (Math.abs(X[i] - X[j]) + Math.abs(Y[i] - Y[j]) > 1e-3) { PX[m] = X[i]; PY[m++] = Y[i]; }
    }
    if (m < 3) return;
    let area = 0;
    for (let i = 0; i < m; i++) {
      const j = i + 1 === m ? 0 : i + 1;
      const dx = PX[j] - PX[i], dy = PY[j] - PY[i], l = Math.hypot(dx, dy);
      NX[i] = dy / l; NY[i] = -dx / l;
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
    g[o] = x0; g[o + 1] = y0; g[o + 2] = x1; g[o + 3] = y1;
  }

  dot(style, key, x, y) {
    const o = this._push(2, style, key), g = this.geo;
    g[o] = x; g[o + 1] = y;
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
    let runs = 0, cur = -1, d = '', alone = false;
    for (let k = 0; k < n; k++) {
      const i = order[k], s = sty[i], o = i * STRIDE, kd = kind[i];
      if (s !== cur || alone || kd === 7) {
        if (cur >= 0) { runStyle[runs] = cur; runD[runs++] = d; }
        cur = s; d = '';
      }
      alone = kd === 7;
      if (kd >= 3 && kd < 7) {
        d += 'M' + r1(geo[o]) + ' ' + r1(geo[o + 1]) + 'L' + r1(geo[o + 2]) + ' ' + r1(geo[o + 3]);
        for (let v = 2; v < kd; v++) d += ' ' + r1(geo[o + v * 2]) + ' ' + r1(geo[o + v * 2 + 1]);
        d += 'Z';
      } else if (kd === 1) {
        d += 'M' + r1(geo[o]) + ' ' + r1(geo[o + 1]) + 'L' + r1(geo[o + 2]) + ' ' + r1(geo[o + 3]);
      } else if (kd === 2) {
        d += 'M' + r1(geo[o]) + ' ' + r1(geo[o + 1]) + 'h.01';
      } else {
        d += this.paths[geo[o]];
      }
    }
    if (cur >= 0) { runStyle[runs] = cur; runD[runs++] = d; }
    this.runs = runs;
  }
}

function toView(pos, n, ctx, view, scr, ok) {
  const m = MV, { ortho, os, f, near, ox, oy } = ctx;
  for (let v = 0, o = 0; v < n; v++, o += 3) {
    const x = pos[o], y = pos[o + 1], z = pos[o + 2];
    const vx = m[0] * x + m[4] * y + m[8] * z + m[12];
    const vy = m[1] * x + m[5] * y + m[9] * z + m[13];
    const vz = m[2] * x + m[6] * y + m[10] * z + m[14];
    view[o] = vx; view[o + 1] = vy; view[o + 2] = vz;
    if (ortho) {
      scr[v * 2] = vx * os + ox; scr[v * 2 + 1] = -vy * os + oy; ok[v] = 1;
    } else if (vz > -near) {
      ok[v] = 0;
    } else {
      const k = f / -vz;
      scr[v * 2] = vx * k + ox; scr[v * 2 + 1] = -vy * k + oy; ok[v] = 1;
    }
  }
}

// Scratch polygons for splitting a facet into tone bands.
const QX = new Float64Array(8), QY = new Float64Array(8), QT = new Float64Array(8);
const AX = new Float64Array(8), AY = new Float64Array(8), AT = new Float64Array(8);
const BX = new Float64Array(8), BY = new Float64Array(8), BT = new Float64Array(8);

/** Keep the part of a polygon where tone >= thr (above) or tone <= thr. Returns the new corner count. */
function clipTone(n, X, Y, T, thr, above, OX, OY, OT) {
  let m = 0;
  for (let i = 0; i < n; i++) {
    const j = i + 1 === n ? 0 : i + 1, a = T[i], b = T[j];
    const ia = above ? a >= thr : a <= thr, ib = above ? b >= thr : b <= thr;
    if (ia) { OX[m] = X[i]; OY[m] = Y[i]; OT[m++] = a; }
    if (ia !== ib) {
      const f = (thr - a) / (b - a);
      OX[m] = X[i] + (X[j] - X[i]) * f; OY[m] = Y[i] + (Y[j] - Y[i]) * f; OT[m++] = thr;
    }
  }
  return m;
}

export function drawSurface(mesh, ctx, P) {
  const g = mesh._grid, mat = mesh._compiled;
  const { NU, NV, pos, view, screen: scr, ok, fkey, fnormal, ftone, fstate, ffacing, vnormal, vtone, vtoneBack } = g;
  if (NU < 2 || NV < 2) return;
  const NUf = NU - 1, NVf = NV - 1, nvert = NU * NV;
  multiply(ctx.view, mesh.world, MV);
  toView(pos, nvert, ctx, view, scr, ok);

  const m = MV;
  const det = m[0] * (m[5] * m[10] - m[6] * m[9]) - m[4] * (m[1] * m[10] - m[2] * m[9]) + m[8] * (m[1] * m[6] - m[2] * m[5]);
  const sign = g.sign * (mat.flip ? -1 : 1) * (det < 0 ? -1 : 1);
  const culled = mat.cull === true || (mat.cull === 'auto' && g.solid);
  const { ortho, eps } = ctx, [Lx, Ly, Lz] = ctx.L, [Hx, Hy, Hz] = ctx.H;
  const fill = mat.fill, lines = mat.lines, outline = mat.outline, dots = mat.dots;
  const ambient = fill ? fill.ambient : 0.2, wrap = fill ? fill.wrap : 0.3;
  const spec = fill ? fill.specular : 0, shin = fill ? fill.shininess : 28, backDim = fill ? fill.back : 0.78;
  const lit = 0.86 - ambient; // diffuse light tops out below 1; the last tones are left for the highlight
  const shade = (ndl, ndh) => {
    let t = ambient + lit * Math.max(0, (ndl + wrap) / (1 + wrap));
    if (spec && ndh > 0) t += spec * Math.pow(ndh, shin);
    return t < 0 ? 0 : t > 1 ? 1 : t;
  };
  const smooth = fill && fill.tones > 1 && !fill.facets;
  const spread = lines && lines.spread > 0 && (lines.u || lines.v); // lines that swell where they fan out need to know how each facet faces

  // Ground shadow: project every vertex along the light onto the ground plane.
  const sh = ctx.shadow && mesh.castShadow ? ctx.shadow : null, shp = g.shadow;
  if (sh) {
    const [nx, ny, nz] = sh.n;
    for (let v = 0, o = 0; v < nvert; v++, o += 3) {
      const x = view[o], y = view[o + 1], z = view[o + 2];
      const t = Math.max(0, (nx * x + ny * y + nz * z - sh.d) / sh.nl);
      const qx = x - Lx * t, qy = y - Ly * t, qz = z - Lz * t;
      if (ortho) { shp[v * 2] = qx * ctx.os + ctx.ox; shp[v * 2 + 1] = -qy * ctx.os + ctx.oy; }
      else if (qz > -ctx.near || !ok[v]) shp[v * 2] = NaN;
      else { const k = ctx.f / -qz; shp[v * 2] = qx * k + ctx.ox; shp[v * 2 + 1] = -qy * k + ctx.oy; }
    }
  }
  let shadowD = '';
  if (smooth) vnormal.fill(0);

  // ── Pass 1: classify every facet (normal, facing, depth, flat tone) ───────
  for (let i = 0; i < NUf; i++) {
    for (let j = 0; j < NVf; j++) {
      const fi = i * NVf + j;
      const a = i * NV + j, b = a + NV, c = b + 1, d = a + 1;
      if (!(ok[a] && ok[b] && ok[c] && ok[d])) { fstate[fi] = 0; continue; }
      const a3 = a * 3, b3 = b * 3, c3 = c * 3, d3 = d * 3;
      const e1x = view[c3] - view[a3], e1y = view[c3 + 1] - view[a3 + 1], e1z = view[c3 + 2] - view[a3 + 2];
      const e2x = view[d3] - view[b3], e2y = view[d3 + 1] - view[b3 + 1], e2z = view[d3 + 2] - view[b3 + 2];
      let nx = (e1y * e2z - e1z * e2y) * sign, ny = (e1z * e2x - e1x * e2z) * sign, nz = (e1x * e2y - e1y * e2x) * sign;
      const len = Math.hypot(nx, ny, nz);
      if (len < 1e-20) { fstate[fi] = 0; continue; }
      nx /= len; ny /= len; nz /= len;
      if (smooth) {
        // Each vertex gets the average of the unit normals around it. Unweighted, so a
        // sliver of a facet at a crease counts as much as the broad face beside it.
        vnormal[a3] += nx; vnormal[a3 + 1] += ny; vnormal[a3 + 2] += nz;
        vnormal[b3] += nx; vnormal[b3 + 1] += ny; vnormal[b3 + 2] += nz;
        vnormal[c3] += nx; vnormal[c3 + 1] += ny; vnormal[c3 + 2] += nz;
        vnormal[d3] += nx; vnormal[d3 + 1] += ny; vnormal[d3 + 2] += nz;
      }
      const cx = (view[a3] + view[b3] + view[c3] + view[d3]) / 4;
      const cy = (view[a3 + 1] + view[b3 + 1] + view[c3 + 1] + view[d3 + 1]) / 4;
      const cz = (view[a3 + 2] + view[b3 + 2] + view[c3 + 2] + view[d3 + 2]) / 4;
      const toward = ortho ? nz : -(nx * cx + ny * cy + nz * cz), front = toward > 0;
      fnormal[fi * 3] = nx; fnormal[fi * 3 + 1] = ny; fnormal[fi * 3 + 2] = nz;
      fkey[fi] = cz;
      if (spread) ffacing[fi] = ortho ? toward : toward / Math.hypot(cx, cy, cz); // 1 facing the viewer, 0 edge-on

      if (sh && (!g.solid || nx * Lx + ny * Ly + nz * Lz > 0)) {
        const x0 = shp[a * 2], x1 = shp[b * 2], x2 = shp[c * 2], x3 = shp[d * 2];
        const y0 = shp[a * 2 + 1], y1 = shp[b * 2 + 1], y2 = shp[c * 2 + 1], y3 = shp[d * 2 + 1];
        const area = (x2 - x0) * (y3 - y1) - (x3 - x1) * (y2 - y0);
        if (area > 0.02) shadowD += 'M' + r1(x0) + ' ' + r1(y0) + 'L' + r1(x1) + ' ' + r1(y1) + ' ' + r1(x2) + ' ' + r1(y2) + ' ' + r1(x3) + ' ' + r1(y3) + 'Z';
        else if (area < -0.02) shadowD += 'M' + r1(x0) + ' ' + r1(y0) + 'L' + r1(x3) + ' ' + r1(y3) + ' ' + r1(x2) + ' ' + r1(y2) + ' ' + r1(x1) + ' ' + r1(y1) + 'Z';
      }

      if (!front && culled) { fstate[fi] = -1; continue; }
      fstate[fi] = front ? 1 : 2;
      const s = front ? 1 : -1;
      const t = shade((nx * Lx + ny * Ly + nz * Lz) * s, (nx * Hx + ny * Hy + nz * Hz) * s);
      ftone[fi] = front ? t : t * backDim;
    }
  }
  if (shadowD) P.shadow += shadowD;

  // ── Smooth vertex tones ───────────────────────────────────────────────────
  if (smooth) {
    // Vertices that coincide (seams of closed directions, poles) share one normal.
    const share = (v, w) => {
      for (let k = 0; k < 3; k++) { const sum = vnormal[v * 3 + k] + vnormal[w * 3 + k]; vnormal[v * 3 + k] = sum; vnormal[w * 3 + k] = sum; }
    };
    if (g.closedU) for (let j = 0; j < NV; j++) share(j, NUf * NV + j);
    if (g.closedV) for (let i = 0; i < NU; i++) share(i * NV, i * NV + NVf);
    const pole = (start, stride, n) => {
      let x = 0, y = 0, z = 0;
      for (let k = 0; k < n; k++) { const o = (start + k * stride) * 3; x += vnormal[o]; y += vnormal[o + 1]; z += vnormal[o + 2]; }
      for (let k = 0; k < n; k++) { const o = (start + k * stride) * 3; vnormal[o] = x; vnormal[o + 1] = y; vnormal[o + 2] = z; }
    };
    if (g.poles[0]) pole(0, 1, NV);
    if (g.poles[1]) pole(NUf * NV, 1, NV);
    if (g.poles[2]) pole(0, NV, NU);
    if (g.poles[3]) pole(NVf, NV, NU);
    for (let v = 0, o = 0; v < nvert; v++, o += 3) {
      const l = Math.hypot(vnormal[o], vnormal[o + 1], vnormal[o + 2]) || 1;
      const nx = (vnormal[o] /= l), ny = (vnormal[o + 1] /= l), nz = (vnormal[o + 2] /= l);
      const ndl = nx * Lx + ny * Ly + nz * Lz, ndh = nx * Hx + ny * Hy + nz * Hz;
      vtone[v] = shade(ndl, ndh);
      if (!culled) vtoneBack[v] = shade(-ndl, -ndh) * backDim;
    }
  }

  // ── Pass 2: fill and dots ─────────────────────────────────────────────────
  if (fill || dots) {
    const T = fill ? fill.tones : 1, styles = fill ? fill.styles : null, grow = fill ? fill.grow : 0;
    const soft = 0.8; // corners keep the smooth normal unless the facet turns more than ~37° from it (a crease)
    // Dots look at the facets around them. Across the seam of a closed direction the grid wraps.
    const facetAt = (i, j) => {
      if (i < 0 || i === NUf) { if (!g.closedU) return -1; i = i < 0 ? NUf - 1 : 0; }
      if (j < 0 || j === NVf) { if (!g.closedV) return -1; j = j < 0 ? NVf - 1 : 0; }
      return i * NVf + j;
    };
    // How thick a facet is on screen: the distance between its two sides of constant u, or of constant v.
    // (Its area over their mean length. Facets seen edge-on are sheared, so the distance between the
    // middles of the sides would be far too much.)
    const across = (f, u) => {
      const i = (f / NVf) | 0, a = (i * NV + f - i * NVf) * 2, b = a + NV * 2, c = b + 2, d = a + 2;
      const area = Math.abs((scr[c] - scr[a]) * (scr[d + 1] - scr[b + 1]) - (scr[d] - scr[b]) * (scr[c + 1] - scr[a + 1])) / 2;
      const sides = u ? Math.hypot(scr[c] - scr[b], scr[c + 1] - scr[b + 1]) + Math.hypot(scr[a] - scr[d], scr[a + 1] - scr[d + 1])
        : Math.hypot(scr[b] - scr[a], scr[b + 1] - scr[a + 1]) + Math.hypot(scr[d] - scr[c], scr[d + 1] - scr[c + 1]);
      return sides > 1e-9 ? (2 * area) / sides : 0;
    };
    const kink = outline ? outline.creaseCos : -2; // neighbours turned further apart than this have an outline between them
    for (let i = 0; i < NUf; i++) {
      for (let j = 0; j < NVf; j++) {
        const fi = i * NVf + j, st = fstate[fi];
        if (st <= 0) continue;
        const a = i * NV + j, b = a + NV, c = b + 1, d = a + 1, cz = fkey[fi];
        QX[0] = scr[a * 2]; QY[0] = scr[a * 2 + 1]; QX[1] = scr[b * 2]; QY[1] = scr[b * 2 + 1];
        QX[2] = scr[c * 2]; QY[2] = scr[c * 2 + 1]; QX[3] = scr[d * 2]; QY[3] = scr[d * 2 + 1];
        if (fill) {
          if (!smooth) {
            P.poly(styles[Math.min(T - 1, (ftone[fi] * T) | 0)], cz, 4, QX, QY, grow);
          } else {
            const fx = fnormal[fi * 3], fy = fnormal[fi * 3 + 1], fz = fnormal[fi * 3 + 2];
            const vt = st === 1 ? vtone : vtoneBack, flat = ftone[fi];
            let lo = T, hi = 0;
            for (let k = 0; k < 4; k++) {
              const v = k === 0 ? a : k === 1 ? b : k === 2 ? c : d;
              const t = fx * vnormal[v * 3] + fy * vnormal[v * 3 + 1] + fz * vnormal[v * 3 + 2] > soft ? vt[v] : flat;
              QT[k] = t;
              const band = Math.min(T - 1, (t * T) | 0);
              if (band < lo) lo = band;
              if (band > hi) hi = band;
            }
            if (lo === hi) {
              P.poly(styles[lo], cz, 4, QX, QY, grow);
            } else {
              // The facet spans several tones: cut it along the tone contours.
              for (let band = lo; band <= hi; band++) {
                // Neighbouring tones of one colour are one band: an uneven ramp holds a colour
                // across many tones, and cutting between them would only add corners.
                let top = band;
                while (top < hi && styles[top + 1] === styles[band]) top++;
                let n = 4, X = QX, Y = QY, Tn = QT;
                if (band > lo) { n = clipTone(n, X, Y, Tn, band / T, true, AX, AY, AT); X = AX; Y = AY; Tn = AT; }
                if (top < hi && n > 2) { n = clipTone(n, X, Y, Tn, (top + 1) / T, false, BX, BY, BT); X = BX; Y = BY; }
                if (n > 2 && n <= 6) P.poly(styles[band], cz, n, X, Y, grow);
                band = top;
              }
            }
          }
        }
        if (dots) {
          // How far into the shadows the facet is: 0 at the `white` tone and lighter, where there is
          // no dot, and 1 at `black` and darker, where the dot is at its biggest.
          const ink = (dots.white - ftone[fi]) / dots.span;
          if (ink > 0) {
            const area = Math.abs((QX[2] - QX[0]) * (QY[3] - QY[1]) - (QX[3] - QX[1]) * (QY[2] - QY[0])) / 2;
            // A dark dot is wider than its facet. It may spill onto the facets next to it, but no further,
            // and never across an outline: a silhouette, an open edge or a crease. Where the surface turns
            // away the facets are thin, and so are the dots.
            let r = Math.min(dots.size * 0.46 * Math.sqrt(area) * Math.pow(ink < 1 ? ink : 1, dots.gamma), 0.8 * Math.min(across(fi, true), across(fi, false)));
            const x = (QX[0] + QX[1] + QX[2] + QX[3]) / 4, y = (QY[0] + QY[1] + QY[2] + QY[3]) / 4;
            for (let k = 0; k < 4; k++) {
              const x0 = QX[k], y0 = QY[k], ex = QX[(k + 1) & 3] - x0, ey = QY[(k + 1) & 3] - y0, len = Math.hypot(ex, ey);
              if (len < 1e-6) continue; // the side at a pole is a point
              const nf = k === 0 ? facetAt(i, j - 1) : k === 1 ? facetAt(i + 1, j) : k === 2 ? facetAt(i, j + 1) : facetAt(i - 1, j);
              const smooth = nf >= 0 && fstate[nf] === st && fnormal[fi * 3] * fnormal[nf * 3] + fnormal[fi * 3 + 1] * fnormal[nf * 3 + 1] + fnormal[fi * 3 + 2] * fnormal[nf * 3 + 2] >= kink;
              r = Math.min(r, Math.abs(ex * (y - y0) - ey * (x - x0)) / len + (smooth ? across(nf, k % 2 === 1) : 0));
            }
            const q = Math.round(r * 8); // the diameter in quarter pixels
            if (q >= 2) {
              // It goes in front of the facets around it, so the nearer ones do not cover the spill.
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
  if (!lines && !outline) return;

  // ── Edges: outline (silhouette, open edge, crease) and iso-lines ──────────
  const hiddenMode = lines && !(fill && fill.grow > 0) ? lines.hidden : 0;
  const creaseCos = outline ? outline.creaseCos : -2;
  const { zNear, zInv } = ctx;

  // `gap`: how far apart the lines of this edge's family lie, at each grid point (see SurfaceGrid.gaps).
  // `ends`: 1 if va is where its line runs off an open edge of the surface, 2 if vb is.
  const edge = (va, vb, f1, f2, iso, sharp, gap, ends) => {
    const s1 = f1 >= 0 ? fstate[f1] : 0, s2 = f2 >= 0 ? fstate[f2] : 0;
    if (!s1 && !s2) return;
    const v1 = s1 > 0, v2 = s2 > 0, visible = v1 || v2;
    let kind = 0;
    if (outline) {
      if (s1 && s2) {
        if ((s1 === 1) !== (s2 === 1)) kind = 1;
        else if (sharp && visible && creaseCos > -2 &&
          fnormal[f1 * 3] * fnormal[f2 * 3] + fnormal[f1 * 3 + 1] * fnormal[f2 * 3 + 1] + fnormal[f1 * 3 + 2] * fnormal[f2 * 3 + 2] < creaseCos) kind = 1;
      } else if (outline.boundary && visible) kind = 1;
    }
    if (!kind && iso) {
      // With nothing opaque in front, lines on faces turned away from the viewer are "hidden" lines.
      if (hiddenMode) kind = s1 === 1 || s2 === 1 ? 2 : 3;
      else kind = visible ? 2 : 0;
    }
    if (!kind) return;
    const x0 = scr[va * 2], y0 = scr[va * 2 + 1], x1 = scr[vb * 2], y1 = scr[vb * 2 + 1];
    if (Math.abs(x1 - x0) + Math.abs(y1 - y0) < 0.08) return;
    let key;
    if (visible) key = v1 && v2 ? Math.max(fkey[f1], fkey[f2]) : v1 ? fkey[f1] : fkey[f2];
    else key = s1 && s2 ? Math.max(fkey[f1], fkey[f2]) : s1 ? fkey[f1] : fkey[f2];
    if (kind === 1) { P.seg(outline.style, key + eps * 2, x0, y0, x1, y1); return; }
    if (kind === 3) { P.seg(lines.hiddenStyle, key - eps, x0, y0, x1, y1); return; }
    let d = 0, dl = 0; // d: how many doublings heavier than its width the line is drawn here
    if (lines.shade) d = lines.weight(v1 && v2 ? (ftone[f1] + ftone[f2]) / 2 : v1 ? ftone[f1] : ftone[f2]);
    if (gap) {
      // Lines further apart than usual are drawn heavier and closer ones lighter, so the tone holds.
      const r = (gap[va] + gap[vb]) / 2;
      let s = lines.spread * SPREAD * Math.tanh((r > 0 ? Math.log2(r) : -Infinity) / SPREAD);
      if (s > 0) {
        const f = v1 && v2 ? Math.min(Math.abs(ffacing[f1]), Math.abs(ffacing[f2])) : Math.abs(ffacing[v1 ? f1 : f2]);
        if (f < EDGEWISE) s *= f / EDGEWISE;
      }
      d += s;
    }
    if (lines.depth) {
      const dn = (zNear - key) * zInv;
      dl = dn <= 0 ? 0 : dn >= 1 ? 3 : Math.round(dn * 3);
    }
    const st = lines.style(d, dl);
    if (st < 0) return;
    if (!ends) { P.seg(st, key + eps, x0, y0, x1, y1); return; }
    // A line's round cap reaches half its width past its end: where the line runs off the edge, stop that much short.
    const len = Math.hypot(x1 - x0, y1 - y0), k = Math.min(lines.px(d) / 2, len * 0.45) / len;
    const a = ends & 1 ? k : 0, b = ends & 2 ? 1 - k : 1;
    P.seg(st, key + eps, x0 + (x1 - x0) * a, y0 + (y1 - y0) * a, x0 + (x1 - x0) * b, y0 + (y1 - y0) * b);
  };

  const { closedU, closedV } = g, isoU = lines && lines.u ? g.u.iso : null, isoV = lines && lines.v ? g.v.iso : null;
  const gaps = lines && lines.spread && (isoU || isoV) ? g.gaps() : null;
  // Edges running along u (each lies on a line of constant v).
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
  // Edges running along v (each lies on a line of constant u).
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

/** Sample parameters for a curve: on the knots, `per` steps per span, trimmed to `range`. */
export function curveParams(c, per, range) {
  const br = knotBreaks(c.knots, c.degree, c.count), out = [];
  const a = br[0], b = br[br.length - 1], eps = (b - a) * 1e-9;
  const lo = a + (b - a) * Math.max(0, Math.min(1, range[0])), hi = a + (b - a) * Math.max(0, Math.min(1, range[1]));
  if (hi - lo <= eps) return new Float64Array(0);
  out.push(lo);
  for (let s = 0; s < br.length - 1; s++) {
    for (let k = 0; k < per; k++) {
      const t = br[s] + ((br[s + 1] - br[s]) * k) / per;
      if (t > lo + eps && t < hi - eps) out.push(t);
    }
  }
  out.push(hi);
  return Float64Array.from(out);
}

export function drawCurve(mesh, ctx, P) {
  const c = mesh.geometry, mat = mesh._compiled;
  const per = c.degree === 1 ? 1 : Math.max(3, Math.round(12 * mat.detail * ctx.lod));
  const key = per + '|' + mesh._range[0] + '|' + mesh._range[1] + '|' + c.version;
  if (mesh._key !== key || mesh._geo !== c) {
    mesh._key = key; mesh._geo = c;
    const us = curveParams(c, per, mesh._range), n = us.length;
    mesh._pos = new Float64Array(n * 3);
    mesh._view = new Float64Array(n * 3);
    mesh._scr = new Float32Array(n * 2);
    mesh._ok = new Uint8Array(n);
    const pt = [0, 0, 0];
    for (let i = 0; i < n; i++) { c.point(us[i], pt); mesh._pos.set(pt, i * 3); }
  }
  const n = mesh._ok.length;
  if (n < 2) return;
  multiply(ctx.view, mesh.world, MV);
  const view = mesh._view, scr = mesh._scr, ok = mesh._ok;
  toView(mesh._pos, n, ctx, view, scr, ok);
  const bias = ctx.eps * 12000; // curves win ties against a surface they lie on
  if (mat.dashed) {
    let d = '', z = 0, k = 0, pen = false;
    for (let i = 0; i < n; i++) {
      if (!ok[i]) { pen = false; continue; }
      d += (pen ? 'L' : 'M') + r1(scr[i * 2]) + ' ' + r1(scr[i * 2 + 1]);
      pen = true; z += view[i * 3 + 2]; k++;
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

const r2 = (x) => Math.round(x * 100) / 100;
const WHOLE = [0, 1];

/** A flat shape: every curve becomes one outline of a single path, drawn whole. */
export function drawShape(mesh, ctx, P) {
  const mat = mesh._compiled, curves = mesh._geometry;
  if (mat.style < 0 || !curves.length) return;
  const per = Math.max(3, Math.round(10 * mat.detail * ctx.lod));
  let key = String(per);
  for (const c of curves) key += '|' + c.version;
  if (mesh._key !== key || mesh._geo !== curves) {
    mesh._key = key; mesh._geo = curves;
    const pos = [], subs = [], a = [0, 0, 0], b = [0, 0, 0], c3 = [0, 0, 0];
    for (const c of curves) {
      const us = curveParams(c, c.degree === 1 ? 1 : per, WHOLE);
      const closed = us.length > 2 && c.closed, n = closed ? us.length - 1 : us.length, start = pos.length / 3;
      for (let i = 0; i < n; i++) {
        c.point(us[i], b);
        // Points on a straight run add nothing (a straight line stays straight in perspective), so leave them out.
        if (i > 0 && i < n - 1) {
          c.point(us[i + 1], c3);
          const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c3[0] - b[0], vy = c3[1] - b[1], vz = c3[2] - b[2];
          const cross = Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
          if (cross <= 1e-7 * Math.hypot(ux, uy, uz) * Math.hypot(vx, vy, vz) && ux * vx + uy * vy + uz * vz >= 0) continue;
        }
        pos.push(b[0], b[1], b[2]);
        a[0] = b[0]; a[1] = b[1]; a[2] = b[2];
      }
      subs.push(start, pos.length / 3 - start, closed ? 1 : 0);
    }
    const n = pos.length / 3;
    mesh._pos = Float64Array.from(pos);
    mesh._subs = subs;
    mesh._view = new Float64Array(n * 3);
    mesh._scr = new Float32Array(n * 2);
    mesh._ok = new Uint8Array(n);
  }
  const n = mesh._ok.length;
  if (n < 2) return;
  multiply(ctx.view, mesh.world, MV);
  const view = mesh._view, scr = mesh._scr, ok = mesh._ok, subs = mesh._subs;
  toView(mesh._pos, n, ctx, view, scr, ok);
  let d = '', z = 0, x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let s = 0; s < subs.length; s += 3) {
    const from = subs[s], count = subs[s + 1];
    for (let i = from; i < from + count; i++) {
      if (!ok[i]) return; // a shape that crosses the near plane is not drawn at all
      const x = scr[i * 2], y = scr[i * 2 + 1];
      d += (i === from ? 'M' : i === from + 1 ? 'L' : ' ') + r2(x) + ' ' + r2(y);
      z += view[i * 3 + 2];
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    if (subs[s + 2]) d += 'Z';
  }
  if (x1 - x0 < 0.05 && y1 - y0 < 0.05) return; // scaled away to nothing
  P.path(mat.style, mesh._layer != null ? LAYERED + mesh._layer : z / n + ctx.eps * 12000, d, true);
}

export function drawPoints(mesh, ctx, P) {
  const pts = mesh.points, n = pts.length, mat = mesh._compiled;
  if (!mesh._pos || mesh._pos.length !== n * 3) {
    mesh._pos = new Float64Array(n * 3);
    mesh._view = new Float64Array(n * 3);
    mesh._scr = new Float32Array(n * 2);
    mesh._ok = new Uint8Array(n);
  }
  for (let i = 0; i < n; i++) { mesh._pos[i * 3] = pts[i][0]; mesh._pos[i * 3 + 1] = pts[i][1]; mesh._pos[i * 3 + 2] = pts[i][2] || 0; }
  multiply(ctx.view, mesh.world, MV);
  toView(mesh._pos, n, ctx, mesh._view, mesh._scr, mesh._ok);
  const bias = ctx.eps * 20000;
  for (let i = 0; i < n; i++) {
    if (!mesh._ok[i]) continue;
    const z = mesh._view[i * 3 + 2] + bias, x = mesh._scr[i * 2], y = mesh._scr[i * 2 + 1];
    P.dot(mat.style, z, x, y);
    if (mat.ring >= 0) P.dot(mat.ring, z + ctx.eps, x, y);
  }
}
