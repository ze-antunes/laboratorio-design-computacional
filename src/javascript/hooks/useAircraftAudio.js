import { useEffect, useState } from "react";
import { useExplorer } from "../stores/useExplorer";
import { aircraftEngine } from "../data/engineAudio";
export default function useAircraftAudio() {
  const enabled = useExplorer((s) => s.soundEnabled),
    volume = useExplorer((s) => s.soundVolume),
    telemetry = useExplorer((s) => s.telemetry),
    aircraft = useExplorer((s) => s.aircraft),
    paused = useExplorer((s) => s.paused),
    mode = useExplorer((s) => s.cameraMode);
  const [visible, setVisible] = useState(!document.hidden);
  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  useEffect(() => {
    let cancelled = false;
    const apply = () => {
      if (!cancelled)
        aircraftEngine.update({
          enabled,
          volume,
          ...telemetry,
          aircraft,
          active: visible && !paused && mode === "flight",
        });
    };
    if (enabled && !aircraftEngine.context) {
      useExplorer.getState().setSoundEnabled(false);
      return;
    }
    const context = aircraftEngine.context;
    if (
      enabled &&
      visible &&
      context &&
      context.state !== "running" &&
      context.state !== "closed"
    ) {
      context
        .resume()
        .then(apply)
        .catch(() => {
          if (!cancelled)
            useExplorer
              .getState()
              .setSoundError("Toca em Ativar som para retomar o motor.");
        });
    } else apply();
    return () => {
      cancelled = true;
    };
  }, [enabled, volume, telemetry, aircraft, paused, mode, visible]);
  useEffect(() => () => aircraftEngine.dispose(), []);
  return async () => {
    const state = useExplorer.getState();
    if (state.soundEnabled) {
      state.setSoundEnabled(false);
      return;
    }
    try {
      await aircraftEngine.enable();
      state.setSoundEnabled(true);
    } catch (error) {
      state.setSoundError(error.message);
    }
  };
}
