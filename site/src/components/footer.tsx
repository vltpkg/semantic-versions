import { VltMark } from "@/components/icons";
import { REPO, SPEC_VERSION } from "@/lib/site";

export function Footer() {
  return (
    <footer className="footer">
      <div className="wrap footer-inner">
        <a className="footer-brand" href="https://www.vlt.io" target="_blank" rel="noopener">
          <VltMark />
          <span>A specification stewarded by vlt</span>
        </a>
        <span className="footer-meta">
          <span className="footer-ver">Semantic Versions {SPEC_VERSION}</span>
          <a className="footer-link" href="/license/">
            License: CC BY 3.0
          </a>
          <a className="footer-link" href="/agents/">
            For agents
          </a>
          <a className="footer-link" href={REPO} target="_blank" rel="noopener">
            GitHub
          </a>
        </span>
      </div>
    </footer>
  );
}
