// Pages rejects a `_redirects` rewrite of /app/* to /app/index.html with an
// infinite-loop guard (it strips the /index suffix, re-matching /app/*), so
// client routes are served the app shell here. Public pages and assets fall
// through to static hosting untouched (ADR-019).
const SHELL = "/app/";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const isAppRoute = url.pathname === "/app" || url.pathname.startsWith("/app/");
    const isRead = request.method === "GET" || request.method === "HEAD";

    if (isAppRoute && isRead) {
      const shell = new URL(SHELL, url);
      shell.search = url.search;
      return env.ASSETS.fetch(new Request(shell, request));
    }

    return env.ASSETS.fetch(request);
  },
};
