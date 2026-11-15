import { useEffect, useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useExplorer } from "../../stores/useExplorer";
import { nearestWorldPosition } from "../../data/worldStream";
import {
  cloudPlacement,
  cloudVisibility,
  isCloudHitVisible,
} from "../../data/sceneSettings";
import { StyleShader } from "./StyleShader";
const dummy = new THREE.Object3D();
export function Wars({ clusters }) {
  const { nodes } = useGLTF(
    `${import.meta.env.BASE_URL}trees.glb`,
    `${import.meta.env.BASE_URL}draco/`,
  );
  const { nodes: distantNodes } = useGLTF(
    `${import.meta.env.BASE_URL}trees-lod.glb`,
  );
  const { nodes: mediumNodes } = useGLTF(
    `${import.meta.env.BASE_URL}trees-mid.glb`,
  );
  const geometryMinY = useMemo(() => {
    return Math.min(
      ...[
        nodes.Foliage.geometry,
        mediumNodes.Foliage.geometry,
        distantNodes.Foliage.geometry,
      ].map((g) => {
        g.computeBoundingBox();
        return g.boundingBox.min.y;
      }),
    );
  }, [nodes, mediumNodes, distantNodes]);
  const layers = useMemo(() => {
    const far = distantNodes.Foliage.geometry.clone(),
      medium = mediumNodes.Foliage.geometry.clone();
    for (const g of [far, medium])
      g.setAttribute(
        "cloudVisibility",
        new THREE.InstancedBufferAttribute(
          new Float32Array(clusters.length).fill(1),
          1,
        ),
      );
    return { far, medium };
  }, [distantNodes, mediumNodes, clusters.length]);
  useEffect(
    () => () => {
      layers.far.dispose();
      layers.medium.dispose();
    },
    [layers],
  );
  const opacity = useRef(new Map());
  useEffect(() => {
    opacity.current.clear();
  }, [clusters]);
  const occlusion = useMemo(
    () => ({
      geometry: new THREE.Box3()
        .union(nodes.Foliage.geometry.boundingBox)
        .union(mediumNodes.Foliage.geometry.boundingBox)
        .union(distantNodes.Foliage.geometry.boundingBox),
      box: new THREE.Box3(),
      world: new THREE.Matrix4(),
      actorBox: new THREE.Box3(),
      centre: new THREE.Vector3(),
      size: new THREE.Vector3(),
    }),
    [nodes, mediumNodes, distantNodes],
  );
  const geometryRadius = useMemo(
    () =>
      Math.max(
        ...[
          nodes.Foliage.geometry,
          mediumNodes.Foliage.geometry,
          distantNodes.Foliage.geometry,
        ].map((g) => {
          const b = g.boundingBox;
          return Math.hypot(
            Math.max(Math.abs(b.min.x), Math.abs(b.max.x)),
            Math.max(Math.abs(b.min.z), Math.abs(b.max.z)),
          );
        }),
      ),
    [nodes, mediumNodes, distantNodes],
  );
  const mediumMesh = useRef();
  const instanceClusters = useRef({ far: [], medium: [] });
  const mesh = useRef();
  const closeMesh = useRef();
  const nearbyId = useExplorer((s) => s.nearbyId);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        ...StyleShader,
        fog: true,
        uniforms: {
          cloudOpacity: { value: 1 },
          ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
          colorMap: {
            value: ["#F00511", "#B4040C", "#780208", "#500105"].map((color) =>
              new THREE.Color(color).convertLinearToSRGB(),
            ),
          },
          brightnessThresholds: { value: [0.9, 0.45, 0.001] },
          lightPosition: { value: new THREE.Vector3(15, 60, 15) },
        },
      }),
    [],
  );
  const closeMaterial = useMemo(() => material.clone(), [material]);
  useEffect(
    () => () => {
      material.dispose();
      closeMaterial.dispose();
    },
    [material, closeMaterial],
  );
  useFrame(({ clock, camera, scene }, delta) => {
    if (!mesh.current) return;
    const {
      telemetry: plane,
      expandedClusterId,
      cameraMode,
      viewDistance,
      worldScale,
      cloudSize,
    } = useExplorer.getState();
    const aircraft = scene.getObjectByName("player-aircraft");
    const eye = camera.position.toArray();
    if (aircraft) {
      aircraft.updateWorldMatrix(true, true);
      occlusion.actorBox.setFromObject(aircraft);
      occlusion.actorBox.getCenter(occlusion.centre);
      occlusion.actorBox
        .getSize(occlusion.size)
        .multiplyScalar(0.5)
        .addScalar(0.04);
    }
    const actor = aircraft
      ? occlusion.centre.toArray()
      : [plane.x * worldScale, plane.y, plane.z * worldScale];
    const halfSize = aircraft ? occlusion.size.toArray() : [1.1, 0.6, 1.1];
    const velocity = aircraft?.userData.flightVelocity ?? [0, 0, 0];
    const visibleCloud = (cluster, x, z, placement, matrix = dummy.matrix) => {
      occlusion.world.makeScale(worldScale, 1, worldScale).multiply(matrix);
      occlusion.box.copy(occlusion.geometry).applyMatrix4(occlusion.world);
      const bounds = {
        min: occlusion.box.min.toArray(),
        max: occlusion.box.max.toArray(),
      };
      const value =
        cameraMode === "flight"
          ? cloudVisibility(
              opacity.current.get(cluster.id) ?? 1,
              eye,
              actor,
              bounds,
              delta,
              velocity,
              halfSize,
            )
          : 1;
      opacity.current.set(cluster.id, value);
      return value;
    };
    let farCount = 0,
      mediumCount = 0;
    instanceClusters.current.far.length = 0;
    instanceClusters.current.medium.length = 0;
    // Rank by screen coverage so enlarged clouds retain their original detail,
    // while bounding the medium-detail budget for phones and older GPUs.
    const visibleClusters = clusters
      .map((cluster, index) => {
        if (cluster.id === expandedClusterId || cluster.id === nearbyId)
          return null;
        const [x, , z] =
          cameraMode === "flight"
            ? nearestWorldPosition([cluster.x, 0, cluster.z], plane)
            : [cluster.x, 0, cluster.z];
        const distance = Math.hypot(plane.x - x, plane.z - z);
        const placement = cloudPlacement(
          cluster,
          { cloudSize },
          geometryMinY,
          1,
        );
        if (
          cameraMode === "flight" &&
          distance >
            viewDistance + (geometryRadius * placement.scale) / worldScale
        )
          return null;
        const cameraDistance = Math.hypot(
          camera.position.x - x * worldScale,
          camera.position.y - placement.y,
          camera.position.z - z * worldScale,
        );
        const coverage =
          (geometryRadius *
            placement.scale *
            camera.projectionMatrix.elements[5]) /
          Math.max(1, cameraDistance);
        return { cluster, index, x, z, distance, placement, coverage };
      })
      .filter(Boolean)
      .sort((a, b) => b.coverage - a.coverage);
    for (const {
      cluster,
      index,
      x,
      z,
      distance,
      placement,
      coverage,
    } of visibleClusters) {
      const scale = placement.scale;
      dummy.position.set(x, placement.y, z);
      dummy.rotation.set(0, clock.elapsedTime * 0.035 + index, 0);
      dummy.scale.set(
        scale / worldScale,
        placement.verticalScale,
        scale / worldScale,
      );
      dummy.updateMatrix();
      const visibility = visibleCloud(cluster, x, z, placement);
      if (mediumCount < 12 && (coverage > 0.045 || distance < 16)) {
        layers.medium
          .getAttribute("cloudVisibility")
          .setX(mediumCount, visibility);
        mediumMesh.current.setMatrixAt(mediumCount++, dummy.matrix);
        instanceClusters.current.medium.push(cluster);
      } else {
        layers.far.getAttribute("cloudVisibility").setX(farCount, visibility);
        mesh.current.setMatrixAt(farCount++, dummy.matrix);
        instanceClusters.current.far.push(cluster);
      }
    }
    layers.far.getAttribute("cloudVisibility").needsUpdate = true;
    layers.medium.getAttribute("cloudVisibility").needsUpdate = true;
    mesh.current.count = farCount;
    mediumMesh.current.count = mediumCount;
    mesh.current.instanceMatrix.needsUpdate = true;
    mediumMesh.current.instanceMatrix.needsUpdate = true;
    const nearby = clusters.find((c) => c.id === nearbyId);
    if (closeMesh.current) {
      closeMesh.current.visible = !!nearby && nearby.id !== expandedClusterId;
      if (nearby) {
        const placement = cloudPlacement(
          nearby,
          { cloudSize },
          geometryMinY,
          1.15 + Math.sin(clock.elapsedTime * 0.6) * 0.04,
        );
        const scale = placement.scale;
        const [x, , z] =
          cameraMode === "flight"
            ? nearestWorldPosition([nearby.x, 0, nearby.z], plane)
            : [nearby.x, 0, nearby.z];
        closeMesh.current.position.set(x, placement.y, z);
        closeMesh.current.scale.set(
          scale / worldScale,
          placement.verticalScale,
          scale / worldScale,
        );
        closeMesh.current.rotation.y =
          clock.elapsedTime * 0.035 + clusters.indexOf(nearby);
        closeMesh.current.updateMatrix();
        closeMaterial.uniforms.cloudOpacity.value = visibleCloud(
          nearby,
          x,
          z,
          placement,
          closeMesh.current.matrix,
        );
      }
    }
  });
  return (
    <>
      <instancedMesh
        ref={mesh}
        name="original-explosion-clusters"
        key={clusters.length}
        args={[layers.far, material, clusters.length]}
        frustumCulled={false}
        onClick={(event) => {
          if (!isCloudHitVisible(event)) return;
          event.stopPropagation();
          const c = instanceClusters.current.far[event.instanceId];
          if (c) useExplorer.getState().openCluster(c.id);
        }}
      />
      <instancedMesh
        ref={mediumMesh}
        name="original-explosion-medium"
        key={`mid-${clusters.length}`}
        args={[layers.medium, material, clusters.length]}
        frustumCulled={false}
        onClick={(event) => {
          if (!isCloudHitVisible(event)) return;
          event.stopPropagation();
          const c = instanceClusters.current.medium[event.instanceId];
          if (c) useExplorer.getState().openCluster(c.id);
        }}
      />
      <mesh
        ref={closeMesh}
        name="original-nearby-explosion"
        geometry={nodes.Foliage.geometry}
        material={closeMaterial}
        onClick={(event) => {
          if (!isCloudHitVisible(event)) return;
          event.stopPropagation();
          if (nearbyId) useExplorer.getState().openCluster(nearbyId);
        }}
      />
    </>
  );
}
useGLTF.preload(
  `${import.meta.env.BASE_URL}trees.glb`,
  `${import.meta.env.BASE_URL}draco/`,
);
