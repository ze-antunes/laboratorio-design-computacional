import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Raycaster, Vector2 } from "three";
import { visibleLandHit } from "../data/mapPicking";
import { world } from "../data/world";
import { countryContainsMapPoint, FLIGHT_BOUNDS as B } from "../data/geography";
import { wrapCoordinate } from "../data/worldStream";
import { useExplorer } from "../stores/useExplorer";

// Pick only the first visible map surface. Transparent country polygons are
// deliberately excluded: they can extend under water and across world copies.
export default function CountryPicking() {
  const { scene, camera, gl } = useThree();
  const ray = useMemo(() => new Raycaster(), []);
  const pointer = useRef(new Vector2());
  const inside = useRef(false);
  const down = useRef(null);
  const pick = () => {
    const state = useExplorer.getState();
    if (!inside.current || state.drawer) return null;
    const surfaces = [];
    scene.traverse((o) => {
      if (o.isMesh && o.visible && o.userData.mapSurface) surfaces.push(o);
    });
    ray.setFromCamera(pointer.current, camera);
    const hit = visibleLandHit(ray, surfaces);
    if (!hit) return null;
    let { x, z } = hit.point;
    if (state.cameraMode === "flight") {
      if (
        Math.hypot(x - state.telemetry.x, z - state.telemetry.z) >
        state.viewDistance
      )
        return null;
      x = wrapCoordinate(x, B.minX, B.maxX);
      z = wrapCoordinate(z, B.minZ, B.maxZ);
    }
    return (
      world.features
        .find((f) => countryContainsMapPoint(f, x, z))
        ?.id?.toString() ?? null
    );
  };
  const elapsed = useRef(0);
  useFrame((_, dt) => {
    elapsed.current += dt;
    if (elapsed.current < 0.08) return;
    elapsed.current = 0;
    const state = useExplorer.getState();
    const id = pick();
    if (id !== state.hoveredCountryId) state.hoverCountry(id);
  });
  useEffect(() => {
    const canvas = gl.domElement;
    const move = (e) => {
      const rect = canvas.getBoundingClientRect();
      pointer.current.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        (-(e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      inside.current = true;
    };
    const leave = () => {
      inside.current = false;
      down.current = null;
      contacts.clear();
      multiple = false;
      useExplorer.getState().hoverCountry(null);
    };
    const contacts = new Set();
    let multiple = false;
    const start = (e) => {
      contacts.add(e.pointerId);
      if (contacts.size > 1) {
        multiple = true;
        down.current = null;
        return;
      }
      multiple = false;
      move(e);
      down.current = [e.clientX, e.clientY, e.pointerId];
    };
    const cancel = (e) => {
      contacts.delete(e.pointerId);
      down.current = null;
      inside.current = false;
      useExplorer.getState().hoverCountry(null);
    };
    const end = (e) => {
      contacts.delete(e.pointerId);
      move(e);
      if (
        multiple ||
        !down.current ||
        down.current[2] !== e.pointerId ||
        Math.hypot(e.clientX - down.current[0], e.clientY - down.current[1]) > 8
      ) {
        down.current = null;
        return;
      }
      down.current = null;
      // Event/cluster handlers take precedence over country information.
      const id = pick();
      const hits = ray.intersectObjects(scene.children, true);
      if (
        hits.some(
          (h) =>
            h.object.name.includes("explosion") ||
            h.object.name.includes("event-point") ||
            h.object.name === "expanded-cluster-points",
        )
      )
        return;
      if (id) useExplorer.getState().openCountry(id);
    };
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerleave", leave);
    canvas.addEventListener("pointerdown", start);
    canvas.addEventListener("pointerup", end);
    canvas.addEventListener("pointercancel", cancel);
    return () => {
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerleave", leave);
      canvas.removeEventListener("pointerdown", start);
      canvas.removeEventListener("pointerup", end);
      canvas.removeEventListener("pointercancel", cancel);
    };
  }, [scene, camera, gl]);
  return null;
}
