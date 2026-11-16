import test from 'node:test';
import assert from 'node:assert/strict';
import {
  Scene, shapes, looks, sphere, torus, cylinder, circle, revolve, curve, surface, morph, controlNet,
  ramp, mixColors, shadeStops, ease, resolveMaterial,
} from '../src/index.js';

const fixed = { ink: '#12242e', paper: '#e4ebea', accent: '#b5462b' };
const paths = (svg) => (svg.match(/<path /g) || []).length;

test('a headless scene renders to SVG markup', () => {
  const s = new Scene({ width: 400, height: 300, label: 'A sphere' });
  s.add(sphere(), 'clay');
  const svg = s.toSVG();
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="-200 -150 400 300"/);
  assert.match(svg, /role="img" aria-label="A sphere"/);
  assert.match(svg, /<title>A sphere<\/title>/);
  assert.ok(paths(svg) > 50);
  assert.ok(!/NaN|undefined|Infinity/.test(svg), 'no broken numbers in the output');
});

test('a scene without a label is hidden from assistive technology', () => {
  const s = new Scene();
  s.add(torus(), 'ink');
  assert.match(s.toSVG(), /aria-hidden="true"/);
});

test('rendering is deterministic', () => {
  const make = () => {
    const s = new Scene({ id: 'x', palette: fixed, shadow: true });
    s.add(shapes.vase(), 'toon');
    return s.toSVG();
  };
  assert.equal(make(), make());
});

test('every look draws every ready-made shape', () => {
  for (const look of Object.keys(looks)) {
    for (const name of ['vase', 'knot', 'shell', 'blob', 'ribbon', 'sheet', 'hull']) {
      const s = new Scene({ width: 240, height: 200, palette: fixed });
      s.add(shapes[name](), look);
      const svg = s.toSVG();
      assert.ok(paths(svg) > 0, `${name} in ${look} drew nothing`);
      assert.ok(!/NaN/.test(svg), `${name} in ${look} produced NaN`);
    }
  }
});

test('palette words stay as CSS variables until given fixed colours', () => {
  const themed = new Scene();
  themed.add(sphere(), 'clay');
  const a = themed.toSVG();
  assert.match(a, /--lf-accent:var\(--loft-accent,var\(--accent,/);
  assert.match(a, /color-mix\(in oklab/);

  const set = new Scene({ palette: fixed });
  set.add(sphere(), 'clay');
  const b = set.toSVG();
  assert.ok(!/color-mix/.test(b), 'fixed colours are resolved to hex');
  assert.match(b, /fill:#[0-9a-f]{6}/);
});

test('closed surfaces are detected and culled; open ones show both sides', () => {
  const s = new Scene({ palette: fixed });
  const ball = s.add(sphere(), 'clay');
  const pipe = s.add(cylinder({ caps: false }), 'clay');
  const ring = s.add(torus(), 'clay');
  s.render();
  assert.equal(ball._grid.solid, true);
  assert.equal(ring._grid.solid, true);
  assert.equal(pipe._grid.solid, false);
  assert.equal(ball._grid.sign, 1);
  assert.ok(Array.from(ball._grid.fstate).some((v) => v === -1), 'sphere back faces are culled');
  assert.ok(Array.from(pipe._grid.fstate).some((v) => v === 2), 'open cylinder shows its inside');
});

test('a profile drawn downward still gets outward normals', () => {
  const down = revolve(curve([[0, 1, 0], [1, 1, 0], [1, -1, 0], [0, -1, 0]], { degree: 1 }));
  const s = new Scene({ palette: fixed });
  const m = s.add(down, 'clay');
  s.render();
  assert.equal(m._grid.solid, true);
  assert.equal(m._grid.sign, -1);
});

test('range trims how much of a surface is drawn', () => {
  const s = new Scene({ palette: fixed });
  const m = s.add(shapes.knot(), 'clay');
  const full = paths(s.toSVG());
  m.range = { v: [0, 0.3] };
  const part = paths(s.toSVG());
  assert.ok(part > 0 && part < full * 0.6, `${part} of ${full}`);
  m.range = { v: [0, 0] };
  assert.equal(paths(s.toSVG()), 0);
});

test('loops and tweens settle at once when headless', () => {
  const s = new Scene({ poster: 2.5 });
  const m = s.add(sphere(), 'clay');
  let seen = null;
  s.loop(({ time }) => { seen = time; m.rotation.y = time; });
  assert.equal(seen, 2.5);
  assert.equal(m.rotation.y, 2.5);
  s.tween(m.position, { x: 3 });
  assert.equal(m.position.x, 3);
  s.tween(m, { range: { v: [0, 0.5] } });
  assert.deepEqual(m.range, { u: [0, 1], v: [0, 0.5] });
});

test('morph blends matching surfaces and rejects mismatched ones', () => {
  const a = revolve(curve([[0, -1, 0], [1, -1, 0], [1, 1, 0], [0.2, 1, 0]]));
  const b = revolve(curve([[0, -1, 0], [0.4, -1, 0], [2, 0, 0], [0.5, 1, 0]]));
  const m = morph(a, b);
  m.t = 0.5;
  const p = m.at(0.1, 0.5), pa = a.at(0.1, 0.5), pb = b.at(0.1, 0.5);
  assert.ok(Math.hypot(p[0], p[2]) > Math.hypot(pa[0], pa[2]) && Math.hypot(p[0], p[2]) < Math.hypot(pb[0], pb[2]));
  assert.throws(() => morph(sphere(), torus()), /same degrees, knots/);
});

test('curves, points and control nets draw', () => {
  const s = new Scene({ palette: fixed });
  const c = circle({ radius: 1 });
  s.add(c, { color: 'accent', width: 2 });
  s.add(c, { color: 'ink', dash: [4, 4] });
  s.add([[0, 0, 0], [1, 0, 0]], { size: 6, ring: 'paper' });
  s.add(controlNet(torus()));
  const svg = s.toSVG();
  assert.match(svg, /stroke-dasharray/);
  assert.ok(paths(svg) >= 4);
});

test('a ramp with a stop for every tone is used as given', () => {
  assert.deepEqual(ramp(['#000000', '#ff0000', '#ffffff'], 3), ['#000000', '#ff0000', '#ffffff']);
});

test('toon draws seven flat tones built around its colour', () => {
  const stops = looks.toon().fill.ramp('#e7cc91');
  assert.equal(stops.length, 7);
  assert.equal(new Set(stops).size, 7);
  assert.equal(stops[3], '#E94225'); // the vermilion band between shade and light
  assert.equal(stops[5], '#e7cc91');
  const draw = (color) => {
    const s = new Scene({ width: 240, height: 200, palette: fixed });
    s.add(shapes.vase(), { look: 'toon', color });
    return s.toSVG();
  };
  assert.match(draw(), /fill:#e7cc91/i);
  assert.match(draw('accent'), /fill:#b5462b/); // a palette word is resolved before the tones are mixed
  assert.doesNotMatch(draw('accent'), /color-mix/);
});

test('placed stops hold flat bands, cut hard edges and blend between', () => {
  const r = ramp([[0, '#000000'], [0.4, '#000000'], [0.4, '#ff0000'], [0.6, '#ff0000'], [1, '#ffffff']], 10);
  assert.deepEqual(r.slice(0, 6), ['#000000', '#000000', '#000000', '#000000', '#ff0000', '#ff0000']); // flat, then a hard edge
  assert.equal(new Set(r.slice(6)).size, 4); // every tone of the blend is its own colour
  assert.ok(!r.slice(6).includes('#ff0000') && !r.slice(6).includes('#ffffff'));
  assert.deepEqual(ramp([[0.5, '#111111'], [0.5, '#eeeeee']], 4), ['#111111', '#111111', '#eeeeee', '#eeeeee']); // ends hold
});

test('tones that share a colour are drawn as one band', () => {
  const draw = (tones) => {
    const s = new Scene({ id: 'x', width: 240, height: 200, palette: fixed });
    s.add(sphere(), { fill: { color: '#888888', tones, ramp: [[0, '#000000'], [0.5, '#000000'], [0.5, '#ffffff'], [1, '#ffffff']] } });
    return s.toSVG();
  };
  assert.equal(draw(40), draw(2)); // forty tones in two colours cut the sphere exactly as two tones do
});

// A flat fan: its lines of constant v run along u and lie twice as far apart at u = 1 as at u = 0.
const fan = () => surface([[[0, 0, 0], [0, 1, 0]], [[1, 0, 0], [1, 2, 0]]], { degreeU: 1, degreeV: 1 });

test('the gap between iso-lines is measured along each line, square to it', () => {
  const s = new Scene({ palette: fixed });
  const m = s.add(fan(), { look: 'engrave', lines: { v: 8 } });
  s.render();
  const g = m._grid, gaps = g.gaps().v;
  let lines = 0;
  for (let j = 0; j < g.NV; j++) {
    if (!g.v.iso[j]) continue;
    lines++;
    const near = gaps[j], far = gaps[(g.NU - 1) * g.NV + j];
    assert.ok(Math.abs(far / near - 2) < 1e-6, `line ${j}: ${near} to ${far}`);
  }
  assert.equal(lines, 9);
});

test('engraved lines swell where they fan apart', () => {
  const s = new Scene({ palette: fixed, camera: { azimuth: 0, elevation: 0 } });
  s.add(fan(), { look: 'engrave', lines: { v: 8 }, outline: false });
  s.render();
  // Each run of the drawing is one stroke width: weigh where along the fan its segments lie.
  const P = s.painter, toward = Math.sign(s.project([1, 0, 0]).x - s.project([0, 0, 0]).x), seen = [];
  for (let r = 0; r < P.runs; r++) {
    const w = Number((P.css[P.runStyle[r]].match(/stroke-width:([\d.]+)/) || [])[1]);
    const xs = [...P.runD[r].matchAll(/[ML](-?[\d.]+) /g)].map((x) => Number(x[1]) * toward);
    if (w) seen.push([w, xs.reduce((a, b) => a + b, 0) / xs.length]);
  }
  seen.sort((a, b) => a[0] - b[0]);
  assert.ok(seen.length > 2, 'the weight changes along the lines');
  assert.ok(seen.at(-1)[1] > seen[0][1], 'the heaviest strokes are toward the wide end');
});

test('evenly spaced lines keep their weight whatever the spread', () => {
  const draw = (spread) => {
    const s = new Scene({ id: 'x', width: 240, height: 200, palette: fixed });
    s.add(cylinder({ caps: false }), { look: 'engrave', lines: { spread } });
    return s.toSVG();
  };
  assert.equal(draw(1.5), draw(0));
});

// Every dot in a drawing, where it is and how wide, and every two-point stroke (the outline).
const strokes = (s) => {
  const P = s.painter, dots = [], segs = [];
  for (let r = 0; r < P.runs; r++) {
    const w = Number((P.css[P.runStyle[r]].match(/stroke-width:([\d.]+)/) || [])[1]);
    for (const m of P.runD[r].matchAll(/M(-?[\d.]+) (-?[\d.]+)h\.01/g)) dots.push({ x: +m[1], y: +m[2], w });
    for (const m of P.runD[r].matchAll(/M(-?[\d.]+) (-?[\d.]+)L(-?[\d.]+) (-?[\d.]+)(?=M|$)/g)) segs.push([+m[1], +m[2]], [+m[3], +m[4]]);
  }
  return { dots, segs };
};

test('halftone leaves the lights bare and grows its darkest dots, inside the outline', () => {
  const draw = (material) => {
    const s = new Scene({ palette: fixed });
    s.add(sphere(), material);
    s.render();
    return s;
  };
  const s = draw('halftone'), { dots, segs } = strokes(s);
  const even = strokes(draw({ look: 'halftone', dots: { size: 1, gamma: 1.15, white: 1, black: 0 } })).dots;
  const widest = (list) => Math.max(...list.map((d) => d.w));
  assert.ok(dots.length < even.length * 0.8, `the lights are bare: ${dots.length} dots against ${even.length}`);
  assert.ok(widest(dots) > widest(even) * 1.3, 'the darkest dots are bigger');
  // The outline is the sphere's silhouette, a circle round its centre, and no dot reaches past it.
  const o = s.project([0, 0, 0]), cx = o.x - s.W / 2, cy = o.y - s.H / 2;
  const rim = Math.max(...segs.map(([x, y]) => Math.hypot(x - cx, y - cy)));
  for (const d of dots) assert.ok(Math.hypot(d.x - cx, d.y - cy) + d.w / 2 <= rim + 0.5, `a dot ${d.w} wide at ${d.x}, ${d.y} crosses the outline`);
});

test('mistakes get messages that say what to do', () => {
  assert.throws(() => resolveMaterial('glass'), /Unknown look "glass"\. Available looks: clay, toon, ink, wire, engrave, halftone\./);
  assert.throws(() => new Scene().add({}), /expected a NurbsSurface, a NurbsCurve, an array of points, or a Node/);
});

test('colour ramps and easing behave at their ends', () => {
  assert.equal(mixColors('#000000', '#ffffff', 0), '#000000');
  assert.equal(mixColors('#000000', '#ffffff', 1), '#ffffff');
  assert.equal(ramp(['#000000', '#ffffff'], 5).length, 5);
  assert.equal(shadeStops('#b5462b').length, 5);
  assert.match(mixColors('var(--a)', '#fff', 0.25), /^color-mix\(in oklab, #fff 25%, var\(--a\)\)$/);
  for (const k of Object.keys(ease)) {
    assert.equal(ease[k](0), 0);
    assert.equal(ease[k](1), 1);
    for (let t = 0; t <= 1; t += 0.05) assert.ok(ease[k](t) <= 1.0001, `${k} overshoots at ${t}`);
  }
});

test('project maps a world point to picture coordinates', () => {
  const s = new Scene({ width: 400, height: 300, fit: false, camera: { azimuth: 0, elevation: 0, distance: 10 } });
  s.add(sphere(), 'clay');
  s.render();
  const c = s.project([0, 0, 0]);
  assert.ok(Math.abs(c.x - 200) < 1e-6 && Math.abs(c.y - 150) < 1e-6);
  assert.ok(s.project([1, 0, 0]).x > 200);
  assert.ok(s.project([0, 1, 0]).y < 150);
});
