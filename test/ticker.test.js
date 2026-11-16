import test from 'node:test';
import assert from 'node:assert/strict';
import { wake, sleep } from '../src/motion.js';

// A stand-in for the browser's frame clock: callbacks queue up and all run on the next "frame".
function fakeFrames() {
  let queue = [], now = 0;
  globalThis.requestAnimationFrame = (fn) => { queue.push(fn); return queue.length; };
  return {
    /** Run one animation frame; returns how many callbacks the browser would have run. */
    step() {
      const run = queue;
      queue = [];
      now += 16.7;
      for (const fn of run) fn(now);
      return run.length;
    },
    get pending() { return queue.length; },
  };
}

test('one frame callback per frame, however often scenes ask to be redrawn', () => {
  const clock = fakeFrames();
  let ticks = 0;
  // A scene whose tick asks for another redraw, as every tween, loop and turning camera does.
  const scene = { _tick() { ticks++; wake(scene); wake(scene); } };
  const other = { _tick() { wake(other); wake(scene); } };
  wake(scene);
  wake(other);
  for (let frame = 1; frame <= 40; frame++) {
    assert.equal(clock.step(), 1, `frame ${frame} ran more than one callback`);
  }
  assert.equal(ticks, 40, 'the scene ticked exactly once per frame');
  assert.equal(clock.pending, 1);
  sleep(scene);
  sleep(other);
  clock.step();
  assert.equal(clock.pending, 0, 'nothing is scheduled once every scene sleeps');
  // and it starts again cleanly
  wake(scene);
  assert.equal(clock.pending, 1);
  sleep(scene);
  clock.step();
  delete globalThis.requestAnimationFrame;
});
