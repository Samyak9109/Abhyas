/*
 * Abhyas preloader controller.
 *
 * Default: auto-hides on window "load". For SPAs, add `data-manual` to the
 * #abhyas-preloader element and call AbhyasPreloader.hide() once the app has
 * mounted and its first data is ready, because "load" fires before client
 * rendering finishes and would reveal an empty shell.
 */
(() => {
  const MIN_VISIBLE_MS = 900;   // avoids a distracting flash on fast connections
  const MAX_VISIBLE_MS = 10000; // failsafe so a hung asset can never trap the user
  const EXIT_FALLBACK_MS = 600; // covers environments where animationend never fires

  const root = document.documentElement;
  let el = document.getElementById('abhyas-preloader');
  if (!el) return;

  // Keep a pristine copy so show() can replay the intro from frame zero.
  const template = el.cloneNode(true);
  const manual = el.hasAttribute('data-manual');
  let shownAt = performance.now();
  let leaving = false;

  root.classList.add('ap-lock');
  document.body && document.body.setAttribute('aria-busy', 'true');

  function teardown() {
    if (el && el.parentNode) el.parentNode.removeChild(el);
    el = null;
    root.classList.remove('ap-lock');
    document.body.removeAttribute('aria-busy');
    window.dispatchEvent(new CustomEvent('abhyas:ready'));
  }

  function hide() {
    if (!el || leaving) return;
    leaving = true;
    const wait = Math.max(0, MIN_VISIBLE_MS - (performance.now() - shownAt));
    setTimeout(() => {
      if (!el) return;
      el.classList.add('ap-leaving');
      el.addEventListener('animationend', teardown, { once: true });
      setTimeout(() => el && teardown(), EXIT_FALLBACK_MS);
    }, wait);
  }

  function show() {
    if (el) return;
    el = template.cloneNode(true);
    document.body.insertBefore(el, document.body.firstChild);
    root.classList.add('ap-lock');
    document.body.setAttribute('aria-busy', 'true');
    shownAt = performance.now();
    leaving = false;
  }

  window.AbhyasPreloader = { hide, show };

  if (!manual) {
    if (document.readyState === 'complete') hide();
    else window.addEventListener('load', hide, { once: true });
  }
  setTimeout(hide, MAX_VISIBLE_MS);
})();
