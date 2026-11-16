// Loft: NURBS curves and surfaces, drawn as plain SVG.

// The mathematics
export * from './nurbs/basis.js';
export { NurbsCurve } from './nurbs/curve.js';
export { NurbsSurface } from './nurbs/surface.js';
export * from './nurbs/ops.js';
export { chordParams, averagedKnots, interpolationSolver } from './nurbs/fit.js';
export * from './nurbs/make.js';
export * as shapes from './shapes.js';

// Drawing
export { Scene, resolveMaterial } from './scene.js';
export { Camera } from './render/camera.js';
export { Node, SurfaceMesh, CurveMesh, PointsMesh, ShapeMesh } from './render/node.js';
export { looks } from './render/material.js';
export { parseColor, mixColors, ramp, shadeStops } from './render/color.js';
export { controlNet, morph } from './helpers.js';

// Spot illustrations: flat pictures of interface ideas that lean and move on hover
export { Spot } from './spot/spot.js';
export { recipes as spots } from './spot/recipes.js';
export * as kit from './spot/kit.js';

// Motion
export { ease, cubicBezier, Orbit } from './motion.js';

// Vector and matrix helpers
export * as math from './math.js';
