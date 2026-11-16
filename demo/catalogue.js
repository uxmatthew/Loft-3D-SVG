// The eight shapes shown on the Shapes sheet, shared by the demo page and the README
// animations (media/animations). Each entry: what to call it, the code that makes it,
// the camera elevation it reads best from, how it tunes each look, and a second shape
// for it to morph into. Needs window.Loft (dist/loft.global.js).
(() => {
  const { shapes, torus, capsule } = Loft;

  // The waves across the sheet: a ring that travels out from the centre.
  const rippleAt = (p, u, v, t) => {
    const r = Math.hypot(p[0], p[2]);
    p[1] = (0.2 * Math.sin(4.4 * r - 3.2 * t)) / (1 + 0.9 * r);
  };

  // A second shape to morph into: the same control net with each point moved, so the two
  // blend point for point. `at(p, k)` is where p sits in the net's box along axis k, -1 to 1.
  const reshape = (g, move) => {
    const out = g.clone(), lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < g.countU; i++) for (let j = 0; j < g.countV; j++) {
      const p = g.getPoint(i, j);
      for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[k]); hi[k] = Math.max(hi[k], p[k]); }
    }
    const at = (p, k) => (hi[k] > lo[k] ? (2 * (p[k] - lo[k])) / (hi[k] - lo[k]) - 1 : 0);
    for (let i = 0; i < g.countU; i++) for (let j = 0; j < g.countV; j++) {
      const p = g.getPoint(i, j);
      move(p, at);
      out.setPoint(i, j, p);
    }
    return out;
  };
  const twist = (axis, turn) => (p, at) => {
    const [a, b] = axis === 'x' ? [1, 2] : [0, 2], r = turn * at(p, axis === 'x' ? 0 : 1);
    const c = Math.cos(r), s = Math.sin(r), pa = p[a], pb = p[b];
    p[a] = pa * c - pb * s; p[b] = pa * s + pb * c;
  };

  // Line counts that suit a long thin shape: few lines along it, many across.
  const knotTune = { wire: { lines: { u: 8, v: 36 } } };
  const ribbonTune = {
    ink: { lines: { u: 3, v: 18 } },
    wire: { lines: { u: 3, v: 18 } },
    halftone: { detail: 3 }, // dots sit one to a facet, and a narrow band has few
  };
  // The sheet faces the light, so all its tones are light ones: its dots start, and fill up, higher.
  const sheetTune = { all: { detail: 1.3 }, halftone: { dots: { size: 1.5, white: 0.86, black: 0.62 } } };

  const entries = [
    { name: 'Vase', code: 'revolve(profile)', make: () => shapes.vase(), elevation: 0.3,
      into: (p, at) => { const s = 0.62 + (0.42 * (at(p, 1) + 1) ** 2) / 2; p[0] *= s; p[2] *= s; } }, // flares into a trumpet
    { name: 'Torus', code: 'torus()', make: () => torus({ radius: 1, tube: 0.42 }), elevation: 0.5,
      into: (p) => { p[1] += 0.42 * Math.cos(2 * Math.atan2(p[2], p[0])); } }, // a saddle-shaped ring
    { name: 'Capsule', code: 'capsule()', make: () => capsule({ radius: 0.55, height: 2.3 }), elevation: 0.25,
      into: (p, at) => { p[0] += 0.75 * at(p, 1) ** 2 - 0.35; } }, // bends like a bean
    { name: 'Knot', code: 'tube(path)', make: () => shapes.knot(), elevation: 0.55, tune: knotTune,
      into: (p) => { p[1] *= 2.2; p[0] *= 0.78; p[2] *= 0.78; } }, // pulled up into a spring
    { name: 'Shell', code: 'sweep(circle, spiral)', make: () => shapes.shell(), elevation: 0.25,
      into: (p, at) => { p[1] *= 1.45; twist('y', 0.9)(p, at); } }, // a taller spire
    { name: 'Waves', code: 'plane() + deform', make: () => shapes.sheet(), elevation: 0.55, tune: sheetTune, deform: rippleAt,
      into: (p, at) => { p[1] += 0.55 * (at(p, 0) ** 2 - at(p, 2) ** 2); } }, // a saddle
    { name: 'Ribbon', code: 'sweep(line, path)', make: () => shapes.ribbon(), elevation: 0.35, tune: ribbonTune,
      into: twist('x', 1.6) }, // twists further
    { name: 'Hull', code: 'loft(frames)', make: () => shapes.hull(), elevation: 0.4, tune: { ink: { lines: { u: 12, v: 0 } } },
      into: (p) => { p[2] *= 1.45; p[1] *= 1.6; } }, // a wide, deep punt
  ];
  for (const e of entries) e.tune = e.tune || {};

  /** The material for a shape in a look, with the shape's own tuning. */
  const dress = (entry, look) => ({ look, ...entry.tune.all, ...entry.tune[look] });

  window.LoftCatalogue = { entries, reshape, rippleAt, knotTune, dress };
})();
