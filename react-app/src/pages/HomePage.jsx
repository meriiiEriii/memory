import { useEffect } from "react";
import { Link } from "react-router-dom";
import { HomeNav, SiteFooter } from "../components/Chrome";
// Import for side effects: each module registers itself on window.MRL
import "../lib/mrl/sample.js";
import "../lib/mrl/colorize.js";
import "../lib/mrl/deblur.js";
import "../lib/mrl/adjust.js";
import "../lib/mrl/main.js";

export default function HomePage() {
  useEffect(() => {
    document.title = "Memory Lane — Old Photo Restorer";
    window.MRL = window.MRL || {};
    window.MRL.initHome();
  }, []);

  return (
    <>
      <HomeNav />
      <main>
        <section className="hero">
          <div className="container">
            <div>
              <span className="eyebrow">
                <svg className="icon" style={{ width: 15, height: 15 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15v4M21 17h-4"/></svg>
                Free · Runs in your browser
              </span>
              <h1>Bring faded family memories <em>back to life</em>.</h1>
              <p className="hero-sub">Memory Lane colourises black &amp; white prints, sharpens soft, blurry photos and sweeps away scratches, stains and photobombers. Sign in with a free account — and your pictures never leave your device.</p>
              <div className="hero-actions">
                <Link className="btn" to="/editor">
                  <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 21l9.5-9.5"/><path d="M14.5 4.5l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5L11 8l2.5-1z"/></svg>
                  Open the Studio
                </Link>
                <a className="btn btn-ghost" href="#demo">
                  <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>
                  Try the demo
                </a>
              </div>
              <p className="hero-trust">
                <svg className="icon" style={{ width: 16, height: 16 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l7 3v5c0 4.5-3 7.6-7 10-4-2.4-7-5.5-7-10V6z"/></svg>
                Nothing is uploaded — restoration happens on your device.
              </p>
            </div>
            <div className="hero-visual" aria-hidden="true">
              <div className="polaroid polaroid-back"></div>
              <div className="polaroid polaroid-main">
                <span className="tape"></span>
                <canvas id="hero-photo"></canvas>
              </div>
            </div>
          </div>
        </section>

        <section className="demo-section" id="demo">
          <div className="container">
            <div className="section-head reveal">
              <h2>Drag the handle. Watch it heal.</h2>
              <p>This sample is restored live in your browser by the very same pipeline the studio uses — faded tones lifted, contrast rebalanced and detail coaxed back out of the haze. Drag slowly to see the difference.</p>
            </div>
            <div className="demo-frame reveal">
              <div className="demo-stage" id="demo-stage" style={{ "--split": "50%" }}>
                <canvas id="demo-after"></canvas>
                <canvas id="demo-before" className="demo-before"></canvas>
                <span className="demo-chip original">Original</span>
                <span className="demo-chip restored">Restored</span>
                <div className="drag-line" aria-hidden="true"></div>
                <div className="drag-knob" aria-hidden="true">
                  <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 8l-4 4 4 4M16 8l4 4-4 4M4 12h16"/></svg>
                </div>
                <input className="demo-input" id="demo-range" type="range" min="0" max="100" defaultValue="50" aria-label="Compare original and restored photo" />
              </div>
            </div>
            <p className="demo-note">Tip: drag slowly to inspect the details.</p>
          </div>
        </section>

        <section className="steps" id="how">
          <div className="container">
            <div className="section-head reveal">
              <h2>Four steps to a brighter past</h2>
              <p>Restoring a photo used to mean layers, masks and expensive software. Memory Lane boils it down to a couple of clicks.</p>
            </div>
            <div className="steps-grid">
              <article className="step-card reveal">
                <span className="step-num" aria-hidden="true">01</span>
                <span className="step-icon">
                  <svg className="icon-lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5M4 20h16"/></svg>
                </span>
                <h3>Upload your photo</h3>
                <p>Drop in a scan or an old family picture from your device. Large photos are handled gracefully, and nothing ever leaves your computer.</p>
              </article>
              <article className="step-card reveal">
                <span className="step-num" aria-hidden="true">02</span>
                <span className="step-icon">
                  <svg className="icon-lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15v4M21 17h-4"/></svg>
                </span>
                <h3>Let Auto-Fix restore it</h3>
                <p>One click reads the photo and fixes what it finds: black &amp; white prints are colourised, soft focus is sharpened, grain is smoothed and faded tone is rebalanced.</p>
              </article>
              <article className="step-card reveal">
                <span className="step-num" aria-hidden="true">03</span>
                <span className="step-icon">
                  <svg className="icon-lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v18M5 7l-3 5 3 5M19 7l3 5-3 5"/></svg>
                </span>
                <h3>Slide and compare</h3>
                <p>Drag the handle across the photo to slide between the original and the restored version, then fine-tune anything with honest, simple sliders.</p>
              </article>
              <article className="step-card reveal">
                <span className="step-num" aria-hidden="true">04</span>
                <span className="step-icon">
                  <svg className="icon-lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 20H9l-5-5a1.6 1.6 0 0 1 0-2.2l8-8a1.6 1.6 0 0 1 2.2 0l6 6a1.6 1.6 0 0 1 0 2.2L14 19"/><path d="M6.5 10.5l7 7"/></svg>
                </span>
                <h3>Erase unwanted guests</h3>
                <p>Brush over a stray relative, a stain or a scribble and remove it. The fill studies the photo and rebuilds the scene behind it — tones, textures and grain — so it looks like the object was never there.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="features" id="features">
          <div className="container">
            <div className="section-head reveal">
              <h2>Everything a memory needs</h2>
              <p>Small, focused tools that respect the photo — and the people in it.</p>
            </div>
            <div className="features-grid">
              <article className="feature-card reveal">
                <span className="feature-icon">
                  <svg className="icon-lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18"/><path d="M12 3v18"/></svg>
                </span>
                <div>
                  <h3>Colourise black &amp; white</h3>
                  <p>Old monochrome prints get sensible, natural colour — warm skin, soft skies, believable greens — with the original brightness untouched.</p>
                </div>
              </article>
              <article className="feature-card reveal">
                <span className="feature-icon">
                  <svg className="icon-lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5c5 0 9 4.5 9 7s-4 7-9 7-9-4.5-9-7 4-7 9-7z"/><circle cx="12" cy="12" r="3"/></svg>
                </span>
                <div>
                  <h3>Unblur blurry photos</h3>
                  <p>Soft, out-of-focus prints are measured, then the blur itself is reversed with Richardson–Lucy deconvolution — rebuilding edges and detail instead of just sharpening what's left.</p>
                </div>
              </article>
              <article className="feature-card reveal">
                <span className="feature-icon">
                  <svg className="icon-lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v18M5 7l-3 5 3 5M19 7l3 5-3 5"/></svg>
                </span>
                <div>
                  <h3>Slide-to-compare</h3>
                  <p>A draggable handle splits the photo so you can sweep between the original and the restored version — and hold the eye button to peek at the past.</p>
                </div>
              </article>
              <article className="feature-card reveal">
                <span className="feature-icon">
                  <svg className="icon-lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15v4M21 17h-4"/></svg>
                </span>
                <div>
                  <h3>One-click Auto-Fix</h3>
                  <p>Reads the photo's histogram, finds the crushed blacks and muddy whites, and rebalances exposure, contrast and colour automatically.</p>
                </div>
              </article>
              <article className="feature-card reveal">
                <span className="feature-icon">
                  <svg className="icon-lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 20H9l-5-5a1.6 1.6 0 0 1 0-2.2l8-8a1.6 1.6 0 0 1 2.2 0l6 6a1.6 1.6 0 0 1 0 2.2L14 19"/><path d="M6.5 10.5l7 7"/></svg>
                </span>
                <div>
                  <h3>Remove objects for good</h3>
                  <p>Paint over anything you do not want in the picture and an AI-style fill studies the surroundings, then rebuilds the scene behind it so the edit is invisible.</p>
                </div>
              </article>
              <article className="feature-card reveal">
                <span className="feature-icon">
                  <svg className="icon-lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 8h9M19 8h1M4 16h3M13 16h7"/><circle cx="16" cy="8" r="2.5"/><circle cx="10" cy="16" r="2.5"/></svg>
                </span>
                <div>
                  <h3>Full tonal control</h3>
                  <p>Exposure, brightness, contrast, shadows, highlights, saturation and warmth — plus grain smoothing and edge sharpening for old prints.</p>
                </div>
              </article>
              <article className="feature-card reveal">
                <span className="feature-icon">
                  <svg className="icon-lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l7 3v5c0 4.5-3 7.6-7 10-4-2.4-7-5.5-7-10V6z"/></svg>
                </span>
                <div>
                  <h3>Private by design</h3>
                  <p>Every pixel is processed in your browser with canvas technology. No servers, no uploads — your family album stays yours.</p>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className="band-dark">
          <div className="container band-inner">
            <div>
              <h2>Your albums deserve <em>a second life</em>.</h2>
              <p>Those boxes of yellowing prints hold birthdays, weddings and summers that deserve to be seen clearly again. Colourise them, sharpen them, and rescue them in less time than it takes to find the box.</p>
            </div>
            <ul className="band-list">
              <li>
                <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5"/></svg>
                No watermark
              </li>
              <li>
                <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5"/></svg>
                Unlimited photos, forever free
              </li>
              <li>
                <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5"/></svg>
                Undo-safe editing with full history
              </li>
              <li>
                <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5"/></svg>
                Download results in full resolution
              </li>
            </ul>
          </div>
        </section>

        <section className="cta">
          <div className="container">
            <h2>Ready to rescue your first photo?</h2>
            <p>Open the studio, drop in a picture and Auto-Fix does the rest — colour for black &amp; white prints, crispness for blurry ones. Then press New photo and keep going through the whole album.</p>
            <Link className="btn" to="/editor">
              <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 21l9.5-9.5"/><path d="M14.5 4.5l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5L11 8l2.5-1z"/></svg>
              Start restoring
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
