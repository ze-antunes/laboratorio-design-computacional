import { worldDistance, wrapCoordinate } from "./worldStream.js";
import { FLIGHT_BOUNDS as B } from "./geography.js";
export const DEFAULT_SCENE_SETTINGS = {
  worldScale: 2,
  cloudSize: 2.6,
};
const limit = (value, min, max, fallback) =>
  Number.isFinite(Number(value))
    ? Math.min(max, Math.max(min, Number(value)))
    : fallback;
export function sceneSettings(values = {}) {
  return {
    worldScale: limit(
      values.worldScale,
      1,
      4,
      DEFAULT_SCENE_SETTINGS.worldScale,
    ),
    cloudSize: limit(
      values.cloudSize,
      1.2,
      5,
      DEFAULT_SCENE_SETTINGS.cloudSize,
    ),
  };
}
export function loadSceneSettings() {
  try {
    return sceneSettings(
      JSON.parse(
        globalThis.localStorage?.getItem("ldc-scene-settings-v1") || "{}",
      ),
    );
  } catch {
    return { ...DEFAULT_SCENE_SETTINGS };
  }
}
export const CLOUD_BASE = 5.5;
export const CRUISE_ALTITUDE = 3.5;
export function cloudPlacement(cluster, settings, geometryMinY, pulse = 1) {
  const scale = cluster.scale * settings.cloudSize * pulse;
  return { scale, verticalScale: scale, y: CLOUD_BASE - geometryMinY * scale };
}
export function chasePose(flight, worldScale) {
  const heading = flight.cameraHeading ?? flight.heading;
  const t = Math.max(0, Math.min(1, (flight.y - 4) / (12 - 4))),
    blend = t * t * (3 - 2 * t);
  return {
    position: [
      flight.x * worldScale + Math.sin(heading) * 9,
      flight.y + 1.5 + 2.5 * blend,
      flight.z * worldScale + Math.cos(heading) * 9,
    ],
    target: [
      flight.x * worldScale - Math.sin(heading) * 5,
      flight.y + 3 - 4 * blend,
      flight.z * worldScale - Math.cos(heading) * 5,
    ],
  };
}
export function segmentIntersectsCloud(
  start,
  end,
  bounds,
  padding = 0,
  endPadding = padding,
) {
  // Intersect the complete camera-to-aircraft viewing pyramid, including wing
  // tips. Its cross-section grows continuously towards the aircraft.
  let near = 0,
    far = 1;
  const sizes = Array.isArray(endPadding)
    ? endPadding
    : [endPadding, endPadding, endPadding];
  for (let axis = 0; axis < 3; axis++)
    for (const sign of [-1, 1]) {
      const bound = sign > 0 ? bounds.min[axis] : bounds.max[axis];
      const constant = sign * (start[axis] - bound) + padding;
      const slope = sign * (end[axis] - start[axis]) + sizes[axis] - padding;
      if (Math.abs(slope) < 1e-8) {
        if (constant < 0) return false;
        continue;
      }
      const crossing = -constant / slope;
      if (slope > 0) near = Math.max(near, crossing);
      else far = Math.min(far, crossing);
      if (near > far) return false;
    }
  return true;
}
function protectedSightline(camera, aircraft, bounds, padding, halfSize) {
  return segmentIntersectsCloud(
    camera,
    aircraft,
    bounds,
    padding,
    halfSize.map((v) => v + padding),
  );
}
export function cloudVisibility(
  previous,
  camera,
  aircraft,
  bounds,
  dt,
  velocity = [0, 0, 0],
  halfSize = [1.1, 0.6, 1.1],
) {
  if (
    segmentIntersectsCloud(camera, camera, bounds, 0.15) ||
    protectedSightline(camera, aircraft, bounds, 0.02, halfSize)
  )
    return 0;
  const future = (p) => p.map((v, i) => v + velocity[i] * 0.1);
  const target =
    segmentIntersectsCloud(camera, camera, bounds, 0.22) ||
    segmentIntersectsCloud(future(camera), future(camera), bounds, 0.22) ||
    protectedSightline(camera, aircraft, bounds, 0.06, halfSize) ||
    protectedSightline(future(camera), future(aircraft), bounds, 0.06, halfSize)
      ? 0
      : 1;
  return (
    previous + (target - previous) * (1 - Math.exp(-Math.min(dt, 0.05) * 12))
  );
}
export function isCloudHitVisible(hit) {
  const object = hit.object;
  if (!object.visible) return false;
  return object.isInstancedMesh
    ? (object.geometry.getAttribute("cloudVisibility")?.getX(hit.instanceId) ??
        1) > 0.05
    : (object.material.uniforms?.cloudOpacity?.value ?? 1) > 0.05;
}

// Approach the selected cloud from the least crowded side, rather than spawning
// under a neighbouring campaign and changing the initial event before flight.
export function initialApproach(cluster, clusters, worldScale) {
  let best = null;
  for (let i = 0; i < 16; i++) {
    const heading = (i * Math.PI) / 8,
      distance = 20 / worldScale;
    const x = wrapCoordinate(
      cluster.x + Math.sin(heading) * distance,
      B.minX,
      B.maxX,
    );
    const z = wrapCoordinate(
      cluster.z + Math.cos(heading) * distance,
      B.minZ,
      B.maxZ,
    );
    const score = Math.min(
      ...clusters
        .filter((c) => c.id !== cluster.id)
        .map((c) => worldDistance(x, z, c.x, c.z)),
    );
    if (!best || score > best.score) best = { x, z, heading, score };
  }
  return best;
}
