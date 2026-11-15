import test from "node:test";
import assert from "node:assert/strict";
import {
  sceneSettings,
  cloudPlacement,
  chasePose,
  initialApproach,
  CLOUD_BASE,
  cloudVisibility,
} from "../src/javascript/data/sceneSettings.js";
import { stepFlight } from "../src/javascript/data/flight.js";
import {
  engineParameters,
  engineNoise,
  ENGINE_PROFILES,
} from "../src/javascript/data/engineAudio.js";

test("map and cloud size stay adjustable while old saved cloud heights are ignored", () => {
  assert.deepEqual(
    sceneSettings({ worldScale: 50, cloudSize: -2, cloudFloor: 36 }),
    { worldScale: 4, cloudSize: 1.2 },
  );
  assert.deepEqual(
    sceneSettings({ worldScale: "bad", cloudSize: 5, cloudFloor: 3 }),
    { worldScale: 2, cloudSize: 5 },
  );
});
test("clouds retain equal scale on all three axes, natural heights and the shared base", () => {
  let previousHeight = 0;
  for (const count of [1, 19, 178]) {
    const p = cloudPlacement(
      { scale: 0.22 * Math.cbrt(count) },
      { cloudSize: 5 },
      -2.5,
      1.19,
    );
    assert.equal(p.verticalScale, p.scale);
    assert.ok(Math.abs(p.y - 2.5 * p.scale - CLOUD_BASE) < 1e-8);
    const height = 5.05 * p.verticalScale;
    assert.ok(height > previousHeight);
    previousHeight = height;
  }
});
test("the chase camera follows below and above the cloud layer", () => {
  assert.ok(
    chasePose({ x: 0, y: 3.5, z: 0, heading: 0 }, 2).position[1] < CLOUD_BASE,
  );
  assert.ok(chasePose({ x: 0, y: 13, z: 0, heading: 0 }, 2).position[1] > 10.5);
});
test("clouds remain intact during clear under/overflights and dissolve only when obstructing the aircraft", () => {
  const bounds = { min: [-5, CLOUD_BASE, -5], max: [5, 10.5, 5] };
  assert.equal(cloudVisibility(1, [0, 5, -9], [0, 3.5, 0], bounds, 0.05), 1);
  assert.equal(cloudVisibility(1, [0, 17, -9], [0, 13, 0], bounds, 0.05), 1);
  assert.equal(cloudVisibility(1, [0, 9, -9], [0, 8, 0], bounds, 0.05), 0);
  assert.ok(cloudVisibility(0, [0, 17, -9], [0, 13, 0], bounds, 0.05) > 0);
  const early = cloudVisibility(
    1,
    [0, 8, -15],
    [0, 8, -7],
    bounds,
    0.05,
    [0, 0, 4],
  );
  assert.ok(early === 1, "distant clouds no longer fade ahead of the aircraft");
});

test("enlarging the map preserves actual aircraft speed and climb rate", () => {
  const create = (worldScale) => ({
    x: 0,
    y: 6,
    z: 0,
    pitch: 0.2,
    heading: 0.7,
    bank: 0,
    speed: 4,
    paused: false,
    worldScale,
  });
  const small = create(1),
    large = create(4);
  for (let i = 0; i < 60; i++) {
    stepFlight(small, {}, 1 / 60);
    stepFlight(large, {}, 1 / 60);
  }
  assert.ok(Math.abs(small.x - large.x * 4) < 1e-8);
  assert.ok(Math.abs(small.z - large.z * 4) < 1e-8);
  assert.equal(small.y, large.y);
  assert.equal(small.speed, large.speed);
});
test("engine timbre responds to throttle, aircraft engine count and bounded volume", () => {
  assert.ok(
    engineParameters(8, 0.5, "curtiss_p40_airplane").frequency >
      engineParameters(1, 0.5, "curtiss_p40_airplane").frequency,
  );
  assert.equal(engineParameters(4, 1, "german_ww2_bomber_henschel").engines, 2);
  assert.equal(engineParameters(4, 1, "ww2_aircraft_lowpoly").engines, 4);
  assert.equal(engineParameters(4, -1, "allies_airplane_ww2").volume, 0);
  assert.equal(engineParameters(4, 20, "allies_airplane_ww2").volume, 0.55);
  const noise = engineNoise(22050);
  assert.equal(noise.length, 44100);
  assert.ok(noise.every((n) => Number.isFinite(n) && Math.abs(n) <= 1));
  assert.ok(
    Math.abs(noise.reduce((sum, n) => sum + n, 0) / noise.length) < 0.02,
  );
});

test("the first approach faces the selected cloud and avoids a nearby competing cluster", () => {
  const target = { id: "first", x: 0, z: 0 },
    other = { id: "later", x: 0, z: 9 };
  const p = initialApproach(target, [target, other], 2);
  assert.ok(Math.hypot(p.x - other.x, p.z - other.z) > 10);
  assert.ok(Math.abs(Math.hypot(p.x, p.z) - 10) < 1e-8);
  assert.ok(Math.abs(p.x - Math.sin(p.heading) * 10) < 1e-8);
  assert.ok(Math.abs(p.z - Math.cos(p.heading) * 10) < 1e-8);
});

test("each aircraft has a distinct pitch and harmonic signature and manoeuvres alter engine load and airflow", () => {
  const ids = Object.keys(ENGINE_PROFILES);
  assert.equal(
    new Set(ids.map((id) => engineParameters(4, 0.5, id).frequency)).size,
    6,
  );
  assert.equal(
    new Set(ids.map((id) => JSON.stringify(ENGINE_PROFILES[id].harmonics)))
      .size,
    6,
  );
  const id = ids[0],
    level = engineParameters(4, 0.5, id),
    turn = engineParameters(4, 0.5, id, { bank: 0.5, turnRate: 0.5 }),
    dive = engineParameters(4, 0.5, id, { climbRate: -3, pitch: -0.4 });
  assert.ok(turn.frequency > level.frequency);
  assert.ok(dive.air > level.air);
  assert.ok(turn.pan < 0);
  assert.ok(
    engineParameters(4, 0.5, id, { bank: -0.5, turnRate: -0.5 }).pan > 0,
  );
});

test("a cloud hiding only a wing still dissolves even when the centre ray is clear", () => {
  const cloud = { min: [0.3, 7.3, -0.4], max: [1.6, 8.7, 0.4] };
  assert.equal(cloudVisibility(1, [0, 8, -9], [0, 8, 0], cloud, 0.05), 0);
});
