// An icon from demo/icons/icons.js as a spot recipe: its pieces stand at different depths
// and it plays a short motion chosen for its idea. Shared by the demo's Icons sheet and the
// README animations (media/animations). Needs window.Loft (dist/loft.global.js).
(() => {
  const { kit } = Loft, TAU = Math.PI * 2;
  // A short motion for each idea, in a 24-unit box (scaled to the icon's own). Each ends
  // where it began, so a hover plays it once and the icon comes to rest lifted.
  const motions = {
    heart: [{ t: 0.3, scale: 1.25, z: 4 }, { t: 0.6, scale: 0.95 }, { t: 1, scale: 1, z: 0 }],
    star: [{ t: 0.5, ry: Math.PI, z: 5 }, { t: 1, ry: TAU, z: 0 }],
    bell: { pivot: [12, 2], keys: [{ t: 0.15, rz: 0.45 }, { t: 0.35, rz: -0.38 }, { t: 0.55, rz: 0.26 }, { t: 0.75, rz: -0.14 }, { t: 1, rz: 0 }] },
    search: [{ t: 0.35, x: -2, ry: -0.6, z: 3 }, { t: 0.75, x: 2, ry: 0.6 }, { t: 1, x: 0, ry: 0, z: 0 }],
    settings: [{ t: 1, rz: TAU }],
    home: [{ t: 0.35, y: -4, z: 6, rx: 0.4 }, { t: 0.7, y: 0, z: 2, rx: 0 }, { t: 1, z: 0 }],
    mail: [{ t: 0.5, rx: Math.PI, z: 5 }, { t: 1, rx: TAU, z: 0 }],
    camera: [{ t: 0.2, scale: 0.88, z: -2 }, { t: 0.45, scale: 1.15, z: 5 }, { t: 1, scale: 1, z: 0 }],
    rocket: [{ t: 0.5, x: 3, y: -3, z: 7, rz: -0.12 }, { t: 1, x: 0, y: 0, z: 0, rz: 0 }],
    sparkles: [{ t: 0.5, rz: 0.7, scale: 1.2, z: 4 }, { t: 1, rz: 0, scale: 1, z: 0 }],
    bolt: [{ t: 0.08, x: -1.2 }, { t: 0.16, x: 1.2 }, { t: 0.24, x: -1 }, { t: 0.32, x: 0 }, { t: 0.55, scale: 1.18, z: 5 }, { t: 1, scale: 1, z: 0 }],
    cloud: [{ t: 0.5, x: 2.5, z: 4, ry: 0.5 }, { t: 1, x: 0, z: 0, ry: 0 }],
    sun: [{ t: 1, rz: TAU, z: 0 }],
    moon: [{ t: 0.3, rz: -0.4, z: 3 }, { t: 0.7, rz: 0.28 }, { t: 1, rz: 0, z: 0 }],
    lock: [{ t: 0.12, rz: 0.16 }, { t: 0.24, rz: -0.16 }, { t: 0.36, rz: 0.1 }, { t: 0.5, rz: 0, y: -2, z: 4 }, { t: 1, y: 0, z: 0 }],
    gift: [{ t: 0.3, y: -3, z: 5, rz: -0.2 }, { t: 0.6, y: -3, rz: 0.2 }, { t: 1, y: 0, z: 0, rz: 0 }],
    music: [{ t: 0.25, y: -2, rz: -0.18 }, { t: 0.5, y: 0, rz: 0 }, { t: 0.75, y: -2, rz: 0.18 }, { t: 1, y: 0, rz: 0 }],
    pin: [{ t: 0.4, y: -5, z: 7 }, { t: 0.7, y: 0, z: 0, scale: 1.1 }, { t: 1, scale: 1 }],
    trash: [{ t: 0.4, rz: -0.32, ry: 0.5, z: 4 }, { t: 1, rz: 0, ry: 0, z: 0 }],
    chat: [{ t: 0.35, scale: 1.2, z: 5, rx: -0.35 }, { t: 0.7, scale: 0.96, rx: 0 }, { t: 1, scale: 1, z: 0 }],
  };
  const LENGTHS = ['x', 'y', 'z']; // these scale with the icon's box; turns and scale do not
  const sized = (keys, f) => keys.map((k) => Object.fromEntries(Object.entries(k).map(([p, v]) => [p, LENGTHS.includes(p) ? v * f : v])));

  // How big a motion is: `energy` above 1 throws every offset, turn and swell further.
  const energise = (keys, k) => keys.map((key) => Object.fromEntries(Object.entries(key).map(([p, v]) =>
    [p, p === 't' || p === 'ease' ? v : p === 'scale' ? 1 + (v - 1) * k : (p === 'rx' || p === 'ry') && Math.abs(v) >= Math.PI ? v : v * k])));

  /**
   * The spot recipe for one icon of a library. A design system can set `width` (stroke
   * weight), `color` (a palette word or CSS colour for the strokes or fill), `accent` (the
   * colour of a stroke icon's foremost outline), `energy` (how big the motion is) and `tile`
   * (how round the paper tile behind it is).
   */
  const recipe = (lib, icon, { width = 2.2, color = 'ink', accent = color, energy = 1, tile = 1 } = {}) => {
    const [, , w, h] = icon.box, f = Math.max(w, h) / 24, move = motions[icon.concept];
    const keys = energise(Array.isArray(move) ? move : move.keys, energy);
    const last = icon.paths.length - 1;
    // The icon sits on a tile of paper, like an app icon, a margin of 6 units all round.
    // `tile` scales its corner radius, from square (0) to a circle (2.3 or more).
    const m = 6 * f, W = w + 2 * m, H = h + 2 * m, side = Math.min(W, H);
    // Outlines that meet or overlap on the page are one piece (a bin's lid, body and
    // handle), so they share a depth and turn together. Each piece of a stroke icon stands
    // a little further forward than the one before; the last outline takes the accent.
    const outlines = icon.paths.map((d) => kit.shift(kit.path(d), m, m));
    const fill = lib.kind === 'fill';
    const depth = [];
    kit.pieces(outlines, { gap: fill ? 0 : width / 2, filled: fill }).forEach((piece, k) => piece.members.forEach((i) => { depth[i] = k; }));
    const parts = outlines.map((shape, k) => ({
      shape,
      ...(fill ? { fill: color, stroke: false } : { fill: false, stroke: k === last && last > 0 ? accent : color, width }),
      lift: (fill ? 4 : 2 + 2.5 * depth[k]) * f * energy,
    }));
    const pivot = move.pivot ? move.pivot.map((v) => v * f + m) : null;
    return {
      size: [W, H],
      parts: [
        { shape: kit.rect(0, 0, W, H, Math.min(side / 2, side * 0.22 * tile)), fill: 'paper', stroke: false },
        { group: parts, hover: sized(keys, f), ...(pivot ? { pivot } : {}) },
      ],
    };
  };

  window.LoftIconSpots = { recipe, motions };
})();
