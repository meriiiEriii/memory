window.MRL = window.MRL || {};
window.MRL.initEditor = function () {
  "use strict";

  const $ = function (id) {
    return document.getElementById(id);
  };

  const MAX_DIM = 4096;
  const PREVIEW_CAP = 1400;

  const els = {
    stageWrap: $("stage-wrap"),
    stage: $("stage"),
    mainCanvas: $("main-canvas"),
    brushLayer: $("brush-layer"),
    originalCanvas: $("original-canvas"),
    compareWrap: $("compare-wrap"),
    compareDivider: $("compare-divider"),
    brushCursor: $("brush-cursor"),
    emptyState: $("empty-state"),
    dropZone: $("drop-zone"),
    fileInput: $("file-input"),
    btnUpload: $("btn-upload"),
    btnBwRestore: $("btn-colorize"),
    btnBlurRestore: $("btn-deblur-restore"),
    btnAdjustReset: $("btn-adjust-reset"),
    toneSliders: $("tone-sliders"),
    noiseRange: $("noise-range"),
    noiseValue: $("noise-value"),
    sharpenRange: $("sharpen-range"),
    sharpenValue: $("sharpen-value"),
    colorizeRange: $("colorize-range"),
    colorizeValue: $("colorize-value"),
    deblurRange: $("deblur-range"),
    deblurValue: $("deblur-value"),
    detailRange: $("detail-range"),
    detailValue: $("detail-value"),
    styleSegments: $("style-segments"),
    detectChips: $("detect-chips"),
    statusDetect: $("status-detect"),
    brushSizeRange: $("brush-size-range"),
    brushSizeValue: $("brush-size-value"),
    brushDot: $("brush-dot"),
    btnFillSel: $("btn-fill-sel"),
    btnClearSel: $("btn-clear-sel"),
    btnRemoveBg: $("btn-remove-bg"),
    btnBgErase: $("btn-bg-erase"),
    bgBrushSizeRange: $("bg-brush-size-range"),
    bgBrushSizeValue: $("bg-brush-size-value"),
    bgBrushDot: $("bg-brush-dot"),
    btnCompare: $("btn-compare"),
    btnPeek: $("btn-peek"),
    btnNewPhoto: $("btn-new-photo"),
    btnUndo: $("btn-undo"),
    btnRedo: $("btn-redo"),
    btnReset: $("btn-reset"),
    btnDownload: $("btn-download"),
    sidebar: $("sidebar"),
    sidebarToggle: $("sidebar-toggle"),
    loader: $("loader"),
    loaderText: $("loader-text"),
    toast: $("toast"),
    statusFile: $("status-file"),
    statusDims: $("status-dims"),
    statusHint: $("status-hint"),
    statusAlpha: $("status-alpha"),
  };

  const workCanvas = document.createElement("canvas");
  const workCtx = workCanvas.getContext("2d", { willReadFrequently: true });
  const originalCanvas = document.createElement("canvas");
  const maskCanvas = document.createElement("canvas");
  const maskCtx = maskCanvas.getContext("2d", { willReadFrequently: true });
  const tmpCanvas = document.createElement("canvas");
  const tmpCtx = tmpCanvas.getContext("2d", { willReadFrequently: true });
  const tmpMaskCanvas = document.createElement("canvas");
  const tmpMaskCtx = tmpMaskCanvas.getContext("2d", { willReadFrequently: true });
  const previewCtx = els.mainCanvas.getContext("2d", { willReadFrequently: true });
  const brushCtx = els.brushLayer.getContext("2d");

  const state = {
    hasImage: false,
    mode: "restore",
    bgFill: "transparent",
    tool: "brush",
    fileName: "",
    adjust: MRL.adjust.defaults(),
    cleanup: { noise: 0, sharpen: 0, colorize: 0, deblur: 0, detail: 0, colorStyle: "natural" },
    brushSize: 36,
    maskPainted: false,
    painting: false,
    restoreUsed: false,
    btool: null,
    hasAlpha: false,
    lastX: 0,
    lastY: 0,
    busy: false,
    split: 50,
    compareOn: true,
    draggingSplit: false,
    report: null,
  };

  const originalCtx = els.originalCanvas.getContext("2d", { willReadFrequently: true });

  const history = MRL.history.create(8);

  let restoreToken = 0;
  let toastTimer = null;
  function toast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      els.toast.classList.remove("show");
    }, 2600);
  }

  function showLoader(text) {
    els.loaderText.textContent = text || "Working";
    els.loader.classList.add("show");
  }

  function hideLoader() {
    els.loader.classList.remove("show");
  }

  function nextFrame() {
    return new Promise(function (res) {
      setTimeout(res, 40);
    });
  }

  function setFill(input) {
    const min = Number(input.min) || 0;
    const max = Number(input.max) || 100;
    const v = Number(input.value);
    const pct = ((v - min) / (max - min)) * 100;
    input.style.setProperty("--fill", pct + "%");
  }

  const paramInputs = {};

  function buildToneSliders() {
    MRL.adjust.PARAMS.forEach(function (p) {
      const row = document.createElement("div");
      row.className = "slider-row";
      const label = document.createElement("div");
      label.className = "slider-label";
      const name = document.createElement("span");
      name.textContent = p.label;
      const badge = document.createElement("span");
      badge.className = "slider-value";
      badge.textContent = "0";
      label.appendChild(name);
      label.appendChild(badge);
      const input = document.createElement("input");
      input.type = "range";
      input.min = String(p.min);
      input.max = String(p.max);
      input.value = "0";
      input.setAttribute("aria-label", p.label);
      row.appendChild(label);
      row.appendChild(input);
      els.toneSliders.appendChild(row);
      paramInputs[p.key] = { input: input, badge: badge, def: p.def };
      setFill(input);
      input.addEventListener("input", function () {
        state.adjust[p.key] = Number(input.value);
        badge.textContent = input.value;
        setFill(input);
        renderPreview();
      });
      input.addEventListener("change", function () {
        pushHistory();
      });
      label.addEventListener("dblclick", function () {
        input.value = String(p.def);
        state.adjust[p.key] = p.def;
        badge.textContent = String(p.def);
        setFill(input);
        renderPreview();
      });
    });
  }

  function syncSliders() {
    Object.keys(paramInputs).forEach(function (key) {
      const rec = paramInputs[key];
      rec.input.value = String(state.adjust[key]);
      rec.badge.textContent = String(state.adjust[key]);
      setFill(rec.input);
    });
    els.noiseRange.value = String(state.cleanup.noise);
    els.noiseValue.textContent = String(state.cleanup.noise);
    setFill(els.noiseRange);
    els.sharpenRange.value = String(state.cleanup.sharpen);
    els.sharpenValue.textContent = String(state.cleanup.sharpen);
    setFill(els.sharpenRange);
    els.colorizeRange.value = String(state.cleanup.colorize);
    els.colorizeValue.textContent = String(state.cleanup.colorize);
    setFill(els.colorizeRange);
    els.deblurRange.value = String(state.cleanup.deblur);
    els.deblurValue.textContent = String(state.cleanup.deblur);
    setFill(els.deblurRange);
    els.detailRange.value = String(state.cleanup.detail);
    els.detailValue.textContent = String(state.cleanup.detail);
    setFill(els.detailRange);
    syncColorizeUI();
    syncBgSliders();
  }

  // Keeps the duplicated Size slider in the "Remove background"
  // group in step with the shared tool state.
  function syncBgSliders() {
    els.bgBrushSizeRange.value = String(state.brushSize);
    els.bgBrushSizeValue.textContent = String(state.brushSize);
    setFill(els.bgBrushSizeRange);
    els.bgBrushDot.style.width = Math.max(8, Math.min(56, state.brushSize * 0.55)) + "px";
    els.bgBrushDot.style.height = Math.max(8, Math.min(56, state.brushSize * 0.55)) + "px";
  }

  let rafPending = false;
  function renderPreview() {
    if (!state.hasImage) return;
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(function () {
      rafPending = false;
      drawPreview();
    });
  }

  function drawPreview() {
    if (!state.hasImage) return;
    const pw = els.mainCanvas.width;
    const ph = els.mainCanvas.height;
    if (pw <= 0 || ph <= 0) return;
    previewCtx.imageSmoothingEnabled = true;
    previewCtx.imageSmoothingQuality = "high";
    previewCtx.clearRect(0, 0, pw, ph);
    previewCtx.drawImage(workCanvas, 0, 0, pw, ph);
    try {
      const img = previewCtx.getImageData(0, 0, pw, ph);
      const out = MRL.adjust.render(img.data, pw, ph, state.adjust, state.cleanup);
      img.data.set(out);
      previewCtx.putImageData(img, 0, 0);
    } catch (e) {
      console.error("Preview render error:", e);
      // Canvas already has workCanvas drawn; leave as-is
    }
  }

  function fitStage() {
    if (!state.hasImage) return;
    const cs = getComputedStyle(els.stageWrap);
    const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    const availW = Math.max(80, els.stageWrap.clientWidth - padX);
    const availH = Math.max(80, els.stageWrap.clientHeight - padY);
    const scale = Math.min(availW / workCanvas.width, availH / workCanvas.height);
    const dispW = Math.max(120, Math.round(workCanvas.width * scale));
    const dispH = Math.max(90, Math.round(workCanvas.height * scale));
    els.stage.style.width = dispW + "px";
    els.stage.style.height = dispH + "px";
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pw = Math.max(64, Math.min(Math.round(dispW * dpr), workCanvas.width, PREVIEW_CAP));
    const ph = Math.max(48, Math.round(pw * (workCanvas.height / workCanvas.width)));
    els.mainCanvas.width = pw;
    els.mainCanvas.height = ph;
    els.brushLayer.width = pw;
    els.brushLayer.height = ph;
    els.originalCanvas.width = pw;
    els.originalCanvas.height = ph;
    originalCtx.imageSmoothingEnabled = true;
    originalCtx.imageSmoothingQuality = "high";
    originalCtx.clearRect(0, 0, pw, ph);
    originalCtx.drawImage(originalCanvas, 0, 0, pw, ph);
    refreshOverlay();
    drawPreview();
  }

  function refreshOverlay() {
    const bw = els.brushLayer.width;
    const bh = els.brushLayer.height;
    brushCtx.clearRect(0, 0, bw, bh);
    brushCtx.drawImage(maskCanvas, 0, 0, bw, bh);
    brushCtx.globalCompositeOperation = "source-in";
    brushCtx.fillStyle = "rgba(180, 85, 60, 0.5)";
    brushCtx.fillRect(0, 0, bw, bh);
    brushCtx.globalCompositeOperation = "source-over";
  }

  function updateHistoryButtons() {
    els.btnUndo.disabled = !MRL.history.canUndo(history) || state.busy;
    els.btnRedo.disabled = !MRL.history.canRedo(history) || state.busy;
  }

  function setRestoreActionsDisabled(disabled) {
    els.btnBwRestore.disabled = disabled || !state.hasImage;
    els.btnBlurRestore.disabled = disabled || !state.hasImage;
  }

  function updateRemoveUI() {
    const sel = state.maskPainted && !state.busy;
    els.btnFillSel.disabled = !sel;
    els.btnClearSel.disabled = !sel;
    els.btnBgErase.disabled = !sel;
    els.btnRemoveBg.disabled = !state.hasImage || state.busy;
    document.querySelectorAll("#panel-remove .btool-btn").forEach(function (b) {
      b.disabled = !state.hasImage || state.busy;
    });
  }

  function updateAlphaBadge() {
    els.statusAlpha.hidden = !state.hasAlpha;
  }

  function syncColorizeUI() {
    const colorizing = state.cleanup.colorize > 0;
    els.btnBwRestore.classList.toggle("active", colorizing);
    els.btnBwRestore.setAttribute("aria-pressed", colorizing ? "true" : "false");
    els.styleSegments.hidden = !colorizing;
    els.styleSegments.querySelectorAll(".style-btn").forEach(function (b) {
      const on = b.dataset.style === state.cleanup.colorStyle;
      b.classList.toggle("active", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function updateDetectChips() {
    const chips = [];
    const rep = state.report;
    if (rep) {
      if (rep.grayscale) chips.push({ text: "Black & white", kind: "alert" });
      if (rep.blurAmount > 0.12) {
        chips.push({ text: rep.blurLabel.charAt(0).toUpperCase() + rep.blurLabel.slice(1), kind: rep.blurAmount > 0.28 ? "alert" : "" });
      }
      if (rep.noise > 0.018) chips.push({ text: "Grainy", kind: "" });
      if (state.cleanup.colorize > 0) chips.push({ text: "Colour added", kind: "good" });
      if (state.cleanup.deblur > 18) chips.push({ text: "Sharpened", kind: "good" });
      if (!chips.length) chips.push({ text: "Looks healthy", kind: "good" });
    }
    const html = chips
      .map(function (c) {
        return '<span class="detect-chip ' + c.kind + '">' + c.text + "</span>";
      })
      .join("");
    els.detectChips.innerHTML = html;
    els.statusDetect.innerHTML = html;
  }

  function setSplit(value) {
    const v = Math.max(0, Math.min(100, Math.round(value * 10) / 10));
    state.split = v;
    els.stage.style.setProperty("--split", v + "%");
    els.compareDivider.setAttribute("aria-valuenow", String(Math.round(v)));
    els.compareDivider.setAttribute("aria-valuetext", Math.round(v) + " percent original");
  }

  function applyCompareVisibility() {
    const visible = state.compareOn && state.mode === "restore";
    els.stage.classList.toggle("compare-off", !visible);
    els.btnCompare.classList.toggle("active", visible);
    els.btnCompare.setAttribute("aria-pressed", visible ? "true" : "false");
  }

  function applyAutoRestore() {
    if (!state.hasImage || state.busy) return null;
    const token = ++restoreToken;
    state.busy = true;
    updateHistoryButtons();
    setRestoreActionsDisabled(true);
    showLoader("Deblurring & restoring your photo");
    return nextFrame()
      .then(function () {
        if (token !== restoreToken) return null;
        try {
          const tone = MRL.adjust.suggestFromCanvas(workCanvas);
          const rec = MRL.adjust.suggestCleanup(workCanvas);
          rec.cleanup.noise = 100;
          rec.cleanup.deblur = 100;
          state.adjust = tone;
          state.cleanup = rec.cleanup;
          state.report = rec.report;
          syncSliders();
          updateDetectChips();
          drawPreview();
          return rec.report;
        } catch (e) {
          console.error("Auto-restore error:", e);
          throw e;
        }
      })
      .then(function (report) {
        if (token !== restoreToken) return null;
        hideLoader();
        state.busy = false;
        setRestoreActionsDisabled(false);
        updateHistoryButtons();
        updateRemoveUI();
        toast(report ? report.message : "Photo restored");
        return report;
      })
      .catch(function (err) {
        if (token !== restoreToken) return null;
        hideLoader();
        state.busy = false;
        setRestoreActionsDisabled(false);
        updateHistoryButtons();
        updateRemoveUI();
        console.error("Auto-restore failed:", err);
        const message = err && err.message ? err.message : "unknown error";
        toast("Auto-restore failed: " + message);
        return null;
      });
  }

  function resizeWorkspaceLayers() {
    const changed = maskCanvas.width !== workCanvas.width || maskCanvas.height !== workCanvas.height;
    if (!changed) return false;
    maskCanvas.width = workCanvas.width;
    maskCanvas.height = workCanvas.height;
    tmpCanvas.width = workCanvas.width;
    tmpCanvas.height = workCanvas.height;
    tmpMaskCanvas.width = workCanvas.width;
    tmpMaskCanvas.height = workCanvas.height;
    state.maskPainted = false;
    return true;
  }

  function analysisImage(maxSide) {
    const scale = Math.min(1, maxSide / Math.max(workCanvas.width, workCanvas.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(workCanvas.width * scale));
    canvas.height = Math.max(1, Math.round(workCanvas.height * scale));
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(workCanvas, 0, 0, canvas.width, canvas.height);
    return {
      data: ctx.getImageData(0, 0, canvas.width, canvas.height).data,
      width: canvas.width,
      height: canvas.height,
    };
  }

  function analyzePhoto() {
    try {
      state.report = MRL.adjust.suggestCleanup(workCanvas).report;
      updateDetectChips();
    } catch (err) {
      console.error("Photo analysis failed:", err);
      const message = err && err.message ? err.message : String(err || "unknown error");
      toast("Could not analyze this photo: " + message);
    }
  }

  function quickRestore(kind) {
    if (!state.hasImage || state.busy) return;
    state.busy = true;
    setRestoreActionsDisabled(true);
    updateHistoryButtons();
    updateRemoveUI();
    showLoader("Restoring black & white photo");

    nextFrame()
      .then(function () {
        state.cleanup.colorize = 100;
        state.cleanup.detail = 100;
        state.cleanup.deblur = 100;
        state.cleanup.noise = 100;
        syncSliders();
        syncColorizeUI();
        updateDetectChips();
        drawPreview();
        state.busy = false;
        pushHistory();
        toast("Black & white restored — colorize, detail and deblur at 100");
      })
      .catch(function (err) {
        console.error("Photo restoration failed:", err);
        const message = err && err.message ? err.message : String(err || "unknown error");
        toast("Could not restore this photo: " + message);
      })
      .finally(function () {
        hideLoader();
        state.busy = false;
        setRestoreActionsDisabled(false);
        updateHistoryButtons();
        updateRemoveUI();
      });
  }

  function resetWorkspace() {
    restoreToken++;
    state.hasImage = false;
    state.fileName = "";
    state.adjust = MRL.adjust.defaults();
    state.cleanup = { noise: 0, sharpen: 0, colorize: 0, deblur: 0, detail: 0, colorStyle: "natural" };
    state.maskPainted = false;
    state.hasAlpha = false;
    state.btool = null;
    document.querySelectorAll("#panel-remove .btool-btn").forEach(function (b) {
      b.classList.remove("active");
      b.setAttribute("aria-pressed", "false");
    });
    state.restoreUsed = false;
    state.report = null;
    state.busy = false;
    syncSliders();
    clearMask();
    updateAlphaBadge();
    updateDetectChips();
    MRL.history.reset(history);
    updateHistoryButtons();
    updateRemoveUI();
    els.emptyState.classList.remove("hidden");
    els.stage.classList.add("hidden");
    els.btnPeek.classList.add("hidden");
    els.btnDownload.disabled = true;
    setRestoreActionsDisabled(true);
    els.statusFile.textContent = "No photo";
    els.statusDims.textContent = "";
    els.statusHint.textContent = "Drop a photo to begin";
  }

  function newPhoto() {
    if (state.busy) return;
    els.fileInput.click();
  }

  function setColorStyle(style) {
    state.cleanup.colorStyle = style;
    syncColorizeUI();
    renderPreview();
    pushHistory();
  }

  function updateStatusHint() {
    if (!state.hasImage) {
      els.statusHint.textContent = "Drop a photo to begin";
      return;
    }
    if (state.mode === "restore") {
      els.statusHint.textContent = "Restore mode - drag the handle to compare, or tune the sliders";
      return;
    }
    if (state.btool === "brush") {
      els.statusHint.textContent = "Transparency brush - paint the backdrop away, Undo reverses each stroke";
      return;
    }
    if (state.btool === "wand") {
      els.statusHint.textContent = "Transparency wand - click the backdrop to erase connected similar colours";
      return;
    }
    if (state.tool === "brush") {
      els.statusHint.textContent = "Brush over an object, then Erase rebuilds what is behind it";
    } else if (state.tool === "wand") {
      els.statusHint.textContent = "Wand — click an area to select similar colors";
    } else {
      els.statusHint.textContent = "Restore brush — paint the original photo back";
    }
  }

  function clearMask() {
    maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    state.maskPainted = false;
    refreshOverlay();
    updateRemoveUI();
  }

  function setMode(mode) {
    state.mode = mode;
    document.querySelectorAll(".mode-tab").forEach(function (t) {
      const on = t.dataset.mode === mode;
      t.classList.toggle("active", on);
      t.setAttribute("aria-selected", on ? "true" : "false");
    });
    $("panel-restore").classList.toggle("active", mode === "restore");
    $("panel-remove").classList.toggle("active", mode === "remove");
    els.brushLayer.classList.toggle("enabled", mode === "remove" && state.hasImage);
    applyCompareVisibility();
    updateStatusHint();
  }

  function setTool(tool) {
    state.tool = tool;
    if (state.btool) {
      state.btool = null;
      document.querySelectorAll("#panel-remove .btool-btn").forEach(function (b) {
        b.classList.remove("active");
        b.setAttribute("aria-pressed", "false");
      });
    }
    document.querySelectorAll(".tool-btn").forEach(function (b) {
      const on = b.dataset.tool === tool;
      b.classList.toggle("active", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    updateStatusHint();
  }

  function setBTool(t) {
    state.btool = state.btool === t ? null : t;
    document.querySelectorAll("#panel-remove .btool-btn").forEach(function (b) {
      const on = b.dataset.btool === state.btool;
      b.classList.toggle("active", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    updateStatusHint();
  }

  function scanAlpha() {
    const d = workCtx.getImageData(0, 0, workCanvas.width, workCanvas.height).data;
    for (let i = 3; i < d.length; i += 4) {
      if (d[i] < 250) return true;
    }
    return false;
  }

  function setSource(src, name) {
    restoreToken++;
    state.busy = false;
    hideLoader();
    const iw = src.naturalWidth || src.width;
    const ih = src.naturalHeight || src.height;
    const scale = Math.min(1, MAX_DIM / Math.max(iw, ih));
    const w = Math.max(1, Math.round(iw * scale));
    const h = Math.max(1, Math.round(ih * scale));
    workCanvas.width = w;
    workCanvas.height = h;
    workCtx.drawImage(src, 0, 0, w, h);
    originalCanvas.width = w;
    originalCanvas.height = h;
    originalCanvas.getContext("2d").drawImage(src, 0, 0, w, h);
    maskCanvas.width = w;
    maskCanvas.height = h;
    maskCtx.clearRect(0, 0, w, h);
    tmpCanvas.width = w;
    tmpCanvas.height = h;
    tmpCtx.clearRect(0, 0, w, h);
    tmpMaskCanvas.width = w;
    tmpMaskCanvas.height = h;
    tmpMaskCtx.clearRect(0, 0, w, h);
    state.hasImage = true;
    state.fileName = name || "photo";
    state.adjust = MRL.adjust.defaults();
    state.cleanup = { noise: 0, sharpen: 0, colorize: 0, deblur: 0, detail: 0, colorStyle: "natural" };
    state.maskPainted = false;
    state.hasAlpha = false;
    state.btool = null;
    document.querySelectorAll("#panel-remove .btool-btn").forEach(function (b) {
      b.classList.remove("active");
      b.setAttribute("aria-pressed", "false");
    });
    state.restoreUsed = false;
    state.report = null;
    syncSliders();
    updateAlphaBadge();
    updateDetectChips();
    MRL.history.reset(history);
    MRL.history.push(history, workCanvas, false, currentMeta());
    updateHistoryButtons();
    updateRemoveUI();
    els.emptyState.classList.add("hidden");
    els.stage.classList.remove("hidden");
    setRestoreActionsDisabled(false);
    els.btnPeek.classList.remove("hidden");
    els.btnDownload.disabled = false;
    els.statusFile.textContent = state.fileName;
    els.statusDims.textContent = iw + " x " + ih + " px";
    setSplit(50);
    setMode(state.mode);
    fitStage();
    renderPreview();
    analyzePhoto();
  }

  function handleFile(file) {
    if (!file) return;
    if (!file.type || file.type.indexOf("image/") !== 0) {
      toast("Please choose an image file");
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = function () {
      setSource(img, file.name.replace(/\.[^.]+$/, ""));
      URL.revokeObjectURL(url);
      toast("Photo loaded — choose a repair or press Auto-Fix");
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      toast("That file could not be opened");
    };
    img.src = url;
  }

  function loadSample() {
    const faded = MRL.sample.makeFadedCanvas();
    setSource(faded, "sample-vintage-photo");
    toast("Sample loaded — choose a repair or Auto-Fix");
  }

  function loadSampleBw() {
    const bw = MRL.sample.makeBlackWhiteCanvas();
    setSource(bw, "sample-black-and-white-portrait");
    toast("Black & white portrait loaded — choose Restore black & white photo");
  }

  function loadSampleBlur() {
    const blurry = MRL.sample.makeBlurryCanvas();
    setSource(blurry, "sample-soft-focus-print");
    toast("Soft-focus print loaded — choose Auto-Fix blurry photo");
  }

  function autoEnhance() {
    applyAutoRestore();
  }

  function resetAdjustments() {
    state.adjust = MRL.adjust.defaults();
    state.cleanup = { noise: 0, sharpen: 0, colorize: 0, deblur: 0, detail: 0, colorStyle: "natural" };
    syncSliders();
    updateDetectChips();
    drawPreview();
    toast("Adjustments cleared — press Auto-Fix to restore again");
  }

  function resetAll() {
    if (!state.hasImage || state.busy) return;
    workCanvas.width = originalCanvas.width;
    workCanvas.height = originalCanvas.height;
    workCtx.drawImage(originalCanvas, 0, 0);
    resizeWorkspaceLayers();
    clearMask();
    state.hasAlpha = false;
    state.restoreUsed = false;
    state.adjust = MRL.adjust.defaults();
    state.cleanup = { noise: 0, sharpen: 0, colorize: 0, deblur: 0, detail: 0, colorStyle: "natural" };
    syncSliders();
    els.statusDims.textContent = originalCanvas.width + " x " + originalCanvas.height + " px";
    updateAlphaBadge();
    MRL.history.reset(history);
    MRL.history.push(history, workCanvas, false, currentMeta());
    updateHistoryButtons();
    fitStage();
    renderPreview();
    analyzePhoto();
    toast("Original restored — choose a repair to continue");
  }

  function currentMeta() {
    return {
      adjust: Object.assign({}, state.adjust),
      cleanup: Object.assign({}, state.cleanup),
    };
  }

  function pushHistory() {
    if (!state.hasImage || state.busy) return;
    MRL.history.push(history, workCanvas, state.hasAlpha, currentMeta());
    updateHistoryButtons();
  }

  function applyMeta(meta) {
    if (!meta) return;
    state.adjust = Object.assign(MRL.adjust.defaults(), meta.adjust);
    state.cleanup = Object.assign(
      { noise: 0, sharpen: 0, colorize: 0, deblur: 0, detail: 0, colorStyle: "natural" },
      meta.cleanup
    );
    syncSliders();
    updateDetectChips();
  }

  function doUndo() {
    if (state.busy || state.painting || !MRL.history.canUndo(history)) return;
    state.busy = true;
    updateHistoryButtons();
    MRL.history.undo(history, workCanvas, function (img, meta) {
      applyMeta(meta);
      if (resizeWorkspaceLayers()) {
        clearMask();
        state.report = MRL.adjust.suggestCleanup(workCanvas).report;
        updateDetectChips();
        els.statusDims.textContent = workCanvas.width + " x " + workCanvas.height + " px";
        fitStage();
      }
      state.hasAlpha = scanAlpha();
      updateAlphaBadge();
      state.busy = false;
      updateHistoryButtons();
      updateRemoveUI();
      if (!state.busy) drawPreview();
    });
  }

  function doRedo() {
    if (state.busy || state.painting || !MRL.history.canRedo(history)) return;
    state.busy = true;
    updateHistoryButtons();
    MRL.history.redo(history, workCanvas, function (img, meta) {
      applyMeta(meta);
      if (resizeWorkspaceLayers()) {
        clearMask();
        state.report = MRL.adjust.suggestCleanup(workCanvas).report;
        updateDetectChips();
        els.statusDims.textContent = workCanvas.width + " x " + workCanvas.height + " px";
        fitStage();
      }
      state.hasAlpha = scanAlpha();
      updateAlphaBadge();
      state.busy = false;
      updateHistoryButtons();
      updateRemoveUI();
      if (!state.busy) drawPreview();
    });
  }

  function download() {
    if (!state.hasImage || state.busy) return;
    state.busy = true;
    updateHistoryButtons();
    updateRemoveUI();
    showLoader("Preparing download");
    nextFrame().then(function () {
      try {
        const w = workCanvas.width;
        const h = workCanvas.height;
        const img = workCtx.getImageData(0, 0, w, h);
        const out = MRL.adjust.render(img.data, w, h, state.adjust, state.cleanup);
        img.data.set(out);
        const exp = document.createElement("canvas");
        exp.width = w;
        exp.height = h;
        exp.getContext("2d").putImageData(img, 0, 0);
        exp.toBlob(function (blob) {
          hideLoader();
          state.busy = false;
          updateHistoryButtons();
          updateRemoveUI();
          if (!blob) {
            toast("Could not export the photo");
            return;
          }
          const a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = "memory-lane-restored.png";
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(function () {
            URL.revokeObjectURL(a.href);
          }, 4000);
          toast("Saved to your downloads");
        }, "image/png");
      } catch (err) {
        hideLoader();
        state.busy = false;
        updateHistoryButtons();
        updateRemoveUI();
        toast("Could not export the photo");
      }
    });
  }

  function brushPos(e) {
    const rect = els.brushLayer.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * maskCanvas.width,
      y: ((e.clientY - rect.top) / rect.height) * maskCanvas.height,
    };
  }

  function paintStroke(ctx, pos, first) {
    ctx.strokeStyle = "#ffffff";
    ctx.fillStyle = "#ffffff";
    ctx.lineWidth = state.brushSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (first) {
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, state.brushSize / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(state.lastX, state.lastY);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    }
    state.lastX = pos.x;
    state.lastY = pos.y;
  }

  function strokeTo(pos, first) {
    paintStroke(maskCtx, pos, first);
    state.maskPainted = true;
    refreshOverlay();
    updateRemoveUI();
  }

  function restoreStrokeTo(pos, first) {
    tmpCtx.save();
    tmpCtx.globalCompositeOperation = "source-over";
    tmpCtx.clearRect(0, 0, tmpCanvas.width, tmpCanvas.height);
    tmpCtx.drawImage(originalCanvas, 0, 0);
    tmpCtx.globalCompositeOperation = "destination-in";
    paintStroke(tmpCtx, pos, first);
    tmpCtx.restore();
    workCtx.drawImage(tmpCanvas, 0, 0);
    state.restoreUsed = true;
    renderPreview();
  }

  function tolThreshold() {
    return 28; // fixed wand sensitivity (Tolerance sliders were removed)
  }

  function wandSelect(pos) {
    const w = workCanvas.width;
    const h = workCanvas.height;
    const img = workCtx.getImageData(0, 0, w, h);
    const m = MRL.inpaint.floodFromSeed(img, pos.x, pos.y, tolThreshold());
    const md = tmpMaskCtx.createImageData(w, h);
    for (let p = 0; p < m.length; p++) {
      if (m[p]) {
        md.data[p * 4] = 255;
        md.data[p * 4 + 1] = 255;
        md.data[p * 4 + 2] = 255;
        md.data[p * 4 + 3] = 255;
      }
    }
    tmpMaskCtx.clearRect(0, 0, w, h);
    tmpMaskCtx.putImageData(md, 0, 0);
    maskCtx.drawImage(tmpMaskCanvas, 0, 0);
    state.maskPainted = true;
    refreshOverlay();
    updateRemoveUI();
  }

  /* ---- manual transparency cut-out (background removal by hand) ---- */
  // Brush: paints the stroke onto tmpCanvas, then subtracts it from the
  // working canvas with "destination-out" - stroked pixels lose their
  // alpha (the anti-aliased stroke rim gives a soft edge for free).
  function eraseStrokeTo(pos, first) {
    tmpCtx.save();
    tmpCtx.globalCompositeOperation = "source-over";
    tmpCtx.clearRect(0, 0, tmpCanvas.width, tmpCanvas.height);
    paintStroke(tmpCtx, pos, first);
    tmpCtx.restore();
    if (state.bgFill === "white") {
      // The stroke is painted white, so drawing it back on gives a pure
      // white fill instead of punching a hole.
      workCtx.save();
      workCtx.globalCompositeOperation = "source-over";
      workCtx.drawImage(tmpCanvas, 0, 0);
      workCtx.restore();
    } else {
      workCtx.save();
      workCtx.globalCompositeOperation = "destination-out";
      workCtx.drawImage(tmpCanvas, 0, 0);
      workCtx.restore();
    }
    renderPreview();
  }

  // Softens the hard edge a wand erase leaves behind: boundary pixels of
  // the erased region get the average alpha of their 3x3 neighbourhood.
  function softenErasedEdge(d, w, h, mask) {
    const copy = new Uint8ClampedArray(d);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const p = y * w + x;
        if (!mask[p]) continue;
        const boundary =
          (x > 0 && !mask[p - 1]) || (x < w - 1 && !mask[p + 1]) ||
          (y > 0 && !mask[p - w]) || (y < h - 1 && !mask[p + w]);
        if (!boundary) continue;
        let sum = 0;
        let c = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= h) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            if (xx < 0 || xx >= w) continue;
            sum += copy[(yy * w + xx) * 4 + 3];
            c++;
          }
        }
        d[p * 4 + 3] = Math.round(sum / c);
      }
    }
  }

  // White-fill counterpart of softenErasedEdge: the boundary pixels of the
  // filled region mix the fill colour with the surrounding subject colours
  // so the cut edge blends instead of ending in a hard white line.
  function softenFilledEdge(d, w, h, mask, r, g, b) {
    const copy = new Uint8ClampedArray(d);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const p = y * w + x;
        if (!mask[p]) continue;
        const boundary =
          (x > 0 && !mask[p - 1]) || (x < w - 1 && !mask[p + 1]) ||
          (y > 0 && !mask[p - w]) || (y < h - 1 && !mask[p + w]);
        if (!boundary) continue;
        let sr = 0;
        let sg = 0;
        let sb = 0;
        let c = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= h) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            if (xx < 0 || xx >= w) continue;
            const q = (yy * w + xx) * 4;
            sr += copy[q];
            sg += copy[q + 1];
            sb += copy[q + 2];
            c++;
          }
        }
        if (!c) continue;
        const o = p * 4;
        d[o] = Math.round((d[o] + sr / c) / 2);
        d[o + 1] = Math.round((d[o + 1] + sg / c) / 2);
        d[o + 2] = Math.round((d[o + 2] + sb / c) / 2);
      }
    }
  }

  // Wand: floods connected pixels within the fixed sensitivity threshold
  // from the clicked point and erases them — to transparency, or to pure
  // white when the white fill option is picked — then feathers the edge.
  function wandErase(pos) {
    const w = workCanvas.width;
    const h = workCanvas.height;
    const img = workCtx.getImageData(0, 0, w, h);
    const m = MRL.inpaint.floodFromSeed(img, pos.x, pos.y, tolThreshold());
    let any = false;
    const white = state.bgFill === "white";
    for (let p = 0; p < m.length; p++) {
      if (m[p]) {
        if (white) {
          img.data[p * 4] = 255;
          img.data[p * 4 + 1] = 255;
          img.data[p * 4 + 2] = 255;
        } else {
          img.data[p * 4 + 3] = 0;
        }
        any = true;
      }
    }
    if (!any) {
      toast("Nothing to erase at that spot");
      return;
    }
    if (white) softenFilledEdge(img.data, w, h, m, 255, 255, 255);
    else softenErasedEdge(img.data, w, h, m);
    workCtx.putImageData(img, 0, 0);
    state.hasAlpha = scanAlpha();
    updateAlphaBadge();
    MRL.history.push(history, workCanvas, state.hasAlpha, currentMeta());
    updateHistoryButtons();
    renderPreview();
  }

  function removeSelection() {
    if (state.busy || !state.hasImage || !state.maskPainted) return;
    state.busy = true;
    updateRemoveUI();
    updateHistoryButtons();
    showLoader("Rebuilding the background");
    nextFrame()
      .then(function () {
        const img = workCtx.getImageData(0, 0, workCanvas.width, workCanvas.height);
        const mk = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
        return MRL.inpaint.run(img, mk).then(function (n) {
          return { n: n, img: img };
        });
      })
      .then(function (res) {
        if (res.n === -1) {
          toast("Selection is too large — brush smaller areas");
        } else if (res.n === 0) {
          toast("Paint over the object you want to remove first");
        } else {
          workCtx.putImageData(res.img, 0, 0);
          MRL.history.push(history, workCanvas, state.hasAlpha, currentMeta());
          updateHistoryButtons();
          clearMask();
          drawPreview();
          toast("Object erased — the area behind it was rebuilt");
        }
        hideLoader();
        state.busy = false;
        updateRemoveUI();
        updateHistoryButtons();
      })
      .catch(function () {
        hideLoader();
        state.busy = false;
        updateRemoveUI();
        updateHistoryButtons();
        toast("Something went wrong while removing");
      });
  }

  // Background Erase: punches the current selection (painted with the
  // Remove object Brush/Wand) straight to transparency and feathers the
  // cut edge. Same flow as removeSelection, minus the inpainting.
  function eraseSelectionToTransparent() {
    if (state.busy || !state.hasImage || !state.maskPainted) return;
    state.busy = true;
    updateRemoveUI();
    updateHistoryButtons();
    showLoader("Erasing the selection");
    nextFrame()
      .then(function () {
        const w = workCanvas.width;
        const h = workCanvas.height;
        const img = workCtx.getImageData(0, 0, w, h);
        const mk = maskCtx.getImageData(0, 0, w, h).data;
        const m = new Uint8Array(w * h);
        const white = state.bgFill === "white";
        let any = false;
        for (let p = 0; p < w * h; p++) {
          if (mk[p * 4 + 3] > 127) {
            m[p] = 1;
            if (white) {
              img.data[p * 4] = 255;
              img.data[p * 4 + 1] = 255;
              img.data[p * 4 + 2] = 255;
            } else {
              img.data[p * 4 + 3] = 0;
            }
            any = true;
          }
        }
        if (!any) {
          toast("Paint over the background you want to erase first");
        } else {
          if (white) softenFilledEdge(img.data, w, h, m, 255, 255, 255);
          else softenErasedEdge(img.data, w, h, m);
          workCtx.putImageData(img, 0, 0);
          state.hasAlpha = scanAlpha();
          updateAlphaBadge();
          MRL.history.push(history, workCanvas, state.hasAlpha, currentMeta());
          updateHistoryButtons();
          clearMask();
          drawPreview();
          toast(white ? "Selection erased to white" : "Selection erased to transparency");
        }
        hideLoader();
        state.busy = false;
        updateRemoveUI();
        updateHistoryButtons();
      })
      .catch(function () {
        hideLoader();
        state.busy = false;
        updateRemoveUI();
        updateHistoryButtons();
        toast("Something went wrong while erasing");
      });
  }

  function removeBackground() {
    if (state.busy || !state.hasImage) return;
    if (!(window.MRL && MRL.bgremove)) {
      toast("Background remover failed to load");
      return;
    }
    state.busy = true;
    updateRemoveUI();
    updateHistoryButtons();
    showLoader("Detecting the background");
    nextFrame()
      .then(function () {
        const img = workCtx.getImageData(0, 0, workCanvas.width, workCanvas.height);
        return MRL.bgremove.autoRemove(img, { fill: state.bgFill });
      })
      .then(function (res) {
        if (!res || res.removedRatio > 0.97) {
          toast("Couldn't isolate a background — try a photo with a clearer backdrop");
        } else if (res.removedRatio < 0.004) {
          toast("No border-connected background found to remove");
        } else {
          workCtx.putImageData(new ImageData(res.data, res.width, res.height), 0, 0);
          state.hasAlpha = scanAlpha();
          updateAlphaBadge();
          MRL.history.push(history, workCanvas, state.hasAlpha, currentMeta());
          updateHistoryButtons();
          clearMask();
          drawPreview();
          toast(state.bgFill === "white"
            ? "Background replaced with white — Download saves the PNG"
            : "Background removed — Download saves the transparent PNG");
        }
        hideLoader();
        state.busy = false;
        updateRemoveUI();
        updateHistoryButtons();
      })
      .catch(function () {
        hideLoader();
        state.busy = false;
        updateRemoveUI();
        updateHistoryButtons();
        toast("Something went wrong while removing the background");
      });
  }

  function moveCursor(e) {
    if (state.mode !== "remove" || !state.hasImage || state.tool === "wand") {
      hideCursor();
      return;
    }
    const wrapRect = els.stageWrap.getBoundingClientRect();
    const rect = els.brushLayer.getBoundingClientRect();
    const size = Math.max(8, state.brushSize * (rect.width / maskCanvas.width));
    els.brushCursor.style.width = size + "px";
    els.brushCursor.style.height = size + "px";
    els.brushCursor.style.left = e.clientX - wrapRect.left + "px";
    els.brushCursor.style.top = e.clientY - wrapRect.top + "px";
    els.brushCursor.classList.add("show");
  }

  function hideCursor() {
    els.brushCursor.classList.remove("show");
  }

  function updateBrushDot() {
    const d = Math.max(8, Math.min(56, state.brushSize * 0.55));
    els.brushDot.style.width = d + "px";
    els.brushDot.style.height = d + "px";
    els.brushSizeValue.textContent = String(state.brushSize);
    setFill(els.brushSizeRange);
  }

  function wireEvents() {
    els.btnUpload.addEventListener("click", function (e) {
      e.stopPropagation();
      els.fileInput.click();
    });
    els.dropZone.addEventListener("click", function () {
      els.fileInput.click();
    });
    els.fileInput.addEventListener("change", function () {
      if (els.fileInput.files && els.fileInput.files[0]) {
        handleFile(els.fileInput.files[0]);
        els.fileInput.value = "";
      }
    });

    ["dragenter", "dragover"].forEach(function (ev) {
      els.dropZone.addEventListener(ev, function (e) {
        e.preventDefault();
        els.dropZone.classList.add("dragover");
      });
      els.stageWrap.addEventListener(ev, function (e) {
        e.preventDefault();
      });
    });
    ["dragleave", "drop"].forEach(function (ev) {
      els.dropZone.addEventListener(ev, function (e) {
        e.preventDefault();
        els.dropZone.classList.remove("dragover");
      });
    });
    els.stageWrap.addEventListener("drop", function (e) {
      e.preventDefault();
      if (state.busy) {
        toast("Give the photo a moment — still restoring");
        return;
      }
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFile(e.dataTransfer.files[0]);
      }
    });

    els.btnAdjustReset.addEventListener("click", resetAdjustments);
    els.btnReset.addEventListener("click", resetAll);
    els.btnUndo.addEventListener("click", doUndo);
    els.btnRedo.addEventListener("click", doRedo);
    els.btnDownload.addEventListener("click", download);
    els.btnNewPhoto.addEventListener("click", newPhoto);

    els.btnBwRestore.addEventListener("click", function () {
      quickRestore("bw");
    });
    els.btnBlurRestore.addEventListener("click", autoEnhance);
    els.styleSegments.querySelectorAll(".style-btn").forEach(function (b) {
      b.addEventListener("click", function () {
        setColorStyle(b.dataset.style);
      });
    });

    els.colorizeRange.addEventListener("input", function () {
      state.cleanup.colorize = Number(els.colorizeRange.value);
      els.colorizeValue.textContent = els.colorizeRange.value;
      setFill(els.colorizeRange);
      syncColorizeUI();
      updateDetectChips();
      renderPreview();
    });
    els.colorizeRange.addEventListener("change", pushHistory);
    els.deblurRange.addEventListener("input", function () {
      state.cleanup.deblur = Number(els.deblurRange.value);
      els.deblurValue.textContent = els.deblurRange.value;
      setFill(els.deblurRange);
      updateDetectChips();
      renderPreview();
    });
    els.deblurRange.addEventListener("change", pushHistory);
    els.detailRange.addEventListener("input", function () {
      state.cleanup.detail = Number(els.detailRange.value);
      els.detailValue.textContent = els.detailRange.value;
      setFill(els.detailRange);
      renderPreview();
    });
    els.detailRange.addEventListener("change", pushHistory);

    els.noiseRange.addEventListener("input", function () {
      state.cleanup.noise = Number(els.noiseRange.value);
      els.noiseValue.textContent = els.noiseRange.value;
      setFill(els.noiseRange);
      renderPreview();
    });
    els.noiseRange.addEventListener("change", pushHistory);
    els.sharpenRange.addEventListener("input", function () {
      state.cleanup.sharpen = Number(els.sharpenRange.value);
      els.sharpenValue.textContent = els.sharpenRange.value;
      setFill(els.sharpenRange);
      renderPreview();
    });
    els.sharpenRange.addEventListener("change", pushHistory);

    els.brushSizeRange.addEventListener("input", function () {
      state.brushSize = Number(els.brushSizeRange.value);
      updateBrushDot();
      syncBgSliders();
    });
    els.bgBrushSizeRange.addEventListener("input", function () {
      state.brushSize = Number(els.bgBrushSizeRange.value);
      updateBrushDot();
      els.brushSizeRange.value = String(state.brushSize);
      els.brushSizeValue.textContent = String(state.brushSize);
      setFill(els.brushSizeRange);
      els.bgBrushSizeValue.textContent = String(state.brushSize);
      setFill(els.bgBrushSizeRange);
    });

    document.querySelectorAll("#panel-remove .tool-btn").forEach(function (b) {
      b.addEventListener("click", function () {
        setTool(b.dataset.tool);
      });
    });
    document.querySelectorAll("#panel-remove .btool-btn").forEach(function (b) {
      b.addEventListener("click", function () {
        setBTool(b.dataset.btool);
      });
    });

  els.btnFillSel.addEventListener("click", removeSelection);
  els.btnClearSel.addEventListener("click", clearMask);
  els.btnRemoveBg.addEventListener("click", removeBackground);
  els.btnBgErase.addEventListener("click", eraseSelectionToTransparent);

  document.querySelectorAll(".mode-tab").forEach(function (t) {
    t.addEventListener("click", function () {
      if (t.dataset.mode === state.mode) return;
      // Switching between Restore and Remove starts fresh: the attached
      // photo is cleared so a new one can be attached for that mode.
      if (state.hasImage) {
        resetWorkspace();
      }
      setMode(t.dataset.mode);
    });
  });

  // Background fill option: transparent or pure white.
  document.querySelectorAll("#panel-remove .bg-fill-btn").forEach(function (b) {
    b.addEventListener("click", function () {
      state.bgFill = b.dataset.fill === "white" ? "white" : "transparent";
      document.querySelectorAll("#panel-remove .bg-fill-btn").forEach(function (x) {
        const on = x.dataset.fill === state.bgFill;
        x.classList.toggle("active", on);
        x.setAttribute("aria-pressed", on ? "true" : "false");
      });
      updateStatusHint();
      toast(state.bgFill === "white"
        ? "Background fill: pure white"
        : "Background fill: transparent");
    });
  });

    els.brushLayer.addEventListener("pointerdown", function (e) {
      if (e.button !== 0 || state.mode !== "remove" || !state.hasImage || state.busy) return;
      e.preventDefault();
      const pos = brushPos(e);
      if (state.btool === "brush") {
        els.brushLayer.setPointerCapture(e.pointerId);
        state.painting = true;
        eraseStrokeTo(pos, true);
        return;
      }
      if (state.btool === "wand") {
        wandErase(pos);
        return;
      }
      if (state.tool === "brush") {
        els.brushLayer.setPointerCapture(e.pointerId);
        state.painting = true;
        strokeTo(pos, true);
      } else if (state.tool === "restore") {
        els.brushLayer.setPointerCapture(e.pointerId);
        state.painting = true;
        restoreStrokeTo(pos, true);
      } else if (state.tool === "wand") {
        wandSelect(pos);
      }
    });
    els.brushLayer.addEventListener("pointermove", function (e) {
      moveCursor(e);
      if (!state.painting) return;
      const pos = brushPos(e);
      if (state.btool === "brush") {
        eraseStrokeTo(pos, false);
      } else if (state.tool === "brush") {
        strokeTo(pos, false);
      } else if (state.tool === "restore") {
        restoreStrokeTo(pos, false);
      }
    });
    ["pointerup", "pointercancel"].forEach(function (ev) {
      els.brushLayer.addEventListener(ev, function () {
        if (state.painting && state.btool === "brush") {
          state.hasAlpha = scanAlpha();
          updateAlphaBadge();
          MRL.history.push(history, workCanvas, state.hasAlpha, currentMeta());
          updateHistoryButtons();
        }
        if (state.painting && state.tool === "restore" && state.restoreUsed) {
          MRL.history.push(history, workCanvas, state.hasAlpha, currentMeta());
          updateHistoryButtons();
        }
        state.painting = false;
      });
    });
    els.brushLayer.addEventListener("pointerenter", moveCursor);
    els.brushLayer.addEventListener("pointerleave", hideCursor);

    els.btnCompare.addEventListener("click", function () {
      if (!state.hasImage) {
        toast("Attach a photo first, then compare");
        return;
      }
      state.compareOn = !state.compareOn;
      applyCompareVisibility();
      toast(state.compareOn ? "Comparison on — drag the handle" : "Comparison off");
    });

    function splitFromEvent(e) {
      const rect = els.stage.getBoundingClientRect();
      if (!rect.width) return state.split;
      return ((e.clientX - rect.left) / rect.width) * 100;
    }

    els.compareDivider.addEventListener("pointerdown", function (e) {
      if (!state.hasImage || state.mode !== "restore" || state.busy) return;
      e.preventDefault();
      e.stopPropagation();
      setSplit(splitFromEvent(e));
      els.compareDivider.focus();
      els.compareDivider.setPointerCapture(e.pointerId);
      state.draggingSplit = true;
    });
    els.compareDivider.addEventListener("pointermove", function (e) {
      if (!state.draggingSplit) return;
      setSplit(splitFromEvent(e));
    });
    ["pointerup", "pointercancel"].forEach(function (ev) {
      els.compareDivider.addEventListener(ev, function () {
        state.draggingSplit = false;
      });
    });
    els.compareDivider.addEventListener("keydown", function (e) {
      const step = e.shiftKey ? 10 : 2;
      if (e.key === "ArrowLeft") {
        setSplit(state.split - step);
        e.preventDefault();
      } else if (e.key === "ArrowRight") {
        setSplit(state.split + step);
        e.preventDefault();
      } else if (e.key === "Home") {
        setSplit(0);
        e.preventDefault();
      } else if (e.key === "End") {
        setSplit(100);
        e.preventDefault();
      }
    });

    els.stage.addEventListener("pointerdown", function (e) {
      if (!state.hasImage || state.mode !== "restore" || state.busy) return;
      if (e.target === els.compareDivider || els.compareDivider.contains(e.target)) return;
      if (!state.compareOn) return;
      setSplit(splitFromEvent(e));
    });

    function showOriginal() {
      if (!state.hasImage) return;
      els.stage.classList.add("compare-full");
      els.btnPeek.classList.add("holding");
    }
    function hideOriginal() {
      els.stage.classList.remove("compare-full");
      els.btnPeek.classList.remove("holding");
    }
    els.btnPeek.addEventListener("pointerdown", function (e) {
      e.preventDefault();
      showOriginal();
    });
    ["pointerup", "pointerleave", "pointercancel"].forEach(function (ev) {
      els.btnPeek.addEventListener(ev, hideOriginal);
    });
    els.btnPeek.addEventListener("keydown", function (e) {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        showOriginal();
      }
    });
    els.btnPeek.addEventListener("keyup", hideOriginal);
    els.btnPeek.addEventListener("blur", hideOriginal);

    els.sidebarToggle.addEventListener("click", function () {
      els.sidebar.classList.toggle("collapsed");
    });

    // In the React SPA the editor can mount more than once per page load.
    // Remove the previous global handlers so shortcuts never double-fire
    // and never point at detached DOM from an earlier mount.
    if (window.__mrlEditorKeydown) {
      window.removeEventListener("keydown", window.__mrlEditorKeydown);
    }
    if (window.__mrlEditorResize) {
      window.removeEventListener("resize", window.__mrlEditorResize);
    }

    window.__mrlEditorKeydown = function (e) {
      if (!(e.ctrlKey || e.metaKey)) {
        if (state.mode === "remove" && (e.key === "[" || e.key === "]")) {
          const step = e.key === "[" ? -4 : 4;
          state.brushSize = Math.max(6, Math.min(140, state.brushSize + step));
          els.brushSizeRange.value = String(state.brushSize);
          updateBrushDot();
        }
        return;
      }
      if (e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        doUndo();
      } else if (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey)) {
        e.preventDefault();
        doRedo();
      }
    };
    window.addEventListener("keydown", window.__mrlEditorKeydown);

    let resizeTimer = null;
    window.__mrlEditorResize = function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(fitStage, 150);
    };
    window.addEventListener("resize", window.__mrlEditorResize);
  }

  buildToneSliders();
  syncSliders();
  updateBrushDot();
  setTool("brush");
  setMode("restore");
  if (window.matchMedia && window.matchMedia("(max-width: 640px)").matches) {
    els.sidebar.classList.add("collapsed");
  }
  wireEvents();

  function paintDemoSelection() {
    const w = maskCanvas.width;
    const h = maskCanvas.height;
    maskCtx.fillStyle = "#ffffff";
    maskCtx.beginPath();
    maskCtx.ellipse(w * 0.36, h * 0.72, w * 0.075, h * 0.055, -0.3, 0, Math.PI * 2);
    maskCtx.fill();
    maskCtx.beginPath();
    maskCtx.ellipse(w * 0.4, h * 0.75, w * 0.05, h * 0.04, 0.2, 0, Math.PI * 2);
    maskCtx.fill();
    state.maskPainted = true;
    refreshOverlay();
    updateRemoveUI();
  }

  function runDemoSequence() {
    const hash = location.hash;
    if (hash !== "#demo-enhance" && hash !== "#demo-select" && hash !== "#demo-bw" && hash !== "#demo-blur") return;
    setTimeout(function () {
      if (hash === "#demo-bw") {
        loadSampleBw();
      } else if (hash === "#demo-blur") {
        loadSampleBlur();
      } else {
        loadSample();
      }
      setTimeout(function () {
        if (hash === "#demo-enhance") {
          state.cleanup.sharpen = 22;
          syncSliders();
          drawPreview();
        }
        if (hash === "#demo-select") {
          setMode("remove");
          setTimeout(paintDemoSelection, 300);
        }
      }, 600);
    }, 150);
  }

  runDemoSequence();

  // Expose an API so the React topbar can drive the editor.
  window.MRL.editorAPI = {
    setMode: function (mode) { setMode(mode); },
    autoFixBlurry: function () { if (!els.btnBlurRestore.disabled) autoEnhance(); },
    restoreBw: function () { if (!els.btnBwRestore.disabled) quickRestore("bw"); },
    removeBackground: function () { if (!els.btnRemoveBg.disabled) removeBackground(); },
    hasImage: function () { return !!state.hasImage; },
    hint: function (msg) { toast(msg); },
  };
};
