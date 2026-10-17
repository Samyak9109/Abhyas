// FR-031: PWA Service Worker registration, update listener, and cache bust flow.

interface PwaRegistrationOptions {
  onUpdateAvailable?: (reload: () => void) => void;
}

/**
 * Registers the offline service worker and listens for background updates.
 * When a new service worker enters the 'waiting' state, triggers onUpdateAvailable
 * with a callback that activates the update and reloads the window cleanly.
 */
export function registerPwa(options: PwaRegistrationOptions = {}): void {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }

  // Only register in browser environment
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        // If an update is already waiting to activate
        if (registration.waiting) {
          notifyUpdate(registration.waiting, options.onUpdateAvailable);
          return;
        }

        // Listen for new updates discovered in the background
        registration.addEventListener("updatefound", () => {
          const installingWorker = registration.installing;
          if (!installingWorker) return;

          installingWorker.addEventListener("statechange", () => {
            if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
              notifyUpdate(installingWorker, options.onUpdateAvailable);
            }
          });
        });
      })
      .catch((err) => {
        console.warn("Service worker registration failed:", err);
      });

    // Ensure page reload on controller change after skipWaiting
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  });
}

function notifyUpdate(waitingWorker: ServiceWorker, callback?: (reload: () => void) => void) {
  if (!callback) return;

  const reload = () => {
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
  };

  callback(reload);
}
