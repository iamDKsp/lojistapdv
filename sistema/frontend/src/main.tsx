import React from "react";
import ReactDOM from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { App } from "./App";
import "./app/globals.css";
import "./retail/retail.css";
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    void updateSW(true);
  },
});
if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") void updateSW();
});

// Bloqueio nativo de zoom (pinça / duplo-toque / atalhos) para comportamento 100% app no iOS e Android
if (typeof window !== "undefined" && typeof document !== "undefined") {
  const preventGestureZoom = (event: Event) => {
    event.preventDefault();
  };

  document.addEventListener("gesturestart", preventGestureZoom, {
    passive: false,
  });
  document.addEventListener("gesturechange", preventGestureZoom, {
    passive: false,
  });
  document.addEventListener("gestureend", preventGestureZoom, {
    passive: false,
  });

  document.addEventListener(
    "touchmove",
    (event: TouchEvent) => {
      if (event.touches.length > 1) {
        event.preventDefault();
      }
    },
    { passive: false },
  );

  let lastTouchEndAt = 0;
  document.addEventListener(
    "touchend",
    (event: TouchEvent) => {
      const now = Date.now();
      if (now - lastTouchEndAt <= 280 && event.touches.length === 0) {
        if (event.cancelable) {
          event.preventDefault();
        }
      }
      lastTouchEndAt = now;
    },
    { passive: false },
  );

  window.addEventListener(
    "wheel",
    (event: WheelEvent) => {
      if (event.ctrlKey) {
        event.preventDefault();
      }
    },
    { passive: false },
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
