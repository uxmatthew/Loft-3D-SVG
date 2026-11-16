import { compose, multiply, identity } from '../math.js';

/** Three numbers that tell their owner when they change, so the scene knows to redraw. */
class Triple {
  constructor(owner, x, y, z) {
    this._o = owner; this._x = x; this._y = y; this._z = z;
  }
  get x() { return this._x; }
  set x(v) { if (v !== this._x) { this._x = v; this._o._touch(); } }
  get y() { return this._y; }
  set y(v) { if (v !== this._y) { this._y = v; this._o._touch(); } }
  get z() { return this._z; }
  set z(v) { if (v !== this._z) { this._z = v; this._o._touch(); } }
  set(x, y = x, z = x) {
    if (Array.isArray(x)) [x, y, z] = x;
    this._x = x; this._y = y; this._z = z;
    this._o._touch();
    return this;
  }
  toArray() { return [this._x, this._y, this._z]; }
}

/**
 * Anything placed in a scene. `position`, `rotation` (Euler XYZ, radians) and
 * `scale` can be assigned whole (`node.position = [0, 1, 0]`, `node.scale = 2`)
 * or per component (`node.rotation.y += 0.01`). Either way the scene redraws on
 * the next frame; nothing is drawn while nothing changes.
 */
export class Node {
  constructor() {
    this._position = new Triple(this, 0, 0, 0);
    this._rotation = new Triple(this, 0, 0, 0);
    this._scale = new Triple(this, 1, 1, 1);
    this.children = [];
    this.parent = null;
    this.scene = null;
    this._visible = true;
    this.local = identity();
    this.world = identity();
  }

  get position() { return this._position; }
  set position(v) { this._position.set(v); }
  get rotation() { return this._rotation; }
  set rotation(v) { this._rotation.set(v); }
  get scale() { return this._scale; }
  set scale(v) { this._scale.set(v); }
  get visible() { return this._visible; }
  set visible(v) { this._visible = !!v; this._touch(); }

  _touch() { this.scene?.invalidate(); }

  _attach(scene) {
    this.scene = scene;
    for (const c of this.children) c._attach(scene);
  }

  /** Add a child node; it then moves with this one. */
  add(child) {
    child.parent?.remove(child);
    child.parent = this;
    this.children.push(child);
    child._attach(this.scene);
    this.scene?._structureChanged();
    return child;
  }

  remove(child) {
    const i = this.children.indexOf(child);
    if (i >= 0) {
      this.children.splice(i, 1);
      child.parent = null;
      this.scene?._structureChanged();
      child._attach(null);
    }
    return this;
  }

  _updateWorld(parentWorld) {
    compose(this._position.toArray(), this._rotation.toArray(), this._scale.toArray(), this.local);
    if (parentWorld) multiply(parentWorld, this.local, this.world);
    else this.world.set(this.local);
    for (const c of this.children) c._updateWorld(this.world);
  }

  /** Visit this node and everything under it. */
  traverse(fn) {
    fn(this);
    for (const c of this.children) c.traverse(fn);
  }
}

/** A NURBS surface in a scene. */
export class SurfaceMesh extends Node {
  constructor(geometry, material) {
    super();
    this.kind = 'surface';
    this._geometry = geometry;
    this._material = material;
    this._compiled = null;
    this._grid = null;
    this._range = { u: [0, 1], v: [0, 1] };
    /** Optional per-vertex displacement: (point, u, v, time) => void, editing `point` in place. */
    this.deform = null;
    this.castShadow = true;
  }

  get geometry() { return this._geometry; }
  set geometry(g) { this._geometry = g; this._grid = null; this.scene?._structureChanged(); }

  get material() { return this._material; }
  set material(m) { this._material = m; this._compiled = null; this._grid = null; this._touch(); }

  /**
   * The part of the surface that is drawn, as fractions of its parameter range.
   * Animate it to grow a surface into place: `mesh.range = { v: [0, t] }`.
   */
  get range() { return this._range; }
  set range(r) {
    this._range = { u: r.u || this._range.u, v: r.v || this._range.v };
    this._touch();
  }
}

/** A NURBS curve in a scene, drawn as a stroke. */
export class CurveMesh extends Node {
  constructor(geometry, style) {
    super();
    this.kind = 'curve';
    this.geometry = geometry;
    this._material = style;
    this._compiled = null;
    this._range = [0, 1];
  }
  get material() { return this._material; }
  set material(m) { this._material = m; this._compiled = null; this._touch(); }
  /** The drawn part of the curve as fractions of its length in parameter; animate it to draw the line on. */
  get range() { return this._range; }
  set range(r) { this._range = r; this._touch(); }
}

/**
 * One or more curves drawn as a single flat shape: filled, stroked, or both.
 * Closed curves are filled; several curves make one shape with several outlines.
 * `layer` fixes the drawing order (higher is in front, and in front of anything
 * sorted by depth), which is what a flat illustration tilted in space needs.
 */
export class ShapeMesh extends Node {
  constructor(geometry, style) {
    super();
    this.kind = 'shape';
    this._geometry = Array.isArray(geometry) ? geometry : [geometry];
    this._material = style;
    this._compiled = null;
    this._opacity = 1;
    this._layer = null;
  }
  get geometry() { return this._geometry; }
  set geometry(g) { this._geometry = Array.isArray(g) ? g : [g]; this.scene?._structureChanged(); }
  get material() { return this._material; }
  set material(m) { this._material = m; this._compiled = null; this._touch(); }
  /** 0 to 1, on top of the style's own opacity. Stepped in twentieths so animating it stays cheap. */
  get opacity() { return this._opacity; }
  set opacity(v) {
    v = Math.round(Math.max(0, Math.min(1, v)) * 20) / 20;
    if (v !== this._opacity) { this._opacity = v; this._compiled = null; this._touch(); }
  }
  get layer() { return this._layer; }
  set layer(v) { this._layer = v; this._touch(); }
}

/** Loose points in a scene, drawn as dots. */
export class PointsMesh extends Node {
  constructor(points, style) {
    super();
    this.kind = 'points';
    this.points = points;
    this._material = style;
    this._compiled = null;
  }
  get material() { return this._material; }
  set material(m) { this._material = m; this._compiled = null; this._touch(); }
}
