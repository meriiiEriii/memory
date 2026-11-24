var G = typeof window !== "undefined" ? window : globalThis;

G.MRL = G.MRL || {};

G.MRL.aiRestore = (function () {
  "use strict";

  const ORT_JS = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.3/dist/ort.min.js";
  const WASM_PATHS = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.3/dist/";
  const MODEL_URL = "https://huggingface.co/Xenova/swin2SR-lightweight-x2-64/resolve/main/onnx/model_quantized.onnx";
  const CACHE_NAME = "mrl-ai-restore-v1";
  const CACHE_KEY = "model-swin2sr-lightweight-x2-q8";
  const TILE = 256;
  const OVERLAP = 8;
  const SCALE = 2;
  const MAX_SIDE_GPU = 960;
  const MAX_SIDE_WASM = 384;

  let state = "idle";
  let session = null;
  let loadPromise = null;
  let loadProgressCallback = null;
  let lastSource = "";
  let preferWebgpu = typeof navigator !== "undefined" && !!navigator.gpu;
  let sessionIsWebgpu = false;
  let outputScale = 1;
  let scaleChecked = false;

  function status() {
    return state;
  }

  function loadSource() {
    return lastSource;
  }

  function backend() {
    if (!session) return "";
    return sessionIsWebgpu ? "gpu" : "cpu";
  }

  function preload() {
    return load(null).catch(function () { return false; });
  }

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function makeCanvas(w, h) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
  }

  function ensureOrt() {
    if (window.ort) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      const s = document.createElement("script");
      s.src = ORT_JS;
      s.crossOrigin = "anonymous";
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error("runtime-load-failed")); };
      document.head.appendChild(s);
    });
  }

  function fetchWithProgress(url, onProgress) {
    return fetch(url).then(function (res) {
      if (!res.ok) throw new Error("model-http-" + res.status);
      const total = Number(res.headers.get("content-length")) || 0;
      if (!res.body || !res.body.getReader) {
        return res.arrayBuffer().then(function (b) {
          if (onProgress) onProgress(1);
          return b;
        });
      }
      const reader = res.body.getReader();
      const chunks = [];
      let received = 0;
      function step() {
        return reader.read().then(function (r) {
          if (r.done) {
            let len = 0;
            for (let i = 0; i < chunks.length; i++) len += chunks[i].length;
            const buf = new Uint8Array(len);
            let off = 0;
            for (let i = 0; i < chunks.length; i++) {
              buf.set(chunks[i], off);
              off += chunks[i].length;
            }
            if (onProgress) onProgress(1);
            return buf.buffer;
          }
          chunks.push(r.value);
          received += r.value.length;
          if (onProgress && total) onProgress(Math.min(1, received / total));
          return step();
        });
      }
      return step();
    });
  }

  // Model caching: after the first successful download the model is stored
  // in the browser's Cache Storage, so every later session loads instantly
  // with zero network traffic. Falls back to plain download when Cache
  // Storage is unavailable (e.g. some file:// contexts).
  function openModelCache() {
    if (typeof caches === "undefined") return Promise.resolve(null);
    return caches.open(CACHE_NAME).catch(function () { return null; });
  }

  function downloadAndStore(cache, onProgress) {
    lastSource = "network";
    return fetchWithProgress(MODEL_URL, onProgress).then(function (buf) {
      if (cache) {
        cache
          .put(CACHE_KEY, new Response(buf.slice(0), { headers: { "Content-Type": "application/octet-stream" } }))
          .catch(function () { });
      }
      return buf;
    });
  }

  function fetchModelCached(onProgress) {
    return openModelCache().then(function (cache) {
      if (!cache) return downloadAndStore(null, onProgress);
      return cache
        .match(CACHE_KEY)
        .then(function (hit) {
          if (hit) {
            lastSource = "cache";
            if (onProgress) onProgress(1);
            return hit.arrayBuffer();
          }
          return downloadAndStore(cache, onProgress);
        })
        .catch(function () { return downloadAndStore(cache, onProgress); });
    });
  }

  function createSession(buf) {
    scaleChecked = false;
    outputScale = 1;

    function build(providerList) {
      // Run the WASM runtime inside a dedicated worker so session.run()
      // never blocks the main thread — without this, every tile freezes the
      // UI for seconds and Chrome shows the "page unresponsive" dialog.
      ort.env.wasm.proxy = true;
      return ort.InferenceSession.create(buf, {
        executionProviders: providerList,
        graphOptimizationLevel: "all",
      });
    }

    function validate(s, providerList) {
      if (providerList[0] !== "webgpu") {
        sessionIsWebgpu = false;
        return s;
      }
      const probe = new ort.Tensor("float32", new Float32Array(3 * 64 * 64), [1, 3, 64, 64]);
      const feeds = {};
      feeds[s.inputNames[0]] = probe;
      return s.run(feeds).then(function () {
        sessionIsWebgpu = true;
        return s;
      }).catch(function () {
        sessionIsWebgpu = false;
        preferWebgpu = false;
        return build(["wasm"]).then(function (s2) {
          return validate(s2, ["wasm"]);
        });
      });
    }

    const providers = preferWebgpu ? ["webgpu", "wasm"] : ["wasm"];
    return build(providers)
      .then(function (s) {
        return validate(s, providers);
      })
      .catch(function () {
        // Proxy worker unavailable (strict environment) — fall back to the
        // main-thread runtime so the AI still works, just with UI jank.
        ort.env.wasm.proxy = false;
        const fallbackProviders = preferWebgpu ? ["webgpu", "wasm"] : ["wasm"];
        return build(fallbackProviders).then(function (s) {
          return validate(s, fallbackProviders);
        });
      });
  }

  function load(onProgress) {
    if (state === "ready" && session) return Promise.resolve();
    if (onProgress) loadProgressCallback = onProgress;
    if (loadPromise) return loadPromise;
    loadProgressCallback = onProgress || null;
    state = "loading";
    loadPromise = Promise.all([
      ensureOrt().then(function () {
        ort.env.wasm.wasmPaths = WASM_PATHS;
        const cores = (navigator.hardwareConcurrency || 2) - 1;
        ort.env.wasm.numThreads = Math.max(1, Math.min(4, cores));
        ort.env.wasm.simd = true;
      }),
      fetchModelCached(function (progress) {
        if (loadProgressCallback) loadProgressCallback(progress);
      }),
    ])
      .then(function (results) {
        return createSession(results[1]);
      })
      .then(function (s) {
        session = s;
        state = "ready";
        loadProgressCallback = null;
        return true;
      })
      .catch(function (e) {
        state = "idle";
        loadPromise = null;
        session = null;
        loadProgressCallback = null;
        throw e;
      });
    return loadPromise;
  }

  function toWorking(srcCanvas, maxSide) {
    const iw = srcCanvas.width;
    const ih = srcCanvas.height;
    const k = Math.min(1, maxSide / Math.max(iw, ih));
    const sw = Math.max(16, Math.round(iw * k));
    const sh = Math.max(16, Math.round(ih * k));
    const c = makeCanvas(sw, sh);
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(srcCanvas, 0, 0, sw, sh);
    return c;
  }

  function buildPadded(srcCanvas, pw, ph) {
    const c = makeCanvas(pw, ph);
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(srcCanvas, 0, 0);
    if (pw > srcCanvas.width) {
      ctx.drawImage(c, srcCanvas.width - 1, 0, 1, ph, srcCanvas.width - 1, 0, pw - srcCanvas.width + 1, ph);
    }
    if (ph > srcCanvas.height) {
      ctx.drawImage(c, 0, srcCanvas.height - 1, pw, 1, 0, srcCanvas.height - 1, pw, ph - srcCanvas.height + 1);
    }
    return c;
  }

  function runTile(x0, y0, pdata, padW, onProgress, isCancelled, done, total) {
    if (isCancelled && isCancelled()) return Promise.reject(new Error("cancelled"));
    const inp = new Float32Array(3 * TILE * TILE);
    for (let y = 0; y < TILE; y++) {
      const rowBase = ((y0 + y) * padW + x0) * 4;
      for (let x = 0; x < TILE; x++) {
        const si = rowBase + x * 4;
        const di = y * TILE + x;
        inp[di] = pdata[si] / 255;
        inp[TILE * TILE + di] = pdata[si + 1] / 255;
        inp[2 * TILE * TILE + di] = pdata[si + 2] / 255;
      }
    }
    const tensor = new ort.Tensor("float32", inp, [1, 3, TILE, TILE]);
    const feeds = {};
    feeds[session.inputNames[0]] = tensor;
    return session.run(feeds).then(function (results) {
      const out = results[session.outputNames[0]];
      const oh = out.dims[2];
      const ow = out.dims[3];
      const od = out.data;
      // Some SR exports output 0..1 floats instead of 0..255 — detect the
      // range once from real values and normalize so the photo never turns
      // into a black rectangle.
      if (!scaleChecked) {
        let mx = 0;
        const sampleStep = Math.max(1, Math.floor(od.length / 4096));
        for (let i = 0; i < od.length; i += sampleStep) {
          if (od[i] > mx) mx = od[i];
        }
        outputScale = mx > 0 && mx <= 2 ? 255 : 1;
        scaleChecked = true;
      }
      const plane = ow * oh;
      const tileC = makeCanvas(ow, oh);
      const tctx = tileC.getContext("2d", { willReadFrequently: true });
      const timg = tctx.createImageData(ow, oh);
      for (let y = 0; y < oh; y++) {
        for (let x = 0; x < ow; x++) {
          const di = (y * ow + x) * 4;
          const si = y * ow + x;
          timg.data[di] = od[si] * outputScale;
          timg.data[di + 1] = od[plane + si] * outputScale;
          timg.data[di + 2] = od[2 * plane + si] * outputScale;
          timg.data[di + 3] = 255;
        }
      }
      tctx.putImageData(timg, 0, 0);
      if (onProgress) onProgress(done / total, "tiles");
      return tileC;
    });
  }

  function polish(canvas) {
    const w = canvas.width;
    const h = canvas.height;
    if (w < 3 || h < 3 || w * h > 9000000) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const img = ctx.getImageData(0, 0, w, h);
    const src = new Uint8ClampedArray(img.data);
    const tmp = new Float32Array(w * h * 3);
    for (let y = 0; y < h; y++) {
      const row = y * w;
      for (let x = 0; x < w; x++) {
        const i = (row + x) * 4;
        const xl = (x > 0 ? x - 1 : 0) + row;
        const xr = (x < w - 1 ? x + 1 : w - 1) + row;
        for (let c = 0; c < 3; c++) {
          tmp[(row + x) * 3 + c] = (src[xl * 4 + c] + src[i + c] + src[xr * 4 + c]) / 3;
        }
      }
    }
    const k = 0.4;
    for (let y = 0; y < h; y++) {
      const yu = (y > 0 ? y - 1 : 0) * w;
      const yc = y * w;
      const yd = (y < h - 1 ? y + 1 : h - 1) * w;
      for (let x = 0; x < w; x++) {
        const i = (yc + x) * 4;
        for (let c = 0; c < 3; c++) {
          const b = (tmp[yu * 3 + x * 3 + c] + tmp[yc * 3 + x * 3 + c] + tmp[yd * 3 + x * 3 + c]) / 3;
          img.data[i + c] = clamp(src[i + c] + k * (src[i + c] - b), 0, 255);
        }
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  function enhance(srcCanvas, onProgress, isCancelled) {
    function attempt() {
      if (isCancelled && isCancelled()) return Promise.reject(new Error("cancelled"));
      const maxSide = sessionIsWebgpu ? MAX_SIDE_GPU : MAX_SIDE_WASM;
      return load(function (p) {
        if (onProgress) onProgress(p, "model");
      }).then(function () {
        if (isCancelled && isCancelled()) throw new Error("cancelled");
        const iw = srcCanvas.width;
        const ih = srcCanvas.height;
        const k = Math.min(1, maxSide / Math.max(iw, ih));
        const working = toWorking(srcCanvas, maxSide);
        const sw = working.width;
        const sh = working.height;
        const padW = Math.max(sw, TILE);
        const padH = Math.max(sh, TILE);
        const padded = buildPadded(working, padW, padH);
        const pctx = padded.getContext("2d", { willReadFrequently: true });
        const pdata = pctx.getImageData(0, 0, padW, padH).data;
        const finalC = makeCanvas(iw, ih);
        const fctx = finalC.getContext("2d", { willReadFrequently: true });
        fctx.imageSmoothingEnabled = true;
        fctx.imageSmoothingQuality = "high";
        const step = TILE - OVERLAP * 2;
        const cols = Math.ceil(padW / step);
        const rows = Math.ceil(padH / step);
        const total = cols * rows;
        let done = 0;

        function tile(ti) {
          if (isCancelled && isCancelled()) return Promise.reject(new Error("cancelled"));
          const tx = ti % cols;
          const ty = (ti / cols) | 0;
          const x0 = Math.max(0, Math.min(tx * step - OVERLAP, padW - TILE));
          const y0 = Math.max(0, Math.min(ty * step - OVERLAP, padH - TILE));
          const ux = tx * step;
          const uy = ty * step;
          const uw = Math.min(step, sw - ux);
          const uh = Math.min(step, sh - uy);
          const pasteNeeded = uw > 0 && uh > 0;
          const run = pasteNeeded
            ? runTile(x0, y0, pdata, padW, onProgress, isCancelled, done + 1, total)
            : Promise.resolve(null);
          return run.then(function (tileC) {
            done++;
            if (tileC) {
              const lx0 = ux - x0;
              const ly0 = uy - y0;
              const dx0 = Math.round(ux / k);
              const dy0 = Math.round(uy / k);
              const dx1 = Math.round(Math.min(ux + step, sw) / k);
              const dy1 = Math.round(Math.min(uy + step, sh) / k);
              fctx.drawImage(
                tileC,
                lx0 * SCALE, ly0 * SCALE, uw * SCALE, uh * SCALE,
                dx0, dy0, dx1 - dx0, dy1 - dy0
              );
            }
            if (onProgress) onProgress(done / total, "tiles");
            if (ti + 1 < total) {
              return new Promise(function (res) { setTimeout(res, 0); }).then(function () {
                return tile(ti + 1);
              });
            }
            return null;
          });
        }

        return tile(0).then(function () {
          polish(finalC);
          fctx.globalCompositeOperation = "destination-in";
          fctx.drawImage(srcCanvas, 0, 0);
          fctx.globalCompositeOperation = "source-over";
          if (!resultLooksValid(finalC, srcCanvas)) {
            return null;
          }
          return finalC;
        });
      });
    }

    return attempt().catch(function (err) {
      if (err && err.message === "cancelled") throw err;
      if (sessionIsWebgpu) {
        // The GPU run failed (unsupported op etc.) — rebuild the session on
        // the slower WASM backend and try the whole pass once more.
        session = null;
        loadPromise = null;
        state = "idle";
        preferWebgpu = false;
        return load(null).then(attempt);
      }
      session = null;
      loadPromise = null;
      state = "idle";
      throw err;
    });
  }

  // Guards against ever replacing the photo with a blank/black result:
  // the AI output must be mostly opaque and not dramatically darker than
  // the source. Otherwise enhance() returns null and the caller keeps the
  // unmodified photo.
  function resultLooksValid(finalC, srcCanvas) {
    try {
      const w = finalC.width;
      const h = finalC.height;
      const fc = finalC.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, w, h).data;
      const sc = srcCanvas.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, w, h).data;
      let opaque = 0;
      let fl = 0;
      let sl = 0;
      let n = 0;
      for (let gy = 0; gy < 5; gy++) {
        for (let gx = 0; gx < 5; gx++) {
          const px = Math.floor((gx + 0.5) * w / 5);
          const py = Math.floor((gy + 0.5) * h / 5);
          const i = (py * w + px) * 4;
          if (fc[i + 3] > 200) opaque++;
          fl += 0.299 * fc[i] + 0.587 * fc[i + 1] + 0.114 * fc[i + 2];
          sl += 0.299 * sc[i] + 0.587 * sc[i + 1] + 0.114 * sc[i + 2];
          n++;
        }
      }
      if (!n) return false;
      if (opaque / n < 0.85) return false;
      const fm = fl / n;
      const sm = sl / n;
      return fm > Math.min(16, sm * 0.3);
    } catch (e) {
      return false;
    }
  }

  return {
    status: status,
    loadSource: loadSource,
    backend: backend,
    preload: preload,
    load: load,
    enhance: enhance,
    version: "1.2.0",
  };
})();
