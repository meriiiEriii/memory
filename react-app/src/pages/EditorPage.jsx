import { useEffect, useLayoutEffect } from "react";
import { Link } from "react-router-dom";
import { AccountMenu } from "../components/Chrome";
// Import for side effects: each module registers itself on window.MRL
import "../lib/mrl/sample.js";
import "../lib/mrl/colorize.js";
import "../lib/mrl/bgremove.js";
import "../lib/mrl/deblur.js";
import "../lib/mrl/adjust.js";
import "../lib/mrl/inpaint.js";
import "../lib/mrl/history.js";
import "../lib/mrl/editor.js";

export default function EditorPage() {
  useLayoutEffect(() => {
    document.title = "Restoration Studio — Memory Lane";
    document.body.classList.add("editor-page");
    return () => document.body.classList.remove("editor-page");
  }, []);

  useEffect(() => {
    window.MRL = window.MRL || {};
    window.MRL.initEditor();
  }, []);

  return (
    <>
      <header className="topbar">
        <Link className="brand" to="/">
          <span className="brand-mark">
            <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
          </span>
          Memory Lane
        </Link>
        <div className="mode-tabs" role="tablist" aria-label="Editing mode">
          <button className="mode-tab active" data-mode="restore" role="tab" aria-selected="true">
            <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 8h9M19 8h1M4 16h3M13 16h7"/><circle cx="16" cy="8" r="2.5"/><circle cx="10" cy="16" r="2.5"/></svg>
            <span className="lbl">Restore</span>
          </button>
          <button className="mode-tab" data-mode="remove" role="tab" aria-selected="false">
            <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 20H9l-5-5a1.6 1.6 0 0 1 0-2.2l8-8a1.6 1.6 0 0 1 2.2 0l6 6a1.6 1.6 0 0 1 0 2.2L14 19"/><path d="M6.5 10.5l7 7"/></svg>
            <span className="lbl">Remove</span>
          </button>
        </div>
        <div className="topbar-spacer"></div>
        <div className="top-actions">
          <button id="btn-compare" className="icon-btn" title="Split the photo against the original" aria-label="Compare with the original" aria-pressed="true">
            <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v18M5 7l-3 5 3 5M19 7l3 5-3 5"/></svg>
            <span className="lbl">Compare</span>
          </button>
          <button id="btn-new-photo" className="icon-btn" title="Attach another photo" aria-label="Attach another photo">
            <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M3 17l4-3 3 2 6-5 5 4"/><path d="M18 3v6M15 6h6"/></svg>
            <span className="lbl">New photo</span>
          </button>
          <button id="btn-undo" className="icon-btn" title="Undo (Ctrl+Z)" aria-label="Undo" disabled>
            <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>
            <span className="lbl">Undo</span>
          </button>
          <button id="btn-redo" className="icon-btn" title="Redo (Ctrl+Y)" aria-label="Redo" disabled>
            <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 14l5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/></svg>
            <span className="lbl">Redo</span>
          </button>
          <button id="btn-reset" className="icon-btn" title="Start over with the original photo" aria-label="Reset to original">
            <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 3v5h5"/><path d="M21 12a9 9 0 1 1-2.64-6.36L21 8"/></svg>
            <span className="lbl">Reset</span>
          </button>
          <button id="btn-download" className="icon-btn primary" title="Download the restored photo" aria-label="Download restored photo" disabled>
            <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v12M7 11l5 5 5-5M4 20h16"/></svg>
            <span className="lbl">Download</span>
          </button>
        </div>
        <AccountMenu />
      </header>

      <div className="workspace">
        <div className="work-main">
          <aside className="sidebar" id="sidebar">
            <button className="sidebar-toggle" id="sidebar-toggle" aria-expanded="true">
              <span>Tools</span>
              <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
            </button>

<section className="panel active" id="panel-restore" aria-label="Restore tools">
              <div className="side-group quick-group">
                <h4>Quick repair</h4>
                <button id="btn-deblur-restore" className="btn btn-neutral btn-block" disabled title="Estimates the blur, then reverses it with Richardson-Lucy deconvolution and finishes with a detail pass">
                  <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15v4M21 17h-4"/><circle cx="12" cy="12" r="3"/></svg>
                  Auto-Fix blurry photo
                </button>
                <span className="or-divider">OR</span>
                <button id="btn-colorize" className="icon-btn block" aria-pressed="false" disabled title="Sets colorize, detail and deblur to 100 for a black-and-white photo">
                  <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15v4M21 17h-4"/></svg>
                  Restore black & white photo
                </button>
              </div>
              <div className="side-group" id="recovery-group">
                <h4>Photo recovery</h4>
                <div className="detect-chips" id="detect-chips"></div>
                <div className="slider-row">
                  <div className="slider-label"><span>Colorize strength</span><span className="slider-value" id="colorize-value">0</span></div>
                  <input type="range" id="colorize-range" min="0" max="100" defaultValue="0" aria-label="Colorize strength" />
                </div>
                <div className="slider-row">
                  <div className="slider-label"><span>Deblur</span><span className="slider-value" id="deblur-value">0</span></div>
                  <input type="range" id="deblur-range" min="0" max="100" defaultValue="0" aria-label="Deblur amount" />
                </div>
                <div className="slider-row">
                  <div className="slider-label"><span>Detail</span><span className="slider-value" id="detail-value">0</span></div>
                  <input type="range" id="detail-range" min="0" max="100" defaultValue="0" aria-label="Detail recovery" />
                </div>
                <div className="segmented three style-segments" id="style-segments" hidden>
                  <button className="icon-btn style-btn active" data-style="natural" aria-pressed="true" title="Natural colours">Natural</button>
                  <button className="icon-btn style-btn" data-style="warm" aria-pressed="false" title="Warm sepia colours">Warm</button>
                  <button className="icon-btn style-btn" data-style="vivid" aria-pressed="false" title="Vivid colours">Vivid</button>
                </div>
              </div>
              <div className="side-group">
                <h4>Tone</h4>
                <div id="tone-sliders"></div>
              </div>
              <div className="side-group">
                <h4>Detail cleanup</h4>
                <div className="slider-row">
                  <div className="slider-label"><span>Noise reduction</span><span className="slider-value" id="noise-value">0</span></div>
                  <input type="range" id="noise-range" min="0" max="100" defaultValue="0" aria-label="Noise reduction" />
                </div>
                <div className="slider-row">
                  <div className="slider-label"><span>Sharpen</span><span className="slider-value" id="sharpen-value">0</span></div>
                  <input type="range" id="sharpen-range" min="0" max="100" defaultValue="0" aria-label="Sharpen" />
                </div>
              </div>
              <div className="side-group">
                <button id="btn-adjust-reset" className="icon-btn block">
                  <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 3v5h5"/><path d="M21 12a9 9 0 1 1-2.64-6.36L21 8"/></svg>
                  Reset adjustments
                </button>
              </div>
            </section>

            <section className="panel" id="panel-remove" aria-label="Removal tools">
              <div className="side-group">
                <h4>Remove object</h4>
                <div className="segmented three">
                  <button className="icon-btn tool-btn active" data-tool="brush" aria-pressed="true" title="Brush">
                    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/></svg>
                    Brush
                  </button>
                  <button className="icon-btn tool-btn" data-tool="wand" aria-pressed="false" title="Magic wand">
                    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 21l9.5-9.5"/><path d="M14.5 4.5l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5L11 8l2.5-1z"/></svg>
                    Wand
                  </button>
                  <button className="icon-btn tool-btn" data-tool="restore" aria-pressed="false" title="Restore brush">
                    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 3v5h5"/><path d="M21 12a9 9 0 1 1-2.64-6.36L21 8"/></svg>
                    Restore
                  </button>
                </div>
                <div className="brush-size-preview">
                  <span className="brush-dot" id="brush-dot" style={{ width: 20, height: 20 }}></span>
                  <div className="slider-row" style={{ flex: 1, marginBottom: 0 }}>
                    <div className="slider-label"><span>Size</span><span className="slider-value" id="brush-size-value">36</span></div>
                    <input type="range" id="brush-size-range" className="range-rust" min="6" max="140" defaultValue="36" aria-label="Brush size" />
                  </div>
                </div>
                <button id="btn-fill-sel" className="btn btn-rust btn-sm btn-block" disabled>
                  <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 20H9l-5-5a1.6 1.6 0 0 1 0-2.2l8-8a1.6 1.6 0 0 1 2.2 0l6 6a1.6 1.6 0 0 1 0 2.2L14 19"/><path d="M6.5 10.5l7 7"/></svg>
                  Erase
                </button>
                <button id="btn-clear-sel" className="icon-btn block" disabled>
                  <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M10 4h4M6 7l1 13h10l1-13"/></svg>
                  Clear selection
                </button>
              </div>

              <div className="side-group remove-bg-group">
                <h4>Remove background</h4>
                <div className="segmented two bg-fill-seg">
                  <button className="icon-btn bg-fill-btn active" data-fill="transparent" aria-pressed="true" title="Erase the background to transparency">Transparent</button>
                  <button className="icon-btn bg-fill-btn" data-fill="white" aria-pressed="false" title="Replace the background with pure white">White</button>
                </div>
                <button id="btn-remove-bg" className="icon-btn block" disabled title="Makes everything connected to the photo edges transparent">
                  <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12"/></svg>
                  Remove background
                </button>
                <button id="btn-bg-erase" className="icon-btn block" disabled title="Erases the current selection straight to transparency">
                  <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 20H9l-5-5a1.6 1.6 0 0 1 0-2.2l8-8a1.6 1.6 0 0 1 2.2 0l6 6a1.6 1.6 0 0 1 0 2.2L14 19"/><path d="M6.5 10.5l7 7"/></svg>
                  Erase
                </button>
                <div className="brush-size-preview">
                  <span className="brush-dot" id="bg-brush-dot" style={{ width: 20, height: 20 }}></span>
                  <div className="slider-row" style={{ flex: 1, marginBottom: 0 }}>
                    <div className="slider-label"><span>Size</span><span className="slider-value" id="bg-brush-size-value">36</span></div>
                    <input type="range" id="bg-brush-size-range" className="range-rust" min="6" max="140" defaultValue="36" aria-label="Background brush size" />
                  </div>
                </div>
                <div className="segmented">
                  <button className="icon-btn btool-btn" data-btool="brush" aria-pressed="false" disabled title="Erases everything you paint straight to transparency">
                    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/></svg>
                    Brush
                  </button>
                  <button className="icon-btn btool-btn" data-btool="wand" aria-pressed="false" disabled title="Click the backdrop to erase connected similar colours to transparency">
                    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 21l9.5-9.5"/><path d="M14.5 4.5l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5L11 8l2.5-1z"/></svg>
                    Wand
                  </button>
                </div>
              </div>
            </section>
          </aside>

          <div className="stage-wrap" id="stage-wrap">
            <div className="stage hidden" id="stage" style={{ "--split": "50%" }}>
              <canvas id="main-canvas" className="main-canvas"></canvas>
              <div className="compare-wrap" id="compare-wrap" aria-hidden="true">
                <canvas id="original-canvas" className="original-canvas"></canvas>
              </div>
              <canvas id="brush-layer" className="brush-layer" aria-hidden="true"></canvas>
              <span className="stage-chip chip-original">Original</span>
              <span className="stage-chip chip-restored">Restored</span>
              <div className="compare-divider" id="compare-divider" role="slider" tabIndex={0}
                   aria-label="Compare the original photo with the restored one"
                   aria-valuemin={0} aria-valuemax={100} aria-valuenow={50} aria-valuetext="50 percent original">
                <span className="compare-grip">
                  <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 8l-4 4 4 4M16 8l4 4-4 4M4 12h16"/></svg>
                </span>
              </div>
            </div>
            <div className="empty-state" id="empty-state">
              <div className="drop-zone" id="drop-zone">
                <svg className="icon-lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 44, height: 44, marginInline: "auto", color: "var(--sepia)" }}><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M3 17l4-3 3 2 6-5 5 4"/></svg>
                <h2>Restore a photo</h2>
                <p>Drop an old family photo here, or pick one from your device. Nothing is uploaded — every edit happens on this device.</p>
                <div className="empty-actions">
                  <button id="btn-upload" className="btn">
                    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5M4 20h16"/></svg>
                    Upload photo
                  </button>
                </div>
              </div>
            </div>
            <button id="btn-peek" className="stage-peek hidden" title="Hold to see the original" aria-label="Hold to see the original photo">
              <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>

            <div className="brush-cursor" id="brush-cursor" aria-hidden="true"></div>
            <div className="loader-overlay" id="loader" aria-hidden="true">
              <div className="loader-card"><div className="spinner"></div><span id="loader-text">Working</span></div>
            </div>
          </div>
        </div>

        <footer className="status-bar">
          <span className="status-file" id="status-file">No photo</span>
          <span id="status-dims"></span>
          <span id="status-hint">Drop a photo to begin</span>
          <span className="detect-chips" id="status-detect"></span>
          <span className="alpha-badge" id="status-alpha" hidden>Transparent background</span>
          <span className="privacy" style={{ marginLeft: "auto" }} title="Your photo is processed in this browser and is not uploaded"><span className="dot"></span>Photos stay on this device</span>
        </footer>
      </div>

      <input type="file" id="file-input" accept="image/*" hidden />
      <div className="toast" id="toast" role="status" aria-live="polite"></div>
    </>
  );
}
