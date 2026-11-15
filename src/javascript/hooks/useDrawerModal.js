import { useEffect } from "react";
export default function useDrawerModal(drawer, close) {
  useEffect(() => {
    if (!drawer) return;
    const previous = document.activeElement;
    const background = [
      ...document.querySelectorAll(
        ".project-header,.exploration-dock,.flight-compass,.current-year",
      ),
    ];
    background.forEach((node) => {
      node.inert = true;
    });
    const frame = requestAnimationFrame(() => {
      const panel = document.querySelector(".reading-drawer,.drawer");
      (panel?.querySelector('[aria-label^="Fechar"]') || panel)?.focus({
        preventScroll: true,
      });
    });
    const key = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close(null);
        return;
      }
      if (event.key !== "Tab") return;
      const panel = document.querySelector(".reading-drawer,.drawer");
      if (!panel) return;
      const items = [
        ...panel.querySelectorAll(
          'button:not(:disabled),input:not(:disabled),select:not(:disabled),summary,a[href],[tabindex="0"]',
        ),
      ].filter((item) => item.offsetParent !== null);
      if (!items.length) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = items[0],
        last = items.at(-1),
        active = document.activeElement;
      if (!panel.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", key, true);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", key, true);
      background.forEach((node) => {
        node.inert = false;
      });
      const fallback = [
        ...document.querySelectorAll(
          ".mobile-menu-toggle,.project-header button",
        ),
      ].find((node) => node.offsetParent !== null);
      const target =
        previous?.isConnected && previous.offsetParent !== null
          ? previous
          : fallback;
      target?.focus({ preventScroll: true });
    };
  }, [drawer, close]);
}
