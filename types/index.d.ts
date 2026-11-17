// Type definitions for loft-svg

export type Vec3 = [number, number, number];
export type Mat4 = Float64Array;
export type Knots = ArrayLike<number>;

// ── NURBS ───────────────────────────────────────────────────────────────────

export class NurbsCurve {
  constructor(options: { degree?: number; points?: number[][]; weights?: number[]; knots?: Knots; cp?: Float64Array });
  degree: number;
  count: number;
  knots: Float64Array;
  /** Homogeneous control points (w·x, w·y, w·z, w). */
  cp: Float64Array;
  version: number;
  readonly domain: [number, number];
  readonly closed: boolean;
  readonly points: Vec3[];
  readonly weights: number[];
  getPoint(i: number): Vec3;
  setPoint(i: number, p: number[], w?: number): this;
  setWeight(i: number, w: number): this;
  changed(): this;
  point(u: number, out?: number[]): Vec3;
  /** Point at a fraction t ∈ [0, 1] of the domain. */
  at(t: number, out?: number[]): Vec3;
  /** [C(u), C'(u), C''(u), …] up to order d. */
  derivatives(u: number, d?: number): Vec3[];
  tangent(u: number): Vec3;
  params(perSpan?: number): number[];
  sample(count?: number): Vec3[];
  length(perSpan?: number): number;
  clone(): NurbsCurve;
  transform(m: Mat4): NurbsCurve;
  reverse(): NurbsCurve;
}

export class NurbsSurface {
  constructor(options: {
    degreeU?: number; degreeV?: number;
    points?: number[][][]; weights?: number[][];
    knotsU?: Knots; knotsV?: Knots;
    cp?: Float64Array; countU?: number; countV?: number;
  });
  degreeU: number;
  degreeV: number;
  countU: number;
  countV: number;
  knotsU: Float64Array;
  knotsV: Float64Array;
  cp: Float64Array;
  version: number;
  readonly domainU: [number, number];
  readonly domainV: [number, number];
  getPoint(i: number, j: number): Vec3;
  getWeight(i: number, j: number): number;
  setPoint(i: number, j: number, p: number[], w?: number): this;
  setWeight(i: number, j: number, w: number): this;
  changed(): this;
  point(u: number, v: number, out?: number[]): Vec3;
  at(s: number, t: number, out?: number[]): Vec3;
  derivatives(u: number, v: number): { point: Vec3; du: Vec3; dv: Vec3 };
  normal(u: number, v: number): Vec3;
  isoCurve(fixed: 'u' | 'v', value: number): NurbsCurve;
  clone(): NurbsSurface;
  transform(m: Mat4): NurbsSurface;
  matches(other: NurbsSurface): boolean;
}

export function findSpan(n: number, p: number, u: number, U: Knots): number;
export function basisFuns(span: number, u: number, p: number, U: Knots, out?: Float64Array): Float64Array;
export function dersBasisFuns(span: number, u: number, p: number, nd: number, U: Knots): Float64Array[];
export function clampedKnots(count: number, degree: number): Float64Array;
export function uniformKnots(count: number, degree: number): Float64Array;
export function knotBreaks(U: Knots, degree: number, count: number): number[];
export function binomial(n: number, k: number): number;

export function refineKnots(p: number, U: Knots, Pw: Float64Array, X: number[]): { knots: Float64Array; cp: Float64Array };
export function refineCurve(curve: NurbsCurve, knots: ArrayLike<number>): NurbsCurve;
export function insertKnot(curve: NurbsCurve, u: number, times?: number): NurbsCurve;
export function refineSurface(surface: NurbsSurface, dir: 'u' | 'v', knots: ArrayLike<number>): NurbsSurface;
export function subcurve(curve: NurbsCurve, a?: number, b?: number): NurbsCurve;
export function splitCurve(curve: NurbsCurve, u: number): [NurbsCurve, NurbsCurve];
export function toBezier(curve: NurbsCurve): NurbsCurve[];
export function elevateDegree(curve: NurbsCurve, times?: number): NurbsCurve;
export function joinCurves(curves: NurbsCurve[]): NurbsCurve;
export function makeCompatible(curves: NurbsCurve[]): NurbsCurve[];

export function chordParams(points: number[][], alpha?: number): Float64Array;
export function averagedKnots(params: ArrayLike<number>, p: number): Float64Array;
export function interpolationSolver(params: ArrayLike<number>, p: number): { knots: Float64Array; solve(column: ArrayLike<number>): Float64Array };

// ── Constructors ────────────────────────────────────────────────────────────

export function line(a: number[], b: number[]): NurbsCurve;
export function polyline(points: number[][], options?: { closed?: boolean }): NurbsCurve;
export function curve(points: number[][], options?: { degree?: number; closed?: boolean; weights?: number[] }): NurbsCurve;
export function interpolate(points: number[][], options?: { degree?: number; centripetal?: boolean }): NurbsCurve;
export function arc(options?: { center?: number[]; radius?: number; radiusY?: number; start?: number; end?: number; xAxis?: number[]; yAxis?: number[] }): NurbsCurve;
export function circle(options?: { radius?: number; center?: number[]; normal?: number[] }): NurbsCurve;
export function ellipse(options?: { radiusX?: number; radiusY?: number; center?: number[] }): NurbsCurve;

export function surface(grid: number[][][], options?: { degreeU?: number; degreeV?: number; closedU?: boolean; closedV?: boolean; weights?: number[][] }): NurbsSurface;
export function plane(options?: { width?: number; depth?: number; segments?: [number, number]; degree?: number }): NurbsSurface;
export function extrude(profile: NurbsCurve, vector?: number[]): NurbsSurface;
export function ruled(a: NurbsCurve, b: NurbsCurve): NurbsSurface;
export function revolve(profile: NurbsCurve, options?: { axis?: number[]; origin?: number[]; angle?: number; start?: number }): NurbsSurface;
export function sphere(options?: { radius?: number }): NurbsSurface;
export function torus(options?: { radius?: number; tube?: number }): NurbsSurface;
export function cylinder(options?: { radius?: number; height?: number; caps?: boolean }): NurbsSurface;
export function cone(options?: { radius?: number; height?: number; top?: number; caps?: boolean }): NurbsSurface;
export function capsule(options?: { radius?: number; height?: number }): NurbsSurface;
export function loft(sections: NurbsCurve[], options?: { degree?: number; interpolate?: boolean; closed?: boolean }): NurbsSurface;
export type Along = number | ((t: number) => number);
export function sweep(profile: NurbsCurve, path: NurbsCurve, options?: { sections?: number; scale?: number | ((t: number) => number | [number, number]); twist?: Along; closed?: boolean }): NurbsSurface;
export function tube(path: NurbsCurve, options?: { radius?: Along; sections?: number; closed?: boolean }): NurbsSurface;
export interface Frame { t: number; origin: Vec3; tangent: Vec3; normal: Vec3; binormal: Vec3 }
export function frames(path: NurbsCurve, count: number, closed?: boolean): Frame[];

export namespace shapes {
  function vase(options?: { profile?: [number, number][] }): NurbsSurface;
  function knot(options?: { p?: number; q?: number; radius?: number; tube?: number; spread?: number }): NurbsSurface;
  function shell(options?: { turns?: number; growth?: number; height?: number }): NurbsSurface;
  function blob(options?: { seed?: number; bumps?: number; rings?: number; around?: number }): NurbsSurface;
  function ribbon(options?: { width?: number; twist?: number; length?: number }): NurbsSurface;
  function sheet(options?: { width?: number; depth?: number; segments?: number }): NurbsSurface;
  function hull(options?: { length?: number; beam?: number; depth?: number }): NurbsSurface;
  function normalizeSize(surface: NurbsSurface, radius?: number): NurbsSurface;
}

// ── Materials ───────────────────────────────────────────────────────────────

/** Any CSS colour, or a palette word that follows the page theme. */
/** Any CSS colour, or a palette word. `tint` and `soft` are a pale wash and a quiet line between paper and ink. */
export type Color = 'ink' | 'paper' | 'accent' | 'tint' | 'soft' | (string & {});
export type LookName = 'clay' | 'toon' | 'ink' | 'wire' | 'engrave' | 'halftone';

/** A ramp stop at a place between 0 (shadow) and 1 (light). */
export type PlacedStop = [at: number, color: Color];

export interface FillLayer {
  color?: Color;
  /**
   * Explicit shadow-to-highlight stops, instead of deriving them from `color`: a list, or a
   * function that builds one from the resolved `color`. As many stops as `tones` are used as given.
   *
   * Stops may instead be `[at, colour]` pairs placed along 0–1, for an uneven ramp: two stops of
   * one colour hold a flat band, two at one place make a hard edge, and any other pair blends,
   * which reads as a blurred edge when `tones` is high.
   */
  ramp?: Color[] | PlacedStop[] | ((color: string) => Color[] | PlacedStop[]);
  /** One flat colour, no shading. */
  flat?: boolean;
  /** Number of tones; 2–4 gives a cel-shaded look. Default 24. */
  tones?: number;
  /** One tone per facet (low-poly) instead of smooth tone contours. */
  facets?: boolean;
  ambient?: number;
  wrap?: number;
  specular?: number;
  shininess?: number;
  opacity?: number;
  /** Brightness of the reverse side of an open surface, 0–1. */
  back?: number;
}
export interface LinesLayer {
  /** How many lines of constant u (they run along v). */
  u?: number;
  /** How many lines of constant v (they run along u). */
  v?: number;
  color?: Color;
  width?: number;
  /** Lines on faces turned away from the viewer, when nothing opaque covers them. */
  hidden?: 'none' | 'faint' | 'dashed';
  /** 0–1: how much the line weight follows the shading (engraving). */
  shade?: number;
  /**
   * How much the line weight follows the spacing between lines, measured on the surface:
   * lines swell where they fan apart and thin where they crowd. At 1 a line gets at most
   * twice or half its weight; higher is bolder. 0 (the default) turns it off; `engrave` uses 1.5.
   */
  spread?: number;
  /** 0–1: how much lines fade with distance. */
  depth?: number;
  opacity?: number;
}
export interface OutlineLayer {
  color?: Color;
  width?: number;
  /** Edges sharper than this many degrees are drawn; false turns crease lines off. */
  crease?: number | false;
  /** Draw the open edges of a surface. */
  boundary?: boolean;
}
export interface DotsLayer {
  color?: Color;
  /** At 1 the biggest dot is a little narrower than its facet; above that, dark dots run together. */
  size?: number;
  /** How dots grow from `white` to `black`; above 1 they stay small longer. */
  gamma?: number;
  /** 0–1: tones this light or lighter get no dot. 1 by default; `halftone` uses 0.8. */
  white?: number;
  /** 0–1: tones this dark or darker get the biggest dot. 0 by default; `halftone` uses 0.32. */
  black?: number;
}

export interface Material {
  look?: LookName;
  /** Shorthand for the look's fill colour. */
  color?: Color;
  fill?: FillLayer | Color | boolean;
  lines?: LinesLayer | number | boolean;
  outline?: OutlineLayer | number | boolean;
  dots?: DotsLayer | number | boolean;
  /** Hide faces turned away from the viewer. 'auto' does so for closed surfaces. */
  cull?: 'auto' | boolean;
  /** Reverse which side counts as the outside. */
  flip?: boolean;
  /** Detail multiplier for this surface. */
  detail?: number;
}
export interface CurveStyle { color?: Color; width?: number; opacity?: number; depth?: number; dash?: number | number[]; detail?: number }
export interface PointsStyle { color?: Color; size?: number; ring?: Color }
export interface ShapeStyle {
  /** Fill colour, or false for none. Default 'paper'. */
  fill?: Color | false;
  /** Stroke colour, or false for none. Default 'ink'. */
  stroke?: Color | false;
  width?: number;
  opacity?: number;
  dash?: number | number[];
  detail?: number;
}

export const looks: Record<LookName, (options?: { color?: Color }) => Material>;
export function resolveMaterial(m: Material | LookName | null | undefined): Material;

export function parseColor(css: string): [number, number, number] | null;
export function mixColors(a: string, b: string, t: number): string;
export function ramp(stops: string[] | [at: number, color: string][], tones: number): string[];
export function shadeStops(color: string): string[];

// ── Scene ───────────────────────────────────────────────────────────────────

export interface Triple { x: number; y: number; z: number; set(x: number | number[], y?: number, z?: number): this; toArray(): Vec3 }

export class Node {
  get position(): Triple;
  set position(v: number[] | Triple);
  /** Euler angles in radians, XYZ order (as in three.js). */
  get rotation(): Triple;
  set rotation(v: number[] | Triple);
  get scale(): Triple;
  set scale(v: number | number[] | Triple);
  visible: boolean;
  children: Node[];
  parent: Node | null;
  scene: Scene | null;
  add<T extends Node>(child: T): T;
  remove(child: Node): this;
  traverse(fn: (node: Node) => void): void;
}
export interface Range { u?: [number, number]; v?: [number, number] }
export class SurfaceMesh extends Node {
  constructor(geometry: NurbsSurface, material?: Material | LookName);
  geometry: NurbsSurface;
  material: Material | LookName;
  /** The part of the surface that is drawn, as fractions of its parameter range. */
  get range(): Required<Range>;
  set range(r: Range);
  /** Move each sample point in place: (point, u, v, time) with u, v ∈ [0, 1]. */
  deform: ((point: Vec3, u: number, v: number, time: number) => void) | null;
  castShadow: boolean;
}
export class CurveMesh extends Node {
  constructor(geometry: NurbsCurve, style?: CurveStyle | Color);
  geometry: NurbsCurve;
  material: CurveStyle | Color;
  range: [number, number];
}
export class PointsMesh extends Node {
  constructor(points: number[][], style?: PointsStyle | Color);
  points: number[][];
  material: PointsStyle | Color;
}

export interface CameraOptions {
  azimuth?: number; elevation?: number; distance?: number; fov?: number; zoom?: number; roll?: number;
  orthographic?: boolean; target?: number[]; position?: number[];
}
export class Camera {
  constructor(options?: CameraOptions);
  azimuth: number;
  elevation: number;
  distance: number;
  fov: number;
  zoom: number;
  roll: number;
  swing: number;
  orthographic: boolean;
  target: number[];
  position: Vec3;
  view: Mat4;
  update(): Mat4;
}

/** One or more curves drawn as a single flat shape: filled, stroked, or both. */
export class ShapeMesh extends Node {
  constructor(geometry: NurbsCurve | NurbsCurve[], style?: ShapeStyle | Color);
  readonly kind: 'shape';
  geometry: NurbsCurve[];
  material: ShapeStyle | Color;
  /** 0 to 1, on top of the style's opacity; stepped in twentieths. */
  opacity: number;
  /** Fixed drawing order: higher is in front, and in front of anything sorted by depth. */
  layer: number | null;
}

export interface ShadowOptions { color?: Color; opacity?: number; blur?: number; y?: number | null }
export interface SceneOptions {
  /** Size used before the scene is measured, and when headless. Default 640 × 480. */
  width?: number;
  height?: number;
  camera?: CameraOptions | Camera;
  /** Light direction (toward the light). In 'view' space it stays fixed to the camera. */
  light?: { direction?: number[]; space?: 'view' | 'world' };
  /** Frame the camera around the scene's contents. Default true. */
  fit?: boolean;
  /** Frame the camera on a fixed box [width, height, depth] centred on the origin, instead of on the contents. */
  frame?: [number, number, number?] | null;
  /** Margin around the fitted contents, as a fraction of the box. Default 0.08. */
  padding?: number;
  /** Shift the picture inside its box, as fractions of width and height. */
  offset?: [number, number];
  /** Detail multiplier. Default 1. */
  detail?: number;
  /** The box size, in pixels, at which stroke widths are true to their numbers. Default 480. */
  reference?: number;
  shadow?: boolean | ShadowOptions;
  /** Accessible name. Without one the scene is treated as decoration. */
  label?: string;
  background?: Color | null;
  palette?: { ink?: string; paper?: string; accent?: string };
  /** 'auto' follows the visitor's reduced-motion preference. */
  motion?: 'auto' | 'always' | 'off';
  /** Add a pause button once something has moved by itself for five seconds. Default 'auto'. */
  pauseButton?: 'auto' | false;
  /** Time, in seconds, shown as the still frame under reduced motion and when headless. */
  poster?: number;
  id?: string;
}
export interface TweenOptions { duration?: number; ease?: (t: number) => number; delay?: number; onUpdate?: (progress: number) => void }
export interface Tween extends Promise<boolean> { cancel(): void }
export interface OrbitOptions {
  drag?: boolean;
  /** Automatic turn, radians per second. */
  auto?: number;
  inertia?: boolean;
  /** Lean toward the pointer, radians at the edge of the box. Fine pointers only. */
  hover?: number;
  keys?: boolean;
  minElevation?: number;
  maxElevation?: number;
  /** Milliseconds of rest before the automatic turn resumes after a drag. */
  resume?: number;
}
export class Orbit {
  constructor(scene: Scene, options?: OrbitOptions);
  auto: number;
  inertia: boolean;
  hover: number;
  readonly moving: boolean;
  update(dt: number): void;
  dispose(): void;
}

export class Scene {
  constructor(target?: Element | string | null, options?: SceneOptions);
  constructor(options?: SceneOptions);
  readonly id: string;
  /** Width and height of the picture in pixels. */
  W: number;
  H: number;
  camera: Camera;
  light: { direction: number[]; space: 'view' | 'world' };
  palette: { ink?: string; paper?: string; accent?: string };
  root: Node;
  host?: Element;
  svg?: SVGSVGElement | null;
  /** Seconds of running time. */
  time: number;
  lod: number;
  paused: boolean;
  label: string;
  readonly reducedMotion: boolean;

  add(surface: NurbsSurface, material?: Material | LookName, placement?: Placement): SurfaceMesh;
  add(curve: NurbsCurve, style?: CurveStyle | Color, placement?: Placement): CurveMesh;
  add(points: number[][], style?: PointsStyle | Color, placement?: Placement): PointsMesh;
  add<T extends Node>(node: T, material?: null, placement?: Placement): T;
  group(placement?: Placement): Node;
  remove(node: Node): this;
  clear(): this;
  fit(): this;
  setPalette(palette?: { ink?: string; paper?: string; accent?: string }): this;
  invalidate(): this;
  render(): this;
  toSVG(size?: { width?: number; height?: number }): string;
  project(point: number[]): { x: number; y: number; depth: number; visible: boolean };

  loop(fn?: (state: { time: number; dt: number; scene: Scene }) => void): () => void;
  tween(target: object, to: Record<string, unknown>, options?: TweenOptions): Tween;
  orbit(options?: OrbitOptions): Orbit;
  intro(options?: { turn?: number; duration?: number; scale?: number }): Promise<boolean>;
  pause(): this;
  resume(): this;
  destroy(): void;
}
export interface Placement { position?: number[]; rotation?: number[]; scale?: number | number[] }

export function controlNet(geometry: NurbsCurve | NurbsSurface, options?: { color?: Color; width?: number; size?: number; dash?: number[]; ring?: Color }): Node & { update(): Node };
export function morph<T extends NurbsCurve | NurbsSurface>(a: T, b: T): T & { t: number };

// ── Motion ──────────────────────────────────────────────────────────────────

export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number;
export const ease: { out: (t: number) => number; enter: (t: number) => number; inOut: (t: number) => number; linear: (t: number) => number };

export namespace math {
  const TAU: number;
  function clamp(x: number, lo: number, hi: number): number;
  function lerp(a: number, b: number, t: number): number;
  function add(a: number[], b: number[]): Vec3;
  function sub(a: number[], b: number[]): Vec3;
  function scale(a: number[], s: number): Vec3;
  function dot(a: number[], b: number[]): number;
  function cross(a: number[], b: number[]): Vec3;
  function length(a: number[]): number;
  function distance(a: number[], b: number[]): number;
  function mix(a: number[], b: number[], t: number): Vec3;
  function normalize(a: number[]): Vec3;
  function perpendicular(v: number[]): Vec3;
  function identity(out?: Mat4): Mat4;
  function multiply(a: Mat4, b: Mat4, out?: Mat4): Mat4;
  function compose(position: number[], rotation: number[], scale: number[], out?: Mat4): Mat4;
  function translation(v: number[]): Mat4;
  function scaling(v: number | number[]): Mat4;
  function rotation(axis: number[], angle: number): Mat4;
  function lookAt(eye: number[], target: number[], up: number[], out?: Mat4): Mat4;
  function transformPoint(m: Mat4, p: number[]): Vec3;
  function transformDirection(m: Mat4, v: number[]): Vec3;
}

// ── UI illustrations (spots) ────────────────────────────────────────────────────

/** Offsets from rest. x, y, z are artboard units (y down, z toward the viewer); angles are radians. */
export interface SpotPose {
  x?: number; y?: number; z?: number;
  /** Tips the top edge away. */
  rx?: number;
  /** Turns the right edge away. */
  ry?: number;
  /** Turns clockwise. */
  rz?: number;
  scale?: number;
  opacity?: number;
}
/** A keyframe at `t` (0 to 1) of the motion. A property keeps its value until a later keyframe changes it. */
export interface SpotKey extends SpotPose { t: number; ease?: (t: number) => number }
export interface SpotPart {
  /** Outlines from `kit`, in artboard coordinates. */
  shape?: NurbsCurve | NurbsCurve[];
  /** Parts that move together. Use instead of `shape`. */
  group?: SpotPart[];
  /** Default 'paper' for closed outlines, none for open ones. */
  fill?: Color | false;
  /** Default 'ink'. */
  stroke?: Color | false;
  width?: number;
  dash?: number | number[];
  opacity?: number;
  /** How far the part stands off the page while hovered. */
  lift?: number;
  /** Its motion: keyframes, or one pose reached between `from` and `to`. */
  hover?: SpotKey[] | (SpotPose & { from?: number; to?: number });
  /** The point it turns and scales about. Default: the centre of its outlines. */
  pivot?: [number, number];
}
export interface SpotRecipe {
  /** Artboard [width, height]. Default [240, 200]. */
  size?: [number, number];
  parts: SpotPart[];
  /** Lean when there is no pointer to follow: [top edge away, right edge away], radians. */
  lean?: [number, number];
  /** Milliseconds for one pass of the motion. */
  duration?: number;
  /** Milliseconds of rest between passes of a loop. */
  hold?: number;
  /** Default stroke width. */
  stroke?: number;
  /** Repeat by starting over (true) or by playing back and forth (false). Default: start over if the motion ends at rest. */
  cycle?: boolean;
}
export type SpotName = 'assist' | 'paste' | 'plugin' | 'search' | 'toggle' | 'stack';
export interface SpotOptions extends SceneOptions {
  /** 'loop' repeats the motion while hovered, 'once' plays it through and holds, false leaves it still. Default 'loop'. */
  hover?: 'loop' | 'once' | false;
  /** The element (or a selector for an ancestor) whose hover and keyboard focus play the motion. Default: the picture's own box. */
  trigger?: Element | string;
  /** Lean under the pointer, radians at the edge of the trigger: none in the middle, most in a corner. Default 0.32; 0 turns it off. */
  follow?: number;
  /** The lean when there is no pointer to follow (keyboard focus, touch, play()). */
  lean?: [number, number];
  duration?: number;
  hold?: number;
  stroke?: number;
  /** Scales the corner radii of a ready-made illustration: below 1 squarer, above 1 rounder. Default 1. */
  radius?: number;
}
export class Spot {
  constructor(target: Element | string | null, recipe?: SpotName | SpotRecipe | (() => SpotRecipe), options?: SpotOptions);
  scene: Scene;
  root: Node;
  /** The nodes in drawing order. */
  parts: Node[];
  size: [number, number];
  hover: 'loop' | 'once' | false;
  lean: [number, number];
  follow: number;
  /** Seconds. */
  duration: number;
  hold: number;
  cycle: boolean;
  trigger?: Element;
  readonly active: boolean;
  /** Play as if hovered, until stop(). */
  play(mode?: 'loop' | 'once'): this;
  stop(): this;
  /** Hold one moment without animating: progress through the motion and weight of the hover pose, both 0 to 1. */
  pose(progress?: number, weight?: number): this;
  toSVG(size?: { width?: number; height?: number }): string;
  destroy(): void;
}
export const spots: Record<SpotName, () => SpotRecipe>;

/** Outlines for flat illustration. x runs right and y runs down from the artboard's top-left corner. */
export namespace kit {
  function rect(x: number, y: number, width: number, height: number, radius?: number): NurbsCurve[];
  function circle(cx: number, cy: number, radius: number): NurbsCurve[];
  function line(x1: number, y1: number, x2: number, y2: number): NurbsCurve[];
  function polyline(points: number[][], options?: { closed?: boolean }): NurbsCurve[];
  function lines(x: number, y: number, widths: number[], gap?: number): NurbsCurve[];
  function sparkle(cx: number, cy: number, radius: number, pinch?: number): NurbsCurve[];
  function bubble(x: number, y: number, width: number, height: number, radius?: number, tail?: number): NurbsCurve[];
  function check(cx: number, cy: number, size?: number): NurbsCurve[];
  function rays(cx: number, cy: number, r0: number, r1: number, angles: number[]): NurbsCurve[];
  function command(cx: number, cy: number, size?: number): NurbsCurve[];
  /** Outlines from SVG path data. */
  function path(d: string): NurbsCurve[];
  function turn(curves: NurbsCurve | NurbsCurve[], angle: number, cx?: number, cy?: number): NurbsCurve[];
  function shift(curves: NurbsCurve | NurbsCurve[], dx?: number, dy?: number): NurbsCurve[];
  /**
   * Sorts outlines into the pieces that hold together: outlines that come within `gap` of
   * each other (or, with `filled`, lie inside a closed one) join one piece.
   */
  function pieces(
    outlines: Array<NurbsCurve | NurbsCurve[]>,
    options?: { gap?: number; filled?: boolean },
  ): Array<{ shape: NurbsCurve[]; members: number[] }>;
}

/** The <loft-scene> custom element (exported by loft-svg/element). */
export class LoftScene extends HTMLElement {
  scene: Scene | null;
  mesh: SurfaceMesh;
}

/** The <loft-spot> custom element (exported by loft-svg/element). */
export class LoftSpot extends HTMLElement {
  spot: Spot | null;
}
