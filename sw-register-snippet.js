// Register Service Worker with a versioned URL so updates always take
(function() {
  if (!('serviceWorker' in navigator)) return;
  const SW_VERSION = "tr-2025-09-09-01"; // bump this each deploy
  const SW_URL = `sw.js?v=${SW_VERSION}`;

  navigator.serviceWorker.register(SW_URL).then((reg) => {
    if (reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });

    reg.addEventListener("updatefound", () => {
      const newSW = reg.installing;
      if (!newSW) return;
      newSW.addEventListener("statechange", () => {
        if (newSW.state === "installed" && navigator.serviceWorker.controller) {
          newSW.postMessage({ type: "SKIP_WAITING" });
        }
      });
    });
  });

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    window.location.reload();
  });
})();
