import { useEffect, useRef } from "react";

// Measure the actual interface instead of assuming fixed translated text sizes.
export default function useResponsiveLayout() {
  const root = useRef(null),
    header = useRef(null),
    dock = useRef(null);
  useEffect(() => {
    const update = () => {
      const node = root.current;
      if (!node) return;
      node.style.setProperty(
        "--header-h",
        `${Math.ceil(header.current?.getBoundingClientRect().height || 0)}px`,
      );
      node.style.setProperty(
        "--dock-h",
        `${Math.ceil(dock.current?.getBoundingClientRect().height || 0)}px`,
      );
    };
    const observer = new ResizeObserver(update);
    if (header.current) observer.observe(header.current);
    if (dock.current) observer.observe(dock.current);
    const viewport = () => {
      const visual = window.visualViewport;
      const height =
        visual && visual.scale === 1 ? visual.height : window.innerHeight;
      document.documentElement.style.setProperty("--app-height", `${height}px`);
      update();
    };
    window.addEventListener("resize", viewport);
    window.visualViewport?.addEventListener("resize", viewport);
    viewport();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", viewport);
      window.visualViewport?.removeEventListener("resize", viewport);
      document.documentElement.style.removeProperty("--app-height");
    };
  }, []);
  return { root, header, dock };
}
