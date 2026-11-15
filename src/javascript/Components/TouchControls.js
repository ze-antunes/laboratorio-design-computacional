import { useEffect, useRef, useState } from "react";
import { useExplorer } from "../stores/useExplorer";

function Throttle({ action, label, children }) {
  const [held, setHeld] = useState(false);
  const end = () => {
    useExplorer.getState().press(action, false);
    setHeld(false);
  };
  return (
    <button
      className={held ? "is-held" : ""}
      aria-label={label}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        useExplorer.getState().cancelRoute();
        useExplorer.getState().press(action, true);
        setHeld(true);
      }}
      onKeyDown={(e) => {
        if ([" ", "Enter"].includes(e.key)) {
          e.preventDefault();
          if (!e.repeat) {
            useExplorer.getState().cancelRoute();
            useExplorer.getState().press(action, true);
            setHeld(true);
          }
        }
      }}
      onKeyUp={(e) => {
        if ([" ", "Enter"].includes(e.key)) {
          e.preventDefault();
          end();
        }
      }}
      onBlur={end}
      onPointerUp={end}
      onPointerCancel={end}
      onLostPointerCapture={end}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </button>
  );
}
export default function TouchControls({ suspended = false }) {
  const [enabled, setEnabled] = useState(true),
    [stick, setStick] = useState({ x: 0, y: 0 });
  const pointer = useRef(null);
  const drawer = useExplorer((s) => s.drawer),
    mode = useExplorer((s) => s.cameraMode),
    navigation = useExplorer((s) => s.navigationMode);
  const visible =
    enabled &&
    !suspended &&
    !drawer &&
    mode === "flight" &&
    navigation === "free";
  const reset = () => {
    pointer.current = null;
    setStick({ x: 0, y: 0 });
    useExplorer.getState().setTouchAxes(0, 0);
  };
  useEffect(() => {
    if (!visible) reset();
    const clear = () => {
      reset();
      useExplorer.getState().release();
    };
    const hidden = () => {
      if (document.hidden) clear();
    };
    window.addEventListener("blur", clear);
    window.addEventListener("orientationchange", clear);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("blur", clear);
      window.removeEventListener("orientationchange", clear);
      document.removeEventListener("visibilitychange", hidden);
      useExplorer.getState().release();
    };
  }, [visible]);
  const move = (e) => {
    if (pointer.current !== e.pointerId) return;
    const b = e.currentTarget.getBoundingClientRect(),
      radius = b.width * 0.35;
    let x = (e.clientX - b.left - b.width / 2) / radius,
      y = (e.clientY - b.top - b.height / 2) / radius;
    const length = Math.hypot(x, y);
    if (length > 1) {
      x /= length;
      y /= length;
    }
    setStick({ x, y });
    const axis = (v) =>
      Math.abs(v) < 0.14 ? 0 : (Math.sign(v) * (Math.abs(v) - 0.14)) / 0.86;
    useExplorer.getState().setTouchAxes(axis(x), -axis(y));
  };
  if (drawer || suspended || mode !== "flight" || navigation !== "free")
    return null;
  return (
    <div className="touch-flight-ui">
      <button
        className="touch-controls-toggle"
        aria-expanded={visible}
        aria-controls="touch-flight-controls"
        onClick={() => {
          setEnabled(!enabled);
          reset();
        }}
      >
        {enabled ? "Ocultar comandos" : "Comandos de voo"}
      </button>
      {visible && (
        <div
          id="touch-flight-controls"
          className="touch-flight-controls"
          aria-label="Comandos de voo por toque"
        >
          <div
            className="flight-stick"
            role="group"
            aria-label="Comando de voo: arrasta para virar; para cima sobe, para baixo desce"
            onContextMenu={(e) => e.preventDefault()}
            onPointerDown={(e) => {
              if (pointer.current !== null) return;
              e.preventDefault();
              pointer.current = e.pointerId;
              e.currentTarget.setPointerCapture(e.pointerId);
              useExplorer.getState().cancelRoute();
              move(e);
            }}
            onPointerMove={move}
            onPointerUp={(e) => {
              if (pointer.current === e.pointerId) reset();
            }}
            onPointerCancel={(e) => {
              if (pointer.current === e.pointerId) reset();
            }}
            onLostPointerCapture={(e) => {
              if (pointer.current === e.pointerId) reset();
            }}
          >
            <span className="stick-up">SUBIR</span>
            <span className="stick-down">DESCER</span>
            <span
              className="stick-thumb"
              style={{
                transform: `translate(calc(-50% + ${stick.x * 34}px),calc(-50% + ${stick.y * 34}px))`,
              }}
            />
          </div>
          <div
            className="touch-throttle"
            role="group"
            aria-label="Velocidade do avião"
          >
            <Throttle action="accelerate" label="Manter para acelerar">
              +<small>VELOCIDADE</small>
            </Throttle>
            <Throttle action="decelerate" label="Manter para desacelerar">
              −<small>VELOCIDADE</small>
            </Throttle>
          </div>
        </div>
      )}
    </div>
  );
}
