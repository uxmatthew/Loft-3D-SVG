// Ready-made spot illustrations. Each is a function returning a recipe:
//
//   { size: [width, height], parts: [...], lean, duration, hold }
//
// A part is { shape, fill, stroke, width, lift, hover } or { group: [parts], lift, hover }.
// `lift` is how far the part stands off the page while hovered; `hover` is its
// motion, as keyframes of offsets from rest: x, y, z, rx, ry, rz, scale, opacity.
// Parts are drawn in the order given, on a 240 × 200 artboard.

import * as kit from './kit.js';

const Q = Math.PI / 2;

/** An assistant in a window: a chat bubble, a prompt, and two sparkles. */
export function assist() {
  return {
    size: [240, 200],
    duration: 1700,
    parts: [
      { shape: kit.rect(40, 44, 160, 120, 14) },
      { shape: kit.line(40, 74, 200, 74) },
      { shape: [...kit.circle(59, 59, 3.4), ...kit.circle(74, 59, 3.4), ...kit.circle(89, 59, 3.4)], fill: 'soft', stroke: false },
      { shape: kit.bubble(59, 90, 82, 27, 7), fill: 'tint', lift: 16, hover: [{ t: 0.3, y: -3 }, { t: 0.7, y: 0 }] },
      {
        group: [
          { shape: kit.rect(60, 131, 122, 18, 9) },
          { shape: kit.line(72, 136.5, 72, 143.5), hover: [{ t: 0.2, opacity: 0 }, { t: 0.4, opacity: 1 }, { t: 0.6, opacity: 0 }, { t: 0.8, opacity: 1 }] },
        ],
        lift: 8,
      },
      {
        shape: kit.sparkle(172, 100, 14), fill: 'accent', stroke: 'accent', width: 1.6, lift: 30,
        hover: [{ t: 0.5, rz: Q / 2, scale: 1.22, z: 10 }, { t: 1, rz: Q, scale: 1, z: 0 }],
      },
      {
        shape: kit.sparkle(205, 42, 7.5), fill: 'accent', stroke: 'accent', width: 1.4, lift: 42,
        hover: [{ t: 0.25 }, { t: 0.65, rz: -Q / 2, scale: 1.45 }, { t: 1, rz: -Q, scale: 1 }],
      },
    ],
  };
}

/** Paste: a key is pressed and a sheet leaves the clipboard. */
export function paste() {
  const sheet = (shape) => kit.turn(shape, -0.15, 132.5, 109.5);
  return {
    size: [240, 200],
    duration: 1500,
    parts: [
      { shape: kit.rect(30, 49, 95, 118, 12) },
      { shape: kit.rect(58, 35, 38, 20, 8), fill: 'tint', lift: 6 },
      {
        group: [
          { shape: kit.rect(40, 119, 53, 37, 8) },
          { shape: [...kit.command(56.5, 137.5, 5.2), ...kit.polyline([[70.5, 132], [75.5, 143], [80.5, 132]])], fill: false, width: 2.1 },
        ],
        lift: 10,
        hover: [{ t: 0.14, z: -10, scale: 0.93 }, { t: 0.34, z: 0, scale: 1 }],
      },
      {
        group: [
          { shape: sheet(kit.rect(95, 62, 75, 95, 7)) },
          { shape: sheet(kit.lines(108, 80, [50, 50, 50, 50, 30], 11.5)), stroke: 'soft' },
        ],
        lift: 14,
        hover: [{ t: 0.16 }, { t: 0.8, x: 15, y: -7, z: 30, ry: -0.38, rz: 0.07 }],
      },
      {
        shape: [...kit.line(185, 76, 204, 68), ...kit.line(190, 92, 209, 89)], stroke: 'soft', lift: 26,
        hover: [{ t: 0.3 }, { t: 0.85, x: 16, y: -5, scale: 1.3 }],
      },
    ],
  };
}

/** A plug-in: the piece is pulled out, clicks back in, and the card is ticked off. */
export function plugin() {
  return {
    size: [240, 200],
    duration: 1900,
    parts: [
      { shape: kit.rect(28, 39, 138, 110, 12) },
      { shape: kit.lines(50, 70, [64, 50, 60], 19), stroke: 'soft' },
      {
        shape: kit.rays(160, 95, 36, 52, [-0.62, 0, 0.62]), stroke: 'soft', lift: 12,
        hover: [{ t: 0.5, opacity: 0, scale: 0.7 }, { t: 0.56, opacity: 0, scale: 0.7 }, { t: 0.74, opacity: 1, scale: 1.12 }, { t: 1, scale: 1 }],
      },
      {
        shape: [...kit.rect(137, 68, 32, 51, 5), ...kit.circle(138, 93.5, 9), ...kit.circle(168.5, 93.5, 9)], fill: 'ink', lift: 14,
        hover: [{ t: 0.3, x: 30, z: 26, ry: -0.6 }, { t: 0.42, x: 30, z: 26, ry: -0.6 }, { t: 0.58, x: 0, z: 0, ry: 0, ease: (t) => t * t * t }],
      },
      {
        group: [
          { shape: kit.circle(57, 138, 23), fill: 'accent', stroke: false },
          { shape: kit.check(57, 138, 21), stroke: 'ink', width: 3.6 },
        ],
        lift: 24,
        hover: [{ t: 0.58 }, { t: 0.76, scale: 1.1, z: 10, ry: 0.5 }, { t: 1, scale: 1, z: 0, ry: 0 }],
      },
    ],
  };
}

/** Search: a lens passes over the results and one of them answers. */
export function search() {
  const row = (y, w, hit) => [
    { shape: kit.rect(48, y - 6, 12, 12, 4), fill: hit ? 'accent' : 'tint', stroke: false, ...(hit ? { lift: 10, hover: [{ t: 0.7 }, { t: 0.84, scale: 1.5, z: 8 }, { t: 1, scale: 1, z: 0 }] } : {}) },
    { shape: kit.line(70, y, 70 + w, y), stroke: 'soft' },
  ];
  return {
    size: [240, 200],
    duration: 2100,
    parts: [
      { shape: kit.rect(34, 38, 172, 32, 16) },
      { shape: kit.line(52, 54, 104, 54), stroke: 'soft' },
      { shape: kit.line(112, 48.5, 112, 59.5), hover: [{ t: 0.15, opacity: 0 }, { t: 0.3, opacity: 1 }, { t: 0.45, opacity: 0 }, { t: 0.6, opacity: 1 }] },
      { shape: kit.rect(34, 84, 172, 80, 12) },
      ...row(104, 92), ...row(124, 70, true), ...row(144, 104),
      {
        group: [
          { shape: kit.line(183, 135, 198, 150), width: 5.5 },
          { shape: kit.circle(168, 120, 21) },
          { shape: kit.path('M156 116 A13 13 0 0 1 168 107'), stroke: 'soft' },
        ],
        lift: 34,
        hover: [{ t: 0.3, x: -70, y: -14, ry: 0.25 }, { t: 0.62, x: -94, y: 4, ry: 0.35 }, { t: 1, x: 0, y: 0, ry: 0 }],
      },
    ],
  };
}

/** Settings: a switch is thrown. */
export function toggle() {
  const on = (y) => [
    { shape: kit.rect(148, y - 10, 36, 20, 10), fill: 'accent' },
    { shape: kit.circle(174, y, 5.5), fill: 'ink' },
  ];
  return {
    size: [240, 200],
    duration: 1300,
    parts: [
      { shape: kit.rect(40, 36, 160, 128, 14) },
      { shape: [...kit.line(60, 66, 118, 66), ...kit.line(60, 100, 104, 100), ...kit.line(60, 134, 124, 134)], stroke: 'soft' },
      ...on(66),
      // The middle switch is off: an "on" track with an "off" one over it, which fades as the knob crosses.
      { shape: kit.rect(148, 90, 36, 20, 10), fill: 'accent' },
      { shape: kit.rect(148, 90, 36, 20, 10), fill: 'tint', hover: [{ t: 0.2 }, { t: 0.6, opacity: 0 }] },
      { shape: kit.rect(148, 90, 36, 20, 10), fill: false },
      { shape: kit.circle(158, 100, 5.5), fill: 'ink', lift: 12, hover: [{ t: 0.15, z: 10 }, { t: 0.65, x: 16, z: 10 }, { t: 0.85, x: 16, z: 0 }] },
      ...on(134),
      { shape: kit.sparkle(213, 31, 8), fill: 'accent', stroke: 'accent', width: 1.4, lift: 36, hover: [{ t: 0.55, opacity: 0, scale: 0.4 }, { t: 0.6, opacity: 0, scale: 0.4 }, { t: 0.85, opacity: 1, scale: 1.3, rz: Q / 2 }, { t: 1, scale: 1, rz: Q }] },
    ],
  };
}

/** Layers: three sheets that come apart in depth. */
export function stack() {
  return {
    size: [240, 200],
    duration: 1400,
    lean: [0.16, -0.3],
    parts: [
      { shape: kit.rect(78, 36, 124, 84, 12), fill: 'tint', hover: [{ t: 1, x: 8, y: -8 }] },
      { shape: kit.rect(58, 58, 124, 84, 12), lift: 26 },
      {
        group: [
          { shape: kit.rect(38, 80, 124, 84, 12) },
          { shape: kit.lines(58, 122, [70, 46], 16), stroke: 'soft' },
          { shape: kit.circle(64, 101, 7), fill: 'accent', stroke: false },
        ],
        lift: 52,
        hover: [{ t: 1, x: -8, y: 8 }],
      },
    ],
  };
}

export const recipes = { assist, paste, plugin, search, toggle, stack };
