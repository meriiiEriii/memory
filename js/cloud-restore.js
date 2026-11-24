/**
 * cloud-restore.js — front-end for the Replicate cloud AI restoration page.
 *
 * FLOW (matches the 5 steps in the project brief):
 *   1. User picks a file with <input type="file">.            (cloud-restore.html)
 *   2. We read the file and convert it to a base64 data URI,
 *      shrinking oversized photos with a canvas first so the
 *      upload stays small (max 1600 px side, JPEG quality 0.92).
 *   3. We POST it to OUR server (server.js) at /api/restore.
 *      The server — not this page — adds the Replicate API token
 *      and starts a CodeFormer/GFPGAN prediction.
 *   4. We poll /api/predictions/<id> every 1.5 s, showing a
 *      spinner + status text while the AI model runs.
 *   5. When the prediction succeeds we receive a hosted image URL
 *      and display it side-by-side with the original, plus a
 *      download button.
 */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };

  var els = {
    file: $("file-input"),
    btnRestore: $("btn-restore"),
    model: $("model-select"),
    fidelity: $("fidelity"),
    fidelityValue: $("fidelity-value"),
    spinner: $("spinner"),
    statusRow: $("status-row"),
    statusText: $("status-text"),
    beforeImg: $("before-img"),
    afterPanel: $("after-panel"),
    afterImg: $("after-img"),
    btnDownload: $("btn-download"),
  };

  var busy = false;
  var resultUrl = null;

  /* ------------------------------------------------------------------ */
  /* Small helpers                                                       */
  /* ------------------------------------------------------------------ */

  function setStatus(text, mode, spinning) {
    els.statusText.textContent = text;
    els.statusRow.classList.toggle("error", mode === "error");
    els.statusRow.classList.toggle("ok", mode === "ok");
    els.spinner.classList.toggle("hidden", !spinning);
  }

  function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  /** Step 2a: File -> raw base64 data URI using FileReader. */
  function fileToDataUri(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = function () { reject(new Error("Could not read the file")); };
      reader.readAsDataURL(file);
    });
  }

  /**
   * Step 2b: shrink huge photos before upload.
   * Draws the image into a canvas capped at maxSide, re-encodes as JPEG.
   * Small images are passed through untouched.
   */
  function shrinkDataUri(dataUri, maxSide) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        var scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        // Small enough already? Send the original bytes unchanged.
        if (scale >= 1 && dataUri.length < 900000) {
          resolve(dataUri);
          return;
        }
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
      img.onerror = function () { resolve(dataUri); }; // fall back to original
      img.src = dataUri;
    });
  }

  /* ------------------------------------------------------------------ */
  /* Main restore routine (steps 3-5)                                    */
  /* ------------------------------------------------------------------ */

  async function restore() {
    if (busy) return;
    var file = els.file.files && els.file.files[0];
    if (!file) {
      setStatus("Pick a photo first.", "error", false);
      return;
    }

    busy = true;
    els.btnRestore.disabled = true;
    resultUrl = null;
    els.btnDownload.hidden = true;
    els.btnDownload.disabled = true;
    els.afterPanel.classList.add("hidden");

    try {
      // --- Step 2: convert to a data URI the API can accept -------------
      setStatus("Reading photo…", "", true);
      var uri = await fileToDataUri(file);
      uri = await shrinkDataUri(uri, 1600);

      // Show the "before" panel immediately.
      els.beforeImg.src = uri;
      els.beforeImg.classList.remove("hidden");

      // --- Step 3: start the prediction through our proxy ---------------
      setStatus("Uploading to the AI service…", "", true);
      var startRes = await fetch("/api/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: uri,
          model: els.model.value,
          fidelity: Number(els.fidelity.value) / 100,
        }),
      });
      var start = await startRes.json();
      if (!startRes.ok) {
        throw new Error(start.error || "Upload failed (" + startRes.status + ")");
      }

      // --- Step 4: poll until the model finishes ------------------------
      var deadline = Date.now() + 120000; // give up after 2 minutes
      var output = null;
      while (Date.now() < deadline) {
        await sleep(1500);
        var pollRes = await fetch("/api/predictions/" + encodeURIComponent(start.id));
        var poll = await pollRes.json();
        if (!pollRes.ok) {
          throw new Error(poll.error || "Status check failed");
        }
        if (poll.status === "succeeded") {
          output = poll.output;
          break;
        }
        if (poll.status === "failed" || poll.status === "canceled") {
          throw new Error(poll.error || "The AI model could not process this photo");
        }
        setStatus("AI is working… (" + poll.status + ")", "", true);
      }
      if (!output) {
        throw new Error("The AI took too long — try again.");
      }

      // --- Step 5: display the result side-by-side ----------------------
      resultUrl = output;
      els.afterImg.src = resultUrl;
      els.afterPanel.classList.remove("hidden");
      els.btnDownload.hidden = false;
      els.btnDownload.disabled = false;
      setStatus("Done — your restored photo is ready.", "ok", false);
    } catch (err) {
      setStatus(err && err.message ? err.message : "Something went wrong.", "error", false);
    } finally {
      busy = false;
      els.btnRestore.disabled = !(els.file.files && els.file.files[0]);
    }
  }

  /** Download the hosted result image (with a graceful fallback). */
  async function downloadResult() {
    if (!resultUrl) return;
    try {
      var res = await fetch(resultUrl);
      var blob = await res.blob();
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "memory-lane-restored.jpg";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
    } catch (e) {
      window.open(resultUrl, "_blank"); // CORS fallback: open in a new tab
    }
  }

  /* ------------------------------------------------------------------ */
  /* Wiring                                                              */
  /* ------------------------------------------------------------------ */

  els.file.addEventListener("change", function () {
    var has = !!(els.file.files && els.file.files[0]);
    els.btnRestore.disabled = !has;
    if (has) setStatus("Photo selected — press “Restore with AI”.", "", false);
  });

  els.fidelity.addEventListener("input", function () {
    els.fidelityValue.textContent = (Number(els.fidelity.value) / 100).toFixed(2);
  });

  els.btnRestore.addEventListener("click", restore);
  els.btnDownload.addEventListener("click", downloadResult);

  setStatus("Pick a photo to begin.", "", false);
})();
