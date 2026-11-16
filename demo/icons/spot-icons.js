// An icon from demo/icons/icons.js as a spot recipe: its outlines stand at different depths
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

  /** The spot recipe for one icon of a library. */
  const recipe = (lib, icon) => {
    const [, , w, h] = icon.box, f = Math.max(w, h) / 24, move = motions[icon.concept];
    const keys = Array.isArray(move) ? move : move.keys;
    // Each outline of a stroke icon stands a little further forward than the one before.
    const style = lib.kind === 'fill' ? { fill: 'ink', stroke: false } : { fill: false, stroke: 'ink', width: 2.2 };
    const parts = icon.paths.map((d, k) => ({ shape: kit.path(d), ...style, lift: (lib.kind === 'fill' ? 4 : 2 + 2.5 * k) * f }));
    return { size: [w, h], parts: [{ group: parts, hover: sized(keys, f), ...(move.pivot ? { pivot: move.pivot.map((v) => v * f) } : {}) }] };
  };

  window.LoftIconSpots = { recipe, motions };
})();
