import test from "node:test";
import assert from "node:assert/strict";
import { stepFlight } from "../src/javascript/data/flight.js";
const plane = () => ({
  x: 0,
  y: 6,
  z: 0,
  pitch: 0,
  bank: 0,
  heading: 0,
  speed: 4,
  paused: false,
});
test("touch axes preserve proportional pitch and bank rather than turning every movement into full input", () => {
  const soft = plane(),
    full = plane();
  for (let i = 0; i < 30; i++) {
    stepFlight(soft, { rollAxis: 0.3, pitchAxis: 0.3 }, 1 / 60);
    stepFlight(full, { rollAxis: 1, pitchAxis: 1 }, 1 / 60);
  }
  assert.ok(soft.y > 6 && soft.y < full.y);
  assert.ok(
    Math.abs(soft.heading) > 0 &&
      Math.abs(soft.heading) < Math.abs(full.heading),
  );
});
test("releasing touch axes levels the aircraft without leaving a held turn", () => {
  const f = plane();
  for (let i = 0; i < 30; i++)
    stepFlight(f, { rollAxis: 1, pitchAxis: 1 }, 1 / 60);
  for (let i = 0; i < 240; i++)
    stepFlight(f, { rollAxis: 0, pitchAxis: 0 }, 1 / 60);
  assert.ok(Math.abs(f.pitch) < 0.00001 && Math.abs(f.bank) < 0.00001);
});
