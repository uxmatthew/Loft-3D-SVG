// Outlines for flat illustration: the handful of 2D shapes interface pictures
// are made of. Coordinates are the ones a design tool gives you: x runs right,
// y runs down, from the top-left corner of the artboard. Every function returns
// NURBS curves (arcs are exact), so the outlines can be tilted and moved in
// space like anything else in the library.

import { NurbsCurve } from '../nurbs/curve.js';
import { arc as arcCurve } from '../nurbs/make.js';
import { joinCurves } from '../nurbs/ops.js';

const TAU = Math.PI * 2;

/** Builds outlines segment by segment; `curves()` gives one curve per outline. */
class Pen {
  constructor() { this.subs = []; this.sub = null; }

  move(x, y) {
    this.sub = { segs: [], start: [x, y], at: [x, y] };
    this.subs.push(this.sub);
    return this;
  }

  _to(x, y, make) {
    if (!this.sub) this.move(x, y);
    const [ax, ay] = this.sub.at;
    const seg = make(ax, ay);
    if (seg) this.sub.segs.push(seg);
    this.sub.at = [x, y];
    return this;
  }

  line(x, y) {
    return this._to(x, y, (ax, ay) => (Math.hypot(x - ax, y - ay) < 1e-9 ? null : new NurbsCurve({ degree: 1, points: [[ax, ay, 0], [x, y, 0]] })));
  }

  quad(x1, y1, x, y) {
    return this._to(x, y, (ax, ay) => new NurbsCurve({ degree: 2, points: [[ax, ay, 0], [x1, y1, 0], [x, y, 0]] }));
  }

  cubic(x1, y1, x2, y2, x, y) {
    return this._to(x, y, (ax, ay) => new NurbsCurve({ degree: 3, points: [[ax, ay, 0], [x1, y1, 0], [x2, y2, 0], [x, y, 0]] }));
  }

  /**
   * A circular or elliptical arc about (cx, cy) from angle a0 to a1, in radians
   * clockwise from the x axis (y runs down). a1 < a0 goes anticlockwise. The pen
   * is expected to be at the arc's start already.
   */
  arc(cx, cy, r, a0, a1, { ry = r, tilt = 0 } = {}) {
    if (Math.abs(a1 - a0) < 1e-9) return this;
    const c = Math.cos(tilt), s = Math.sin(tilt), back = a1 < a0;
    const curve = arcCurve({
      center: [cx, cy, 0], radius: r, radiusY: ry,
      xAxis: [c, s, 0], yAxis: back ? [s, -c, 0] : [-s, c, 0],
      start: back ? -a0 : a0, end: back ? -a1 : a1,
    });
    const e = curve.point(curve.domain[1]);
    return this._to(e[0], e[1], () => curve);
  }

  close() {
    const s = this.sub;
    if (s) { this.line(s.start[0], s.start[1]); s.closed = true; }
    return this;
  }

  curves() {
    return this.subs.filter((s) => s.segs.length).map((s) => (s.segs.length === 1 ? s.segs[0] : joinCurves(s.segs)));
  }
}

/** A rectangle with corners of radius `r` (a pill when r is half the short side). */
export function rect(x, y, w, h, r = 0) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  const p = new Pen().move(x + r, y).line(x + w - r, y);
  if (r) p.arc(x + w - r, y + r, r, -TAU / 4, 0);
  p.line(x + w, y + h - r);
  if (r) p.arc(x + w - r, y + h - r, r, 0, TAU / 4);
  p.line(x + r, y + h);
  if (r) p.arc(x + r, y + h - r, r, TAU / 4, TAU / 2);
  p.line(x, y + r);
  if (r) p.arc(x + r, y + r, r, TAU / 2, (TAU * 3) / 4);
  return p.close().curves();
}

export function circle(cx, cy, r) {
  return [arcCurve({ center: [cx, cy, 0], radius: r })];
}

export function line(x1, y1, x2, y2) {
  return [new NurbsCurve({ degree: 1, points: [[x1, y1, 0], [x2, y2, 0]] })];
}

/** Straight segments through [x, y] points. */
export function polyline(points, { closed = false } = {}) {
  const pts = points.map(([x, y]) => [x, y, 0]);
  if (closed) pts.push(pts[0]);
  return [new NurbsCurve({ degree: 1, points: pts })];
}

/** A column of text lines from (x, y): one stroke per entry of `widths`, `gap` apart. */
export function lines(x, y, widths, gap = 12) {
  return widths.flatMap((w, i) => line(x, y + i * gap, x + w, y + i * gap));
}

/** A four-pointed sparkle of radius r. `pinch` (0 to 1) is how far the sides are drawn in. */
export function sparkle(cx, cy, r, pinch = 0.72) {
  const k = r * (1 - pinch) * Math.SQRT1_2;
  const p = new Pen().move(cx, cy - r);
  p.quad(cx + k, cy - k, cx + r, cy).quad(cx + k, cy + k, cx, cy + r).quad(cx - k, cy + k, cx - r, cy).quad(cx - k, cy - k, cx, cy - r);
  return p.close().curves();
}

/** A speech bubble: a rounded rectangle with a tail under its bottom-left (or, with tail < 0, bottom-right) corner. */
export function bubble(x, y, w, h, r = 6, tail = 7) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  const t = Math.abs(tail), p = new Pen().move(x + r, y).line(x + w - r, y);
  p.arc(x + w - r, y + r, r, -TAU / 4, 0).line(x + w, y + h - r).arc(x + w - r, y + h - r, r, 0, TAU / 4);
  if (tail < 0) p.line(x + w - r - t * 0.2, y + h).line(x + w - r * 0.5, y + h + t).line(x + w - r - t * 1.5, y + h);
  else if (tail > 0) p.line(x + r + t * 1.5, y + h).line(x + r * 0.5, y + h + t).line(x + r + t * 0.2, y + h);
  p.line(x + r, y + h).arc(x + r, y + h - r, r, TAU / 4, TAU / 2).line(x, y + r).arc(x + r, y + r, r, TAU / 2, (TAU * 3) / 4);
  return p.close().curves();
}

/** A tick about `size` wide, centred on (cx, cy). */
export function check(cx, cy, size = 20) {
  const s = size / 20;
  return polyline([[cx - 9 * s, cy + 0.5 * s], [cx - 3 * s, cy + 6.5 * s], [cx + 9 * s, cy - 6 * s]]);
}

/** Short strokes radiating from (cx, cy) between radius r0 and r1, at each angle (radians, clockwise from the x axis). */
export function rays(cx, cy, r0, r1, angles) {
  return angles.flatMap((a) => line(cx + r0 * Math.cos(a), cy + r0 * Math.sin(a), cx + r1 * Math.cos(a), cy + r1 * Math.sin(a)));
}

/** The command-key sign, about 2·size across. */
export function command(cx, cy, size = 5) {
  const a = size * 0.44, q = size * 0.5, o = a + q, h = TAU / 4;
  const p = new Pen().move(cx - a, cy + o).line(cx - a, cy - o);
  p.arc(cx - o, cy - o, q, 0, -3 * h).line(cx + o, cy - a);
  p.arc(cx + o, cy - o, q, h, -2 * h).line(cx + a, cy + o);
  p.arc(cx + o, cy + o, q, 2 * h, -h).line(cx - o, cy + a);
  p.arc(cx - o, cy + o, q, 3 * h, 0);
  return p.close().curves();
}

const ARGS = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };

/**
 * Outlines from SVG path data, the `d` of a <path>: paste one from a drawing
 * tool. All commands are understood, absolute and relative.
 */
export function path(d) {
  const pen = new Pen(), tokens = String(d).match(/[a-zA-Z]|-?(?:\d*\.\d+|\d+\.?)(?:e[-+]?\d+)?/gi) || [];
  let i = 0, x = 0, y = 0, sx = 0, sy = 0, cmd = '', prev = '', px = 0, py = 0; // px, py: the last control point, for S and T
  while (i < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[i])) cmd = tokens[i++];
    const C = cmd.toUpperCase(), rel = cmd !== C, n = ARGS[C];
    if (n === undefined) throw new Error(`kit.path: unknown command "${cmd}"`);
    const a = tokens.slice(i, i + n).map(Number);
    if (a.length < n || a.some(Number.isNaN)) throw new Error(`kit.path: "${cmd}" needs ${n} numbers`);
    i += n;
    const X = (v) => (rel ? x + v : v), Y = (v) => (rel ? y + v : v);
    if (C === 'M') { x = X(a[0]); y = Y(a[1]); sx = x; sy = y; pen.move(x, y); cmd = rel ? 'l' : 'L'; }
    else if (C === 'L') { x = X(a[0]); y = Y(a[1]); pen.line(x, y); }
    else if (C === 'H') { x = X(a[0]); pen.line(x, y); }
    else if (C === 'V') { y = Y(a[0]); pen.line(x, y); }
    else if (C === 'C' || C === 'S') {
      // S mirrors the last control point of a cubic before it; after anything else it starts straight.
      const smooth = prev === 'C' || prev === 'S', o = C === 'C' ? 2 : 0;
      const x1 = C === 'C' ? X(a[0]) : smooth ? 2 * x - px : x, y1 = C === 'C' ? Y(a[1]) : smooth ? 2 * y - py : y;
      px = X(a[o]); py = Y(a[o + 1]);
      const ex = X(a[o + 2]), ey = Y(a[o + 3]);
      pen.cubic(x1, y1, px, py, ex, ey); x = ex; y = ey;
    } else if (C === 'Q' || C === 'T') {
      const smooth = prev === 'Q' || prev === 'T', o = C === 'Q' ? 2 : 0;
      const qx = C === 'Q' ? X(a[0]) : smooth ? 2 * x - px : x, qy = C === 'Q' ? Y(a[1]) : smooth ? 2 * y - py : y;
      const ex = X(a[o]), ey = Y(a[o + 1]);
      pen.quad(qx, qy, ex, ey); px = qx; py = qy; x = ex; y = ey;
    } else if (C === 'A') {
      const ex = X(a[5]), ey = Y(a[6]);
      svgArc(pen, x, y, Math.abs(a[0]), Math.abs(a[1]), (a[2] * Math.PI) / 180, !!a[3], !!a[4], ex, ey);
      x = ex; y = ey;
    } else { pen.close(); x = sx; y = sy; }
    prev = C;
  }
  return pen.curves();
}

// An SVG arc gives its end points; the pen wants a centre and two angles (SVG 1.1, appendix F.6.5).
function svgArc(pen, x1, y1, rx, ry, phi, large, sweep, x2, y2) {
  if (Math.hypot(x2 - x1, y2 - y1) < 1e-9) return;
  if (rx < 1e-9 || ry < 1e-9) { pen.line(x2, y2); return; }
  const c = Math.cos(phi), s = Math.sin(phi);
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
  const u = c * dx + s * dy, v = -s * dx + c * dy;
  const grow = Math.sqrt((u * u) / (rx * rx) + (v * v) / (ry * ry));
  if (grow > 1) { rx *= grow; ry *= grow; }
  const num = rx * rx * ry * ry - rx * rx * v * v - ry * ry * u * u, den = rx * rx * v * v + ry * ry * u * u;
  const k = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num / den));
  const cu = (k * rx * v) / ry, cv = (-k * ry * u) / rx;
  const cx = c * cu - s * cv + (x1 + x2) / 2, cy = s * cu + c * cv + (y1 + y2) / 2;
  const a0 = Math.atan2((v - cv) / ry, (u - cu) / rx);
  let da = Math.atan2((-v - cv) / ry, (-u - cu) / rx) - a0;
  if (sweep && da < 0) da += TAU;
  if (!sweep && da > 0) da -= TAU;
  pen.arc(cx, cy, rx, a0, a0 + da, { ry, tilt: phi });
  pen.sub.at = [x2, y2];
}

/** The same outlines turned by `angle` radians clockwise about (cx, cy). */
export function turn(curves, angle, cx = 0, cy = 0) {
  const c = Math.cos(angle), s = Math.sin(angle);
  // Column-major 4×4: rotate about z, then put the pivot back.
  const m = new Float64Array([c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, cx - c * cx + s * cy, cy - s * cx - c * cy, 0, 1]);
  return [].concat(curves).map((k) => k.transform(m));
}

/** The same outlines moved by (dx, dy). */
export function shift(curves, dx = 0, dy = 0) {
  const m = new Float64Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, dx, dy, 0, 1]);
  return [].concat(curves).map((k) => k.transform(m));
}
