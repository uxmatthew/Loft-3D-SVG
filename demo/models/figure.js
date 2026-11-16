// A rigged figure, read out of Steve_riged.blend (Blender 2.90).
// 6 mesh objects, 68 vertices, 56 quads, each object parented to one bone of the armature.
//
// Each part is a box: a stack of four-cornered rings from its lower cap to its upper cap,
// loop cuts included. `pivot` is the head of the bone the part hangs from, so turning the
// part about it poses the figure. Points are [x, y, z] in the file's world units with Y up;
// the figure stands on y = 0 and faces +z.
window.LoftDemoModels = window.LoftDemoModels || {};
window.LoftDemoModels.figure = {
  source: "Steve_riged.blend",
  vertices: 68,
  quads: 56,
  parts: [
    {
      name: "head", object: "Cube", bone: "Bone.002",
      pivot: [0.0049, 4.7433, -0.0176],
      rings: [
        [[-0.8, 4.8, -0.8], [0.8, 4.8, -0.8], [0.8, 4.8, 0.8], [-0.8, 4.8, 0.8]],
        [[-0.8, 6.4, -0.8], [0.8, 6.4, -0.8], [0.8, 6.4, 0.8], [-0.8, 6.4, 0.8]],
      ],
    },
    {
      name: "torso", object: "Cube.001", bone: "Bone.001",
      pivot: [0.0049, 2.4249, -0.0176],
      rings: [
        [[-0.8, 2.4, -0.4], [0.8, 2.4, -0.4], [0.8, 2.4, 0.4], [-0.8, 2.4, 0.4]],
        [[-0.8, 4.8, -0.4], [0.8, 4.8, -0.4], [0.8, 4.8, 0.4], [-0.8, 4.8, 0.4]],
      ],
    },
    {
      name: "arm-left", object: "Cube.004", bone: "Bone.003",
      pivot: [1.1996, 4.3959, -0.0176],
      rings: [
        [[1.6, 2.4018, -0.4088], [1.6, 2.3983, 0.3912], [0.8, 2.3983, 0.3912], [0.8, 2.4018, -0.4088]],
        [[1.6, 3.5891, -0.4036], [1.6, 3.5856, 0.3964], [0.8, 3.5856, 0.3964], [0.8, 3.5891, -0.4036]],
        [[1.6, 3.9973, -0.4018], [1.6, 3.9938, 0.3982], [0.8, 3.9938, 0.3982], [0.8, 3.9973, -0.4018]],
        [[1.6, 4.8018, -0.3982], [1.6, 4.7982, 0.4018], [0.8, 4.7982, 0.4018], [0.8, 4.8018, -0.3982]],
      ],
    },
    {
      name: "arm-right", object: "Cube.005", bone: "Bone.010",
      pivot: [-1.1004, 4.3959, -0.0176],
      rings: [
        [[-1.5959, 2.4, 0.4], [-1.5959, 2.4, -0.4], [-0.7959, 2.4, -0.4], [-0.7959, 2.4, 0.4]],
        [[-1.5959, 3.9977, 0.4], [-1.5959, 3.9977, -0.4], [-0.7959, 3.9977, -0.4], [-0.7959, 3.9977, 0.4]],
        [[-1.5959, 4.8, 0.4], [-1.5959, 4.8, -0.4], [-0.7959, 4.8, -0.4], [-0.7959, 4.8, 0.4]],
      ],
    },
    {
      name: "leg-left", object: "Cube.002", bone: "Bone.006",
      pivot: [0.4431, 2.2121, -0.0176],
      rings: [
        [[0.0, 0.0, -0.4], [0.8, 0.0, -0.4], [0.8, 0.0, 0.4], [0.0, 0.0, 0.4]],
        [[0.0, 1.6801, -0.4], [0.8, 1.6801, -0.4], [0.8, 1.6801, 0.4], [0.0, 1.6801, 0.4]],
        [[0.0, 2.4, -0.4], [0.8, 2.4, -0.4], [0.8, 2.4, 0.4], [0.0, 2.4, 0.4]],
      ],
    },
    {
      name: "leg-right", object: "Cube.003", bone: "Bone.008",
      pivot: [-0.3569, 2.2121, -0.0176],
      rings: [
        [[-0.8, 0.0, -0.4], [0.0, 0.0, -0.4], [0.0, 0.0, 0.4], [-0.8, 0.0, 0.4]],
        [[-0.8, 1.6849, -0.4], [0.0, 1.6849, -0.4], [0.0, 1.6849, 0.4], [-0.8, 1.6849, 0.4]],
        [[-0.8, 2.4, -0.4], [0.0, 2.4, -0.4], [0.0, 2.4, 0.4], [-0.8, 2.4, 0.4]],
      ],
    },
  ],
};

// One closed surface of degree 1 from a stack of rings: around each ring in u, and
// pole, rings, pole in v. Every stretch is cut into squares about `unit` across, so
// iso-lines given one per square are evenly spaced over every part, and each square
// into `fine` spans, because small facets sort better where parts overlap.
// Points are measured from `origin`.
window.LoftDemoModels.prism = function prism(rings, origin, fine, unit = 0.4) {
  const lerp = (a, b, t) => a.map((x, k) => x + (b[k] - x) * t);
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const steps = (length) => fine * Math.max(1, Math.round(length / unit));
  // Loop cuts that leave the shape unchanged are skipped.
  const onLine = (p, a, b) => dist(p, lerp(a, b, dist(a, p) / (dist(a, b) || 1))) < 1e-3;
  const kept = rings.filter((r, k) => k === 0 || k === rings.length - 1 || !r.every((p, c) => onLine(p, rings[k - 1][c], rings[k + 1][c])));
  const cap = (r) => {
    const c = r.reduce((sum, p) => sum.map((x, k) => x + p[k] / r.length), [0, 0, 0]);
    return { pole: r.map(() => c), reach: Math.min(...r.map((p, k) => dist(c, lerp(p, r[(k + 1) % r.length], 0.5)))) };
  };
  const low = cap(kept[0]), high = cap(kept[kept.length - 1]);
  const stack = [low.pole, ...kept, high.pole], rows = [];
  for (let k = 0; k < stack.length - 1; k++) {
    const a = stack[k], b = stack[k + 1];
    const n = steps(k === 0 ? low.reach : k === stack.length - 2 ? high.reach : Math.max(...a.map((p, c) => dist(p, b[c]))));
    for (let s = 0; s < n; s++) rows.push(a.map((p, c) => lerp(p, b[c], s / n)));
  }
  rows.push(high.pole);
  const sides = kept[0].map((p, c, r) => steps(dist(p, r[(c + 1) % r.length])));
  const around = (r) => {
    const out = [];
    r.forEach((p, c) => { for (let s = 0; s < sides[c]; s++) out.push(lerp(p, r[(c + 1) % r.length], s / sides[c])); });
    out.push(r[0]);
    return out.map((p) => p.map((x, k) => x - origin[k]));
  };
  const net = rows.map(around);
  const points = net[0].map((_, i) => net.map((row) => row[i]));
  return { surface: new Loft.NurbsSurface({ degreeU: 1, degreeV: 1, points }), u: (points.length - 1) / fine, v: (rows.length - 1) / fine, fine };
};
