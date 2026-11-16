// <loft-scene>: a scene from markup alone.
//
//   <loft-scene shape="knot" look="ink" spin orbit label="A trefoil knot"></loft-scene>
//
// Attributes
//   shape      sphere | torus | cylinder | cone | capsule | vase | knot | shell | blob | ribbon | sheet | hull
//   params     JSON options for the shape, e.g. '{"p":3,"q":4}'
//   look       clay | toon | ink | wire | engrave | halftone
//   color      fill colour (any CSS colour, or ink | paper | accent)
//   spin       turn slowly by itself; optional speed in radians per second
//   orbit      let people drag it and turn it with the arrow keys
//   intro      play the entrance once on load
//   shadow     draw a ground shadow
//   azimuth, elevation   camera angles in degrees
//   label      accessible name; without one the scene is treated as decoration

import { Scene } from './scene.js';
import { Spot } from './spot/spot.js';
import { recipes } from './spot/recipes.js';
import * as shapes from './shapes.js';
import { sphere, torus, cylinder, cone, capsule } from './nurbs/make.js';

const SHAPES = { sphere, torus, cylinder, cone, capsule, ...shapes };
delete SHAPES.normalizeSize;

const Base = typeof HTMLElement === 'undefined' ? class {} : HTMLElement;

export class LoftScene extends Base {
  static get observedAttributes() {
    return ['shape', 'params', 'look', 'color', 'spin', 'orbit', 'shadow', 'azimuth', 'elevation', 'label'];
  }

  connectedCallback() {
    this._build();
  }

  disconnectedCallback() {
    this.scene?.destroy();
    this.scene = null;
  }

  attributeChangedCallback() {
    if (this.scene) this._build();
  }

  _build() {
    this.scene?.destroy();
    const num = (name, fallback) => (this.hasAttribute(name) && this.getAttribute(name) !== '' ? Number(this.getAttribute(name)) : fallback);
    const name = this.getAttribute('shape') || 'torus';
    const make = SHAPES[name];
    if (!make) throw new Error(`<loft-scene>: unknown shape "${name}". Shapes: ${Object.keys(SHAPES).join(', ')}.`);
    let params = {};
    if (this.hasAttribute('params')) {
      try { params = JSON.parse(this.getAttribute('params')); }
      catch { throw new Error('<loft-scene>: the params attribute must be valid JSON, for example params=\'{"radius":2}\'.'); }
    }
    const scene = (this.scene = new Scene(this, {
      label: this.getAttribute('label') || '',
      shadow: this.hasAttribute('shadow'),
      camera: { azimuth: (num('azimuth', 35) * Math.PI) / 180, elevation: (num('elevation', 22) * Math.PI) / 180 },
    }));
    const material = { look: this.getAttribute('look') || 'clay' };
    if (this.hasAttribute('color')) material.color = this.getAttribute('color');
    /** The mesh, for scripts that want to restyle or move it. */
    this.mesh = scene.add(make(params), material);
    const spin = this.hasAttribute('spin') ? num('spin', 0.3) : 0;
    if (spin || this.hasAttribute('orbit')) {
      scene.orbit({ auto: spin, drag: this.hasAttribute('orbit'), keys: this.hasAttribute('orbit') });
    }
    if (this.hasAttribute('intro')) scene.intro();
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('loft-scene')) {
  customElements.define('loft-scene', LoftScene);
}

// <loft-spot>: a UI illustration (a spot) from markup alone.
//
//   <loft-spot name="paste" hover="loop" label="Paste from the clipboard"></loft-spot>
//
// Attributes
//   name      assist | paste | plugin | search | toggle | stack
//   hover     loop (default) | once | off
//   trigger   a selector for the ancestor whose hover and focus play the motion, e.g. ".card"
//   label     accessible name; without one the picture is treated as decoration
export class LoftSpot extends Base {
  static get observedAttributes() {
    return ['name', 'hover', 'trigger', 'label'];
  }

  connectedCallback() {
    this._build();
  }

  disconnectedCallback() {
    this.spot?.destroy();
    this.spot = null;
  }

  attributeChangedCallback() {
    if (this.spot) this._build();
  }

  _build() {
    this.spot?.destroy();
    const name = this.getAttribute('name') || 'assist';
    if (!recipes[name]) throw new Error(`<loft-spot>: unknown illustration "${name}". Ready-made ones: ${Object.keys(recipes).join(', ')}.`);
    const hover = this.getAttribute('hover') || 'loop';
    /** The illustration, for scripts that want to play or restyle it. */
    this.spot = new Spot(this, name, {
      hover: hover === 'off' || hover === 'false' ? false : hover === 'once' ? 'once' : 'loop',
      trigger: this.getAttribute('trigger') || undefined,
      label: this.getAttribute('label') || '',
    });
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('loft-spot')) {
  customElements.define('loft-spot', LoftSpot);
}
