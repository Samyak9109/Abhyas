// FR-N/A, NFR-015, ADR-016: App shell baseline for Phase 0 foundations.
import { getContentInfo } from "@abhyas/content";
import { getCoreInfo } from "@abhyas/core";

export function App() {
  const core = getCoreInfo();
  const content = getContentInfo();

  return (
    <main>
      <h1>Abhyas</h1>
      <p>
        Domain core: {core.name} (v{core.version})
      </p>
      <p>
        Content: {content.name} (v{content.version})
      </p>
    </main>
  );
}
