import { useEffect } from "react";
import { Link } from "react-router-dom";
import { AccountMenu } from "../components/Chrome";
import "../cloud-restore.css";
import "../lib/mrl/cloud-restore.js";

export default function CloudRestorePage() {
  useEffect(() => {
    document.title = "Cloud AI Restore — Memory Lane";
    window.MRL = window.MRL || {};
    window.MRL.initCloudRestore();
  }, []);

  return (
    <div className="cloudrestore-page">
      <header style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap" }}>
        <h1>Memory Lane — Cloud AI Restore</h1>
        <Link to="/editor">Back to the offline editor</Link>
        <AccountMenu />
      </header>

      <main>
        <section className="card">
          <div className="upload-row">
            <label className="file-label">
              Choose a photo to restore
              <input type="file" id="file-input" accept="image/*" />
            </label>

            <select id="model-select" aria-label="AI model" defaultValue="codeformer">
              <option value="codeformer">CodeFormer — faces + background</option>
              <option value="gfpgan">GFPGAN — face specialist</option>
            </select>

            <label style={{ fontSize: 14 }}>
              Fidelity
              <input type="range" id="fidelity" min="0" max="100" defaultValue="70" aria-label="CodeFormer fidelity" />
              <span id="fidelity-value">0.70</span>
            </label>

            <button className="btn primary" id="btn-restore" disabled>Restore with AI</button>
          </div>

          <div className="status-row" id="status-row">
            <span className="spinner hidden" id="spinner"></span>
            <span id="status-text">Pick a photo to begin.</span>
          </div>

          <div className="compare">
            <figure>
              <figcaption>Before — your upload</figcaption>
              <img id="before-img" alt="Original photo" className="hidden" />
            </figure>
            <figure id="after-panel" className="hidden">
              <figcaption>After — AI restored</figcaption>
              <img id="after-img" alt="Restored photo" />
            </figure>
          </div>

          <div className="actions">
            <button className="btn" id="btn-download" disabled hidden>Download restored photo</button>
          </div>

          <p className="privacy-note">
            Note: this page sends your photo to Replicate's cloud (CodeFormer / GFPGAN models),
            so unlike the offline editor the photo leaves this device. The API token lives only
            in <code>server.js</code> on your computer — never in this page.
          </p>
        </section>
      </main>
    </div>
  );
}
