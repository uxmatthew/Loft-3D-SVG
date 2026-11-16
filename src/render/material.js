// Materials describe how a surface is drawn, as up to four layers:
//   fill     shaded facets
//   lines    iso-parametric curves (the surface's own u and v lines)
//   outline  silhouette, open edges and sharp creases
//   dots     a stipple whose dot size follows the shading
// A "look" is a named, tuned combination of those layers.

import { mixColors, ramp, shadeStops } from './color.js';

const pick = (o, d) => ({ ...d, ...o });

// Line weights come in steps of a twelfth of a doubling (6%), from 1/128 to 16 times `width`.
const STEPS = 12, LIGHTEST = -7 * STEPS, HEAVIEST = 4 * STEPS;

/**
 * Ready-made looks. Each takes `{ color }` and returns a material. Colours may
 * be any CSS colour, or the palette words 'ink', 'paper' and 'accent', which
 * follow the page's theme.
 */
export const looks = {
  /** Soft matte shading, no lines. */
  clay: ({ color = 'accent' } = {}) => ({
    fill: { color, tones: 20, specular: 0.14 },
  }),
  /**
   * Pulp-poster cel shading: seven flat tones and a firm outline. From shadow to light:
   * black, a deep olive and a khaki shade of the colour, a vermilion band where light
   * turns to shade, a tan, the colour itself, and a cream highlight.
   */
  toon: ({ color = '#E7CC91' } = {}) => ({
    fill: {
      color, tones: 7, ambient: 0.1, wrap: 0, specular: 0.2,
      ramp: (base) => [
        '#0B0806', mixColors(base, '#0B0806', 0.72), mixColors(base, '#0B0806', 0.45), '#E94225',
        mixColors(base, '#0B0806', 0.2), base, mixColors(base, '#FFF6DC', 0.45),
      ],
    },
    outline: { width: 2 },
  }),
  /** Technical pen: paper-coloured faces, outline and a few construction lines. Hidden lines are covered. */
  ink: ({ color = 'paper' } = {}) => ({
    fill: { color, flat: true },
    lines: { u: 12, v: 8, width: 0.6 },
    outline: { width: 1.5 },
  }),
  /** See-through wireframe; lines on the far side fade. */
  wire: () => ({
    lines: { u: 16, v: 12, width: 0.8, hidden: 'faint', depth: 0.45 },
    outline: { width: 1.1 },
  }),
  /**
   * Banknote engraving: one family of lines whose weight carries the shading. Where the
   * lines fan apart they swell, and where they crowd they thin, so the tone holds.
   */
  engrave: ({ color = 'paper' } = {}) => ({
    fill: { color, flat: true },
    lines: { v: 44, width: 0.95, shade: 1, spread: 1.5 },
    outline: { width: 1.2 },
  }),
  /**
   * Dots that swell in the shadows. The lights are left bare, and in the deepest shadows
   * the dots grow past their facets and run together.
   */
  halftone: ({ color = 'paper' } = {}) => ({
    fill: { color, flat: true },
    dots: { size: 1.3, gamma: 1.5, white: 0.8, black: 0.32 },
    outline: { width: 1.2 },
  }),
};

const LAYERS = ['fill', 'lines', 'outline', 'dots'];

function layer(name, v) {
  if (v === true) return {};
  if (v == null || v === false) return null;
  if (typeof v === 'string') return name === 'fill' ? { color: v } : { color: v };
  if (typeof v === 'number') {
    if (name === 'lines') return { u: v, v: v };
    return name === 'dots' ? { size: v } : { width: v };
  }
  return v;
}

/** Expand a look name or a partial material into a full material description. */
export function resolveMaterial(m) {
  if (m == null) m = 'clay';
  if (typeof m === 'string') {
    if (!looks[m]) throw new Error(`Unknown look "${m}". Available looks: ${Object.keys(looks).join(', ')}.`);
    return looks[m]();
  }
  if (!m.look) {
    const out = { ...m };
    for (const k of LAYERS) out[k] = layer(k, m[k]);
    return out;
  }
  if (!looks[m.look]) throw new Error(`Unknown look "${m.look}". Available looks: ${Object.keys(looks).join(', ')}.`);
  const base = looks[m.look](m), out = { ...m, ...base };
  for (const k of LAYERS) {
    if (!(k in m)) continue;
    const v = layer(k, m[k]);
    out[k] = v && base[k] ? { ...base[k], ...v } : v;
  }
  return out;
}

/**
 * Turn a material description into style ids and numbers the painter can use.
 * `env` supplies: color(name) → CSS colour, px(width) → scaled stroke width,
 * style(declarations) → style id.
 */
export function compileSurface(spec, env) {
  const m = resolveMaterial(spec), out = { cull: m.cull ?? 'auto', flip: !!m.flip, detail: m.detail ?? 1 };

  if (m.fill) {
    const f = pick(m.fill, { color: 'accent', tones: 24, ambient: 0.2, wrap: 0.3, specular: 0, shininess: 28, opacity: 1, back: 0.78 });
    const given = typeof f.ramp === 'function' ? f.ramp(env.color(f.color)) : f.ramp;
    const stops = given ? given.map((s) => (Array.isArray(s) ? [s[0], env.color(s[1])] : env.color(s))) : f.flat ? [env.color(f.color)] : shadeStops(env.color(f.color));
    const tones = f.flat ? 1 : Math.max(1, Math.round(f.tones));
    const op = f.opacity < 1 ? `;fill-opacity:${f.opacity}` : '';
    out.fill = {
      styles: Int32Array.from(ramp(stops, tones).map((c) => env.style(`fill:${c}${op}`))),
      tones, facets: !!f.facets, ambient: f.ambient, wrap: f.wrap, specular: f.specular, shininess: f.shininess, back: f.back,
      grow: f.opacity < 1 ? 0 : 0.45,
    };
  }

  if (m.lines) {
    const l = pick(m.lines, { u: 0, v: 0, color: 'ink', width: 0.8, hidden: 'none', shade: 0, depth: 0, opacity: 1, spread: 0 });
    const color = env.color(l.color), cache = [];
    const decl = (w, o) => `stroke:${color};stroke-width:${Math.round(env.px(w) * 100) / 100}` + (o < 0.995 ? `;stroke-opacity:${Math.round(o * 100) / 100}` : '');
    const shade = l.shade;
    const step = (d) => { const s = Math.round(d * STEPS); return s < LIGHTEST ? LIGHTEST : s > HEAVIEST ? HEAVIEST : s; };
    out.lines = {
      u: l.u, v: l.v, shade, depth: l.depth, spread: Math.max(0, l.spread),
      hidden: l.hidden === 'faint' ? 1 : l.hidden === 'dashed' ? 2 : 0,
      /** How many doublings heavier than `width` a line is where the surface has this tone (0 dark, 1 light). */
      weight: (tone) => Math.log2(Math.max(1e-6, 1 - shade + shade * (0.06 + 2.4 * Math.pow(1 - tone, 1.4)))),
      /** The stroke width in pixels of a line `d` doublings heavier than `width`. */
      px: (d) => env.px(l.width * Math.pow(2, step(d) / STEPS)),
      /** d: doublings heavier than `width` (1 = twice as wide), dl: depth level 0..3 (3 = farthest) */
      style(d, dl) {
        const s = step(d), i = (s - LIGHTEST) * 4 + dl;
        if (cache[i] === undefined) {
          const w = l.width * Math.pow(2, s / STEPS);
          cache[i] = env.px(w) < 0.07 ? -1 : env.style(decl(w, l.opacity * (1 - l.depth * (dl / 3) * 0.85)));
        }
        return cache[i];
      },
    };
    if (out.lines.hidden === 1) out.lines.hiddenStyle = env.style(decl(l.width * 0.8, l.opacity * 0.22));
    if (out.lines.hidden === 2) {
      const d = Math.round(env.px(3) * 10) / 10;
      out.lines.hiddenStyle = env.style(decl(l.width * 0.8, l.opacity * 0.5) + `;stroke-dasharray:${d} ${d}`);
    }
  }

  if (m.outline) {
    const o = pick(m.outline, { color: 'ink', width: 1.5, crease: 40, boundary: true });
    out.outline = {
      style: env.style(`stroke:${env.color(o.color)};stroke-width:${Math.round(env.px(o.width) * 100) / 100}`),
      creaseCos: o.crease === false ? -2 : Math.cos((o.crease * Math.PI) / 180),
      boundary: o.boundary,
    };
  }

  if (m.dots) {
    // Tones at `white` and lighter get no dot; tones at `black` and darker get the biggest one.
    const d = pick(m.dots, { color: 'ink', size: 1, gamma: 1.15, white: 1, black: 0 });
    const color = env.color(d.color), cache = new Map();
    out.dots = {
      size: d.size, gamma: d.gamma, white: d.white, span: Math.max(1e-3, d.white - d.black),
      /** q: dot diameter in quarter pixels */
      style(q) {
        let s = cache.get(q);
        if (s === undefined) cache.set(q, (s = env.style(`stroke:${color};stroke-width:${q / 4}`)));
        return s;
      },
    };
  }
  return out;
}

export function compileCurve(spec, env) {
  const s = pick(typeof spec === 'string' ? { color: spec } : spec || {}, { color: 'ink', width: 1.5, opacity: 1, depth: 0, dash: null, detail: 1 });
  const color = env.color(s.color), cache = [];
  const base = (o) => `stroke:${color};stroke-width:${Math.round(env.px(s.width) * 100) / 100}` + (o < 0.995 ? `;stroke-opacity:${Math.round(o * 100) / 100}` : '');
  const dash = s.dash ? `;stroke-dasharray:${[].concat(s.dash).map((d) => Math.round(env.px(d) * 10) / 10).join(' ')}` : '';
  return {
    dashed: !!s.dash, depth: s.depth, detail: s.detail,
    style(dl) {
      if (cache[dl] === undefined) cache[dl] = env.style(base(s.opacity * (1 - s.depth * (dl / 3) * 0.85)) + dash);
      return cache[dl];
    },
  };
}

/** A flat shape: `fill` and `stroke` are colours or false; `opacity` multiplies the node's own. */
export function compileShape(spec, env, opacity = 1) {
  const s = pick(typeof spec === 'string' ? { fill: spec } : spec || {}, { fill: 'paper', stroke: 'ink', width: 1.5, opacity: 1, dash: null, detail: 1 });
  const o = Math.round(s.opacity * opacity * 100) / 100, decl = [];
  if (s.fill) decl.push(`fill:${env.color(s.fill)}`);
  if (s.stroke && s.width > 0) {
    decl.push(`stroke:${env.color(s.stroke)}`, `stroke-width:${Math.round(env.px(s.width) * 100) / 100}`);
    if (s.dash) decl.push(`stroke-dasharray:${[].concat(s.dash).map((d) => Math.round(env.px(d) * 10) / 10).join(' ')}`);
  }
  if (o < 0.995) decl.push(`opacity:${o}`);
  return { style: decl.length && o > 0.005 && (s.fill || decl.length > 1) ? env.style(decl.join(';')) : -1, detail: s.detail };
}

export function compilePoints(spec, env) {
  const s = pick(typeof spec === 'string' ? { color: spec } : spec || {}, { color: 'ink', size: 5, ring: null });
  const d = Math.round(env.px(s.size) * 100) / 100;
  return {
    style: env.style(`stroke:${env.color(s.color)};stroke-width:${d}`),
    ring: s.ring ? env.style(`stroke:${env.color(s.ring)};stroke-width:${Math.max(0.5, Math.round((d - env.px(2.4)) * 100) / 100)}`) : -1,
  };
}
