/*
 * Abhyas preloader controller.
 *
 * - Completes one full cycle of the brand animation (pixel assembly + amber crossbar +
 *   wordmark typing, ~1650ms) so the animation is never cut off abruptly.
 * - If the page is still loading assets, it continues animating until the app signals ready.
 * - When ready, it transitions via an unhurried, smooth center-outward vertical shutter
 *   sweep with glowing amber scanlines into the main application.
 */
(() => {
  const root = document.documentElement;
  let el = document.getElementById("abhyas-preloader");
  if (!el) return;

  // Duration for pixels pop-in + crossbar sweep + wordmark typing to complete one full cycle
  const ONE_CYCLE_MS = 1650;
  const shownAt = performance.now();
  let leaving = false;

  root.classList.add("ap-lock");
  if (document.body) {
    document.body.setAttribute("aria-busy", "true");
  }

  function teardown() {
    if (el && el.parentNode) {
      el.parentNode.removeChild(el);
    }
    el = null;
    root.classList.remove("ap-lock");
    if (document.body) {
      document.body.removeAttribute("aria-busy");
    }
    window.dispatchEvent(new CustomEvent("abhyas:ready"));
  }

  function startShutterTransition() {
    if (!el || leaving) return;
    leaving = true;

    // Respect user's reduced-motion preference
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      teardown();
      return;
    }

    try {
      const numCols = window.innerWidth <= 600 ? 8 : 10;
      const curtain = document.createElement("div");
      curtain.className = "ap-shutter-curtain";

      const center = (numCols - 1) / 2;
      const frag = document.createDocumentFragment();

      for (let i = 0; i < numCols; i++) {
        const col = document.createElement("div");
        col.className = "ap-shutter-col";
        // Distance from center determines delay: center columns part first, sweeping out gracefully
        const distFromCenter = Math.abs(i - center);
        const delay = Math.round(distFromCenter * 85);
        col.style.setProperty("--d", `${delay}ms`);
        frag.appendChild(col);
      }
      curtain.appendChild(frag);
      el.appendChild(curtain);

      requestAnimationFrame(() => {
        if (!el) return;
        el.classList.add("ap-leaving");
      });

      // Teardown after columns complete their slow, graceful sweep:
      // Max delay: 4.5 * 85ms ~= 380ms + 1100ms column duration + 120ms buffer = ~1600ms
      setTimeout(teardown, 1600);
    } catch {
      teardown();
    }
  }

  function hide() {
    const elapsed = performance.now() - shownAt;
    // Let the animation complete one full cycle naturally before transitioning
    const remaining = Math.max(0, ONE_CYCLE_MS - elapsed);
    setTimeout(startShutterTransition, remaining);
  }

  function show() {
    // Keep no-op to prevent unwanted re-showing during normal in-app client navigation
  }

  window.AbhyasPreloader = { hide, show };

  // Failsafe in case a script or asset is hung
  setTimeout(() => {
    if (!leaving) hide();
  }, 4500);
})();
