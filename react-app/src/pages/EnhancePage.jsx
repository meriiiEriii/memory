import { useEffect } from "react";
import { Link } from "react-router-dom";
import { AccountMenu } from "../components/Chrome";
import "../enhance.css";
import "../lib/mrl/enhance.js";

export default function EnhancePage() {
  useEffect(() => {
    document.title = "AI Enhance — Memory Lane";
    window.MRL = window.MRL || {};
    window.MRL.initEnhance();
  }, []);

  return (
    <div className="enhance-page">
      <header>
        <h1>Memory Lane — AI Enhance</h1>
        <Link to="/">Back to home</Link>
        <Link to="/editor">Offline editor</Link>
        <AccountMenu />
      </header>

      <main>
        <section className="card">
          <div className="drop-zone" id="drop-zone">
            <h2>Drop an old photo here</h2>
            <p>…or click to browse. Blurry portraits, faded black &amp; white prints — AI rebuilds the detail.</p>
            <input type="file" id="file-input" accept="image/*" />
          </div>

          <div className="mode-group" role="radiogroup" aria-label="Enhancement mode">
            <label className="mode-card active">
              <input type="radio" name="enhance-mode" value="face" defaultChecked />
              <span>
                <b>Unblur &amp; Restore Face</b>
                <span>CodeFormer rebuilds eyes, skin and soft focus.</span>
              </span>
            </label>
            <label className="mode-card">
              <input type="radio" name="enhance-mode" value="color" />
              <span>
                <b>Colorize Old B&amp;W Photo</b>
                <span>DDColor paints plausible colour onto monochrome prints.</span>
              </span>
            </label>
            <label className="mode-card">
              <input type="radio" name="enhance-mode" value="both" />
              <span>
                <b>Unblur + Colorize Both</b>
                <span>Restores the face first, then colorizes the result.</span>
              </span>
            </label>
          </div>

          <div className="fidelity-row" id="fidelity-row">
            <label>Fidelity
              <input type="range" id="fidelity" min="0" max="100" defaultValue="70" aria-label="CodeFormer fidelity" />
              <span id="fidelity-value">0.70</span>
            </label>
          </div>

          <div className="actions-row">
            <button className="btn primary" id="btn-enhance" disabled>Enhance Photo</button>
            <button className="btn" id="btn-download" disabled hidden>Download enhanced photo</button>
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
              <figcaption>After — AI enhanced</figcaption>
              <img id="after-img" alt="Enhanced photo" />
            </figure>
          </div>

          <p className="privacy-note">
            This page sends your photo to Replicate's cloud AI (CodeFormer / DDColor) for processing,
            so unlike the offline editor the photo leaves this device. When used through
            <code> server.js</code>, the API token stays on your computer.
          </p>
        </section>
      </main>
    </div>
  );
}
