import { useEffect, useRef } from "react";
import { OrbitControls } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import Map from "./World/Map";
import Player from "./Components/Player";
import { useExplorer } from "./stores/useExplorer";
export default function Experience() {
  const mode = useExplorer((s) => s.cameraMode),
    distance = useExplorer((s) => s.viewDistance);
  const worldScale = useExplorer((s) => s.worldScale);
  const camera = useThree((s) => s.camera),
    controls = useRef();
  useEffect(() => {
    camera.clearViewOffset();
    camera.fov = mode === "flight" ? 75 : 45;
    camera.far = 1400 * worldScale;
    camera.updateProjectionMatrix();
    if (mode === "overview") {
      const t = useExplorer.getState().telemetry;
      camera.position.set(
        t.x * worldScale,
        160 * worldScale,
        t.z * worldScale + 96 * worldScale,
      );
      camera.lookAt(t.x * worldScale, 0, t.z * worldScale);
      if (controls.current) {
        controls.current.target.set(t.x * worldScale, 0, t.z * worldScale);
        controls.current.update();
      }
    }
  }, [mode, camera, worldScale]);
  return (
    <>
      <color
        attach="background"
        args={[mode === "flight" ? "#1c1c1c" : "#000000"]}
      />
      {mode === "flight" && (
        <fog
          attach="fog"
          args={[
            "#1c1c1c",
            distance * worldScale * 0.35,
            distance * worldScale,
          ]}
        />
      )}
      <ambientLight intensity={1.8} />
      <directionalLight position={[35, 60, 25]} intensity={2.4} />
      {mode === "overview" && (
        <OrbitControls
          ref={controls}
          makeDefault
          minDistance={8}
          maxDistance={825 * worldScale}
          maxPolarAngle={Math.PI / 2.1}
        />
      )}
      <Map />
      <Player />
    </>
  );
}
