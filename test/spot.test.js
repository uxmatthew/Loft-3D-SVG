import test from 'node:test';
import assert from 'node:assert/strict';
import { Scene, Spot, spots, kit, ShapeMesh, circle, torus } from '../src/index.js';

const fixed = { ink: '#14172b', paper: '#ffffff', accent: '#f9d24c' };
const paths = (svg) => (svg.match(/<path /g) || []).length;
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
const drawing = (svg) => svg.slice(svg.indexOf('<g '));

test('a flat shape is one path of its own, filled and stroked', () => {
  const s = new Scene({ id: 's', palette: fixed, camera: { azimuth: 0, elevation: 0 } });
  s.add(new ShapeMesh(circle(), { fill: 'accent', stroke: 'ink', width: 2 }));
  s.add(new ShapeMesh(circle({ radius: 0.5 }), { fill: 'accent', stroke: 'ink', width: 2 }));
  const svg = s.toSVG();
  assert.equal(paths(svg), 2, 'two shapes of one style are not merged, so the nearer covers the stroke of the farther');
  assert.match(svg, /fill:#f9d24c;stroke:#14172b;stroke-width:2/);
  assert.match(svg, /Z"/);
});

test('layers set the drawing order whatever the depth, and sit in front of depth-sorted things', () => {
  const s = new Scene({ id: 's', palette: fixed, camera: { azimuth: 0, elevation: 0 } });
  const front = new ShapeMesh(circle(), { fill: '#111111', stroke: false });
  const back = new ShapeMesh(circle(), { fill: '#222222', stroke: false });
  front.layer = 2; back.layer = 1;
  front.position.z = -3; // farther from the camera, yet a higher layer
  s.add(front); s.add(back); s.add(torus(), 'clay');
  const svg = s.toSVG();
  assert.ok(svg.lastIndexOf('<path') === svg.indexOf(`<path class="s-${/s-(\d+)\{fill:#111111/.exec(svg)[1]}"`), 'the highest layer is drawn last');
});

test('opacity steps in twentieths and nothing is drawn at zero', () => {
  const s = new Scene({ palette: fixed });
  const m = s.add(new ShapeMesh(circle(), { fill: 'ink' }));
  m.opacity = 0.52;
  assert.equal(m.opacity, 0.5);
  assert.match(s.toSVG(), /opacity:0\.5/);
  m.opacity = 0;
  assert.equal(paths(s.toSVG()), 0);
});

test('kit outlines land where they are asked to', () => {
  const [r] = kit.rect(10, 20, 100, 60, 12);
  assert.ok(r.closed);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const p of r.sample(400)) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  assert.ok(near(x0, 10, 1e-3) && near(x1, 110, 1e-3) && near(y0, 20, 1e-3) && near(y1, 80, 1e-3));
  // every point of the top-right corner is one radius from its centre: the arc is exact
  for (const p of r.sample(400)) if (p[0] > 98 && p[1] < 32) assert.ok(near(Math.hypot(p[0] - 98, p[1] - 32), 12, 1e-9));
  assert.equal(kit.rect(0, 0, 40, 20, 99).length, 1, 'a radius too large makes a pill, not an error');
  assert.equal(kit.lines(0, 0, [10, 20, 30]).length, 3);
  assert.ok(kit.sparkle(0, 0, 10)[0].closed && kit.bubble(0, 0, 80, 30)[0].closed && kit.command(0, 0)[0].closed);
});

test('kit.path reads SVG path data, arcs included', () => {
  const [a, b] = kit.path('M10 10 h30 v20 H10 Z m50 0 l10 0');
  assert.ok(a.closed && !b.closed);
  assert.deepEqual(b.at(0).slice(0, 2), [60, 10]);
  // a half circle of radius 10 from (0,0) to (20,0), bulging upward on the screen (y runs down)
  const [arc] = kit.path('M0 0 A10 10 0 0 1 20 0');
  const mid = arc.at(0.5);
  assert.ok(near(mid[0], 10) && near(mid[1], -10), `mid point ${mid}`);
  const [other] = kit.path('M0 0 A10 10 0 0 0 20 0');
  assert.ok(near(other.at(0.5)[1], 10), 'the other sweep bulges the other way');
  const [quarter] = kit.path('M10 0 A10 10 0 0 1 0 10'); // clockwise on screen from (10,0): the long way is not taken
  for (const p of quarter.sample(9)) assert.ok(near(Math.hypot(p[0], p[1] - 0), 10, 1e-9) || near(Math.hypot(p[0] - 10, p[1] - 10), 10, 1e-9));
  const [smooth] = kit.path('M0 0 C0 10 10 10 10 0 S20 -10 20 0');
  assert.ok(near(smooth.at(1)[0], 20) && near(smooth.at(1)[1], 0));
  assert.throws(() => kit.path('M0 0 L10'), /needs 2 numbers/);
  const [turned] = kit.turn(kit.line(0, 0, 10, 0), Math.PI / 2);
  assert.ok(near(turned.at(1)[0], 0) && near(turned.at(1)[1], 10), 'a quarter turn clockwise takes right to down');
});

test('every ready-made spot draws, at rest and hovered', () => {
  for (const name of Object.keys(spots)) {
    const s = new Spot(null, name, { palette: fixed, id: 'x' });
    const rest = s.toSVG();
    assert.match(rest, /viewBox="-120 -100 240 200"/);
    assert.ok(paths(rest) >= 4, `${name} drew ${paths(rest)} paths`);
    assert.ok(!/NaN|undefined|Infinity/.test(rest), `${name} has broken numbers`);
    for (const p of [0.25, 0.5, 0.75, 1]) {
      const svg = s.pose(p, 1).toSVG();
      assert.ok(!/NaN|undefined|Infinity/.test(svg), `${name} has broken numbers at ${p}`);
      assert.notEqual(svg, rest, `${name} does not move at ${p}`);
    }
    assert.equal(drawing(s.pose(0, 0).toSVG()), drawing(rest), `${name} returns exactly to rest`);
  }
});

test('at rest a spot is the flat drawing: the artboard fills the box and nothing is foreshortened', () => {
  const s = new Spot(null, { size: [200, 100], parts: [{ shape: kit.rect(0, 0, 200, 100), stroke: false, fill: 'ink' }] }, { palette: fixed, padding: 0 });
  assert.match(s.toSVG(), /d="M-100 -50L100 -50 100 50 -100 50Z"/);
  // hovered, it leans: the right edge comes forward and so is drawn taller than the left
  const d = /d="([^"]+)"/.exec(s.pose(0, 1).toSVG())[1].match(/-?[\d.]+/g).map(Number);
  const left = Math.abs(d[7] - d[1]), right = Math.abs(d[5] - d[3]);
  assert.ok(right > left * 1.02, `right edge ${right} should be taller than left ${left}`);
});

test('hover motion: lift is held, keyframes carry values forward, groups move their parts', () => {
  const s = new Spot(null, {
    size: [240, 200],
    parts: [
      { shape: kit.rect(100, 80, 40, 40), lift: 20, hover: [{ t: 0.5, x: 10 }, { t: 1, y: 6 }] },
      { group: [{ shape: kit.circle(50, 50, 10) }], hover: { rz: 1, opacity: 0.5, from: 0.5 } },
    ],
  });
  const [box, group, dot] = s.parts;
  assert.deepEqual(box.position.toArray(), [0, 0, 0]);
  s.pose(0.5, 1);
  assert.ok(near(box.position.x, 10) && near(box.position.z, 20) && near(box.position.y, 0));
  assert.ok(near(group.rotation.z, 0), 'the group waits for its `from`');
  s.pose(1, 1);
  assert.ok(near(box.position.x, 10) && near(box.position.y, -6), 'x is carried forward; y down on the artboard is y down in space');
  assert.ok(near(group.rotation.z, -1), 'rz turns clockwise on screen');
  assert.equal(dot.opacity, 0.5, 'a group passes its opacity to its parts');
  s.pose(1, 0.5);
  assert.ok(near(box.position.z, 10), 'weight scales the whole hover pose');
  assert.equal(s.cycle, false, 'motion that ends away from rest plays back and forth');
  assert.equal(new Spot(null, 'plugin').cycle, true, 'motion that ends at rest starts over');
});

test('under the pointer the lean is nothing in the middle and grows toward edges and corners', () => {
  const s = new Spot(null, 'assist');
  assert.deepEqual(s._aim(), s.lean, 'with no pointer the picture takes its own lean');
  const at = (x, y) => { s._pointer = true; s._tx = x; s._ty = y; return s._aim(); };
  assert.ok(at(0, 0).every((v) => v === 0), 'square-on in the middle');
  const [, near] = at(0.25, 0), [, half] = at(0.5, 0), [, edge] = at(1, 0);
  assert.ok(near < edge * 0.15 && half < edge * 0.4, 'gentle near the middle, steep toward the edge');
  assert.ok(Math.abs(edge - s.follow) < 1e-9, 'the edge is `follow` radians');
  const corner = at(1, -1);
  assert.ok(corner[1] > edge && corner[0] > 0, 'a corner leans further, on both axes: the top-right corner goes away');
  assert.ok(at(-1, 0)[1] < 0, 'and the left edge goes the other way');
  s.follow = 0;
  assert.deepEqual(at(1, 1), [0, 0]);
});

test('unknown names and bad recipes say what is wrong', () => {
  assert.throws(() => new Spot(null, 'nope'), /unknown illustration "nope".*assist/);
  assert.throws(() => new Spot(null, {}), /recipe is/);
});
