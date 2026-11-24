/**
 * enhance.js — Remini-style cloud AI photo enhancement (Replicate API).
 * =====================================================================
 *
 * WHERE THE API CALLS HAPPEN (two modes, controlled by USE_PROXY below):
 *
 *   USE_PROXY = true  (default, RECOMMENDED)
 *     -> fetch("/api/predictions", ...) and fetch("/api/predictions/<id>", ...)
 *        Requests go to YOUR OWN server.js (same origin), which adds the
 *        Replicate token server-side and forwards everything to Replicate.
 *        This is the only mode that works inside a normal web browser,
 *        because Replicate blocks direct cross-origin (CORS) requests.
 *
 *   USE_PROXY = false  (DIRECT mode — the raw Replicate flow)
 *     -> fetch("https://api.replicate.com/v1/predictions", ...) with
 *        Authorization: Bearer <REPLICATE_API_KEY> header, then polls
 *        GET /v1/predictions/<id> directly. Paste your token into
 *        REPLICATE_API_KEY below. NOTE: most browsers will block this
 *        with a CORS error — it exists for completeness/server-side use.
 *
 * PIPELINE PER MODE:
 *   "face"    -> CodeFormer (exact version hash, params per brief)
 *   "color"   -> piddnad/ddcolor  (colorizes black & white photos;
 *                swap COLORIZE_MODEL to "arielreplicate/deoldify_image"
 *                if you prefer DeOldify)
 *   "both"    -> CodeFormer first, then ddcolor on the restored output
 */

/* ======================================================================
 * 3. SETUP & PLACEHOLDERS
 * ==================================================================== */

// Paste your Replicate token here — ONLY used when USE_PROXY is false.
const REPLICATE_API_KEY = "YOUR_REPLICATE_API_TOKEN_HERE";

// true  = call Replicate through server.js (works in browsers; token in server.js)
// false = call https://api.replicate.com directly with REPLICATE_API_KEY
const USE_PROXY = true;

// Replicate endpoints
const REPLICATE_API_URL = "https://api.replicate.com/v1/predictions";

// Exact CodeFormer version hash from the project brief (Unblur & Restore Face)
const CODEFORMER_VERSION =
  "7de2ea26c616d5bf2245ad0d5e24f0ef9a525e65f62adef61915f4ef53fc3ae5";

// Colorization model (uses its latest published version)
const COLORIZE_MODEL = "piddnad/ddcolor";

const POLL_INTERVAL_MS = 1500;  // how often we ask "is it done yet?"
const POLL_TIMEOUT_MS = 180000; // give up after 3 minutes (chain = 2 models)

/* ====================================================================== */

(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };

  var els = {
    dropZone: $("drop-zone"),
    file: $("file-input"),
    btnEnhance: $("btn-enhance"),
    statusRow: $("status-row"),
    statusText: $("status-text"),
    spinner: $("spinner"),
    beforeImg: $("before-img"),
    afterPanel: $("after-panel"),
    afterImg: $("after-img"),
    btnDownload: $("btn-download"),
    fidelityRow: $("fidelity-row"),
    fidelity: $("fidelity"),
    fidelityValue: $("fidelity-value"),
  };

  var busy = false;
  var resultUrl = null;
  var chosenUri = null;

  function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function setStatus(text, mode, spinning) {
    els.statusText.textContent = text;
    els.statusRow.classList.toggle("error", mode === "error");
    els.statusRow.classList.toggle("ok", mode === "ok");
    els.spinner.classList.toggle("hidden", !spinning);
  }

  function currentMode() {
    var checked = document.querySelector('input[name="enhance-mode"]:checked');
    return checked ? checked.value : "face";
  }

  /* ------------------------------------------------------------------ */
  /* Step 1-2: file selection -> base64 data URI (shrunk before upload)  */
  /* ------------------------------------------------------------------ */

  function fileToDataUri(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = function () { reject(new Error("Could not read the file")); };
      reader.readAsDataURL(file);
    });
  }

  function shrinkDataUri(dataUri, maxSide) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        var scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        if (scale >= 1 && dataUri.length < 900000) { resolve(dataUri); return; }
        var w = Math.max(1, Math.round(img.width * scale));
        var h = Math.max(1, Math.round(img.height * scale));
        var canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext("2d");
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.92));
      };
      img.onerror = function () { resolve(dataUri); };
      img.src = dataUri;
    });
  }

  /* ------------------------------------------------------------------ */
  /* Step 3: create a prediction on Replicate                            */
  /*   spec = { version, input }  (pinned model hash)                    */
  /*   or spec = { model, input }   (latest version of owner/name)       */
  /* ------------------------------------------------------------------ */

  async function createPrediction(spec) {
    if (USE_PROXY) {
      var res = await fetch("/api/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(spec),
      });
      var data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not start the AI task (" + res.status + ")");
      return data.id;
    }

    // ---- DIRECT Replicate call (see CORS note at top of file) ----
    var url = spec.version
      ? REPLICATE_API_URL // POST /v1/predictions with { version, input }
      : "https://api.replicate.com/v1/models/" + spec.model + "/predictions";
    var payload = spec.version
      ? { version: spec.version, input: spec.input }
      : { input: spec.input };
    var direct = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + REPLICATE_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    var djson = await direct.json();
    if (!direct.ok) throw new Error(djson.detail || "Replicate rejected the request (" + direct.status + ")");
    return djson.id;
  }

  /* ------------------------------------------------------------------ */
  /* Step 4: polling loop — runs until status === "succeeded"            */
  /* ------------------------------------------------------------------ */

  async function waitForPrediction(id, onStatus) {
    var deadline = Date.now() + POLL_TIMEOUT_MS;
    while (Date.now() < deadline) {
      await sleep(POLL_INTERVAL_MS);
      var data;
      if (USE_PROXY) {
        var res = await fetch("/api/predictions/" + encodeURIComponent(id));
        data = await res.json();
        if (!res.ok) throw new Error(data.error || "Status check failed");
      } else {
        var direct = await fetch(REPLICATE_API_URL + "/" + id, {
          headers: { Authorization: "Bearer " + REPLICATE_API_KEY },
        });
        data = await direct.json();
        if (!direct.ok) throw new Error(data.detail || "Status check failed (" + direct.status + ")");
      }
      if (data.status === "succeeded") return data.output;
      if (data.status === "failed" || data.status === "canceled") {
        throw new Error(data.error || "The AI model could not process this photo");
      }
      if (onStatus) onStatus(data.status);
    }
    throw new Error("The AI took too long — please try again.");
  }

  /* ------------------------------------------------------------------ */
  /* Model input builders (parameters per the project brief)             */
  /* ------------------------------------------------------------------ */

  function codeformerInput(dataUri, fidelity) {
    return {
      image: dataUri,
      codeformer_fidelity: fidelity, // 0 = max beautify, 1 = stay faithful
      background_enhance: true,
      face_upsample: true,
    };
  }

  function colorizeInput(dataUri) {
    return { image: dataUri };
  }

  /* ------------------------------------------------------------------ */
  /* Main flow (step 5 = display result)                                 */
  /* ------------------------------------------------------------------ */

  async function enhancePhoto() {
    if (busy) return;
    if (!chosenUri) {
      setStatus("Pick a photo first — click or drop it above.", "error", false);
      return;
    }
    var mode = currentMode();
    busy = true;
    els.btnEnhance.disabled = true;
    resultUrl = null;
    els.btnDownload.hidden = true;
    els.btnDownload.disabled = true;
    els.afterPanel.classList.add("hidden");

    try {
      els.beforeImg.src = chosenUri;
      els.beforeImg.classList.remove("hidden");
      var fidelity = Number(els.fidelity.value) / 100;
      var output = null;

      if (mode === "face" || mode === "both") {
        // ---- Stage 1: CodeFormer (unblur + restore faces) ----
        setStatus("Sending to AI…", "", true);
        var faceId = await createPrediction({
          version: CODEFORMER_VERSION,
          input: codeformerInput(chosenUri, fidelity),
        });
        setStatus("Restoring facial details…", "", true);
        var faceOut = await waitForPrediction(faceId, function (st) {
          setStatus("Restoring facial details… (" + st + ")", "", true);
        });
        output = faceOut;

        if (mode === "both") {
          // ---- Stage 2: colorize the restored result ----
          setStatus("Colorizing your restored photo…", "", true);
          var colorId = await createPrediction({
            model: COLORIZE_MODEL,
            input: colorizeInput(faceOut),
          });
          output = await waitForPrediction(colorId, function (st) {
            setStatus("Colorizing your restored photo… (" + st + ")", "", true);
          });
        }
      } else {
        // ---- Colorize-only mode ----
        setStatus("Sending to AI…", "", true);
        var id = await createPrediction({
          model: COLORIZE_MODEL,
          input: colorizeInput(chosenUri),
        });
        setStatus("Colorizing your photo…", "", true);
        output = await waitForPrediction(id, function (st) {
          setStatus("Colorizing your photo… (" + st + ")", "", true);
        });
      }

      setStatus("Processing completion…", "", true);
      await sleep(400); // brief beat so the final stage is visible

      resultUrl = output;
      els.afterImg.src = resultUrl;
      els.afterPanel.classList.remove("hidden");
      els.btnDownload.hidden = false;
      els.btnDownload.disabled = false;
      setStatus("Done — your enhanced photo is ready.", "ok", false);
    } catch (err) {
      setStatus(err && err.message ? err.message : "Something went wrong.", "error", false);
    } finally {
      busy = false;
      els.btnEnhance.disabled = !chosenUri;
    }
  }

  async function downloadResult() {
    if (!resultUrl) return;
    try {
      var res = await fetch(resultUrl);
      var blob = await res.blob();
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "memory-lane-enhanced.jpg";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
    } catch (e) {
      window.open(resultUrl, "_blank");
    }
  }

  /* ------------------------------------------------------------------ */
  /* Wiring: drop area, mode selector, buttons                           */
  /* ------------------------------------------------------------------ */

  els.dropZone.addEventListener("click", function () { els.file.click(); });
  els.dropZone.addEventListener("dragover", function (e) {
    e.preventDefault();
    els.dropZone.classList.add("dragging");
  });
  els.dropZone.addEventListener("dragleave", function () {
    els.dropZone.classList.remove("dragging");
  });
  els.dropZone.addEventListener("drop", function (e) {
    e.preventDefault();
    els.dropZone.classList.remove("dragging");
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      els.file.files = e.dataTransfer.files;
      els.file.dispatchEvent(new Event("change"));
    }
  });

  els.file.addEventListener("change", async function () {
    var file = els.file.files && els.file.files[0];
    if (!file) return;
    setStatus("Reading photo…", "", true);
    try {
      var uri = await fileToDataUri(file);
      chosenUri = await shrinkDataUri(uri, 1600);
      els.beforeImg.src = chosenUri;
      els.beforeImg.classList.remove("hidden");
      els.btnEnhance.disabled = false;
      // Auto-enhance: start the AI pipeline immediately on attach.
      // (The button stays available afterwards for re-runs with other modes.)
      enhancePhoto();
    } catch (err) {
      chosenUri = null;
      els.btnEnhance.disabled = true;
      setStatus(err && err.message ? err.message : "Could not read that file.", "error", false);
    }
  });

  var modeRadios = document.querySelectorAll('input[name="enhance-mode"]');
  for (var i = 0; i < modeRadios.length; i++) {
    modeRadios[i].addEventListener("change", function () {
      document.querySelectorAll(".mode-card").forEach(function (c) {
        c.classList.toggle("active", c.querySelector("input").checked);
      });
      var m = currentMode();
      els.fidelityRow.classList.toggle("hidden", m === "color");
    });
  }

  els.fidelity.addEventListener("input", function () {
    els.fidelityValue.textContent = (Number(els.fidelity.value) / 100).toFixed(2);
  });

  els.btnEnhance.addEventListener("click", enhancePhoto);
  els.btnDownload.addEventListener("click", downloadResult);

  setStatus("Pick a photo to begin.", "", false);
})();
