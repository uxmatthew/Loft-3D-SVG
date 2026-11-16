// Colour handling. Shading ramps are blended in OKLab so tones step evenly to
// the eye. Colours the library can parse (hex, rgb()) are resolved to hex up
// front; anything else (CSS variables, currentColor, named colours) is left to
// the browser through color-mix(), so page themes keep working without script.

const HEX = /^#([0-9a-f]{3,8})$/i;
const RGB = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i;

/** Parse a hex or rgb() colour to linear-light-free sRGB [r, g, b] in 0..1, or null if it is not one. */
export function parseColor(str) {
  if (typeof str !== 'string') return null;
  str = str.trim();
  let m = HEX.exec(str);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('');
    if (h.length !== 6 && h.length !== 8) return null;
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  }
  m = RGB.exec(str);
  if (m) return [m[1] / 255, m[2] / 255, m[3] / 255];
  return null;
}

const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const toGamma = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

export function toOklab([r, g, b]) {
  r = toLinear(r); g = toLinear(g); b = toLinear(b);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

export function fromOklab([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    toGamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    toGamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    toGamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

export function toHex(rgb) {
  return '#' + rgb.map((c) => Math.round(Math.min(1, Math.max(0, c)) * 255).toString(16).padStart(2, '0')).join('');
}

/** Blend two CSS colours: t = 0 gives a, t = 1 gives b. Returns hex when both are known, else a color-mix(). */
export function mixColors(a, b, t) {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const ca = parseColor(a), cb = parseColor(b);
  if (ca && cb) {
    const la = toOklab(ca), lb = toOklab(cb);
    return toHex(fromOklab(la.map((v, i) => v + (lb[i] - v) * t)));
  }
  return `color-mix(in oklab, ${b} ${Math.round(t * 1000) / 10}%, ${a})`;
}

/**
 * `tones` colours stepping evenly through the stops, darkest first.
 *
 * Stops are colours spread evenly, or `[at, colour]` pairs placed along 0..1 from shadow
 * to light. Placed stops make an uneven ramp: two stops of one colour hold a flat band,
 * two stops at one place make a hard edge, and any other pair blends, which reads as a
 * blurred edge once there are enough tones to step through it.
 */
export function ramp(stops, tones) {
  if (Array.isArray(stops[0])) return placedRamp(stops, tones);
  if (stops.length === 1) return new Array(Math.max(1, tones)).fill(stops[0]);
  if (stops.length === tones) return stops.slice(); // a stop for every tone: a fixed palette, used as given
  const out = [];
  for (let i = 0; i < tones; i++) {
    // Sample band centres, so a three-tone ramp is shadow / base / light rather than the two extremes.
    const x = ((i + 0.5) / tones) * (stops.length - 1);
    const s = Math.min(stops.length - 2, Math.floor(x));
    out.push(mixColors(stops[s], stops[s + 1], x - s));
  }
  return out;
}

function placedRamp(stops, tones) {
  const out = [], last = stops.length - 1;
  for (let i = 0, s = 0; i < tones; i++) {
    const x = (i + 0.5) / tones;
    while (s < last && stops[s + 1][0] <= x) s++;
    const [a, ca] = stops[s], [b, cb] = stops[Math.min(last, s + 1)];
    // A flat band keeps its colour exactly as written, so its tones share one style and merge.
    out.push(x <= a || s === last || ca === cb ? ca : mixColors(ca, cb, (x - a) / (b - a)));
  }
  return out;
}

/**
 * Shadow-to-highlight stops for one base colour. Shadows lean cool and keep
 * their colour, highlights lean warm and wash out, which reads as lit form
 * rather than a colour mixed with black and white.
 */
export function shadeStops(color) {
  const rgb = parseColor(color);
  if (!rgb) {
    return [
      `color-mix(in oklab, ${color}, #0a1430 58%)`,
      `color-mix(in oklab, ${color}, #0a1430 22%)`,
      color,
      `color-mix(in oklab, ${color}, #fff8ec 45%)`,
      `color-mix(in oklab, ${color}, #fffdf8 82%)`,
    ];
  }
  const [L, a, b] = toOklab(rgb);
  const C = Math.hypot(a, b), h = Math.atan2(b, a);
  const toward = (target, amount) => {
    let d = target - h;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    return h + Math.sign(d) * Math.min(Math.abs(d), amount);
  };
  const cool = toward(4.62, 0.35), warm = toward(1.66, 0.22);
  const stop = (l, c, hue) => toHex(fromOklab([l, c * Math.cos(hue), c * Math.sin(hue)]));
  return [
    stop(L * 0.46, C * 0.82, cool),
    stop(L * 0.74, C * 1.0, toward(4.62, 0.14)),
    stop(L, C, h),
    stop(L + (1 - L) * 0.42, C * 0.7, warm),
    stop(L + (1 - L) * 0.86, C * 0.2, warm),
  ];
}
