window.MRL = window.MRL || {};

MRL.adjust = (function () {
  const PARAMS = [
    { key: "exposure", label: "Exposure", min: -100, max: 100, def: 0 },
    { key: "brightness", label: "Brightness", min: -100, max: 100, def: 0 },
    { key: "contrast", label: "Contrast", min: -100, max: 100, def: 0 },
    { key: "shadows", label: "Shadows", min: -100, max: 100, def: 0 },
    { key: "highlights", label: "Highlights", min: -100, max: 100, def: 0 },
    { key: "saturation", label: "Saturation", min: -100, max: 100, def: 0 },
    { key: "warmth", label: "Warmth", min: -100, max: 100, def: 0 },
  ];

  function defaults() {
    const out = {};
    PARAMS.forEach(function (p) {
      out[p.key] = p.def;
    });
    return out;
  }

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function buildLUTs(a) {
    const lut = { r: new Uint8ClampedArray(256), g: new Uint8ClampedArray(256), b: new Uint8ClampedArray(256) };
    const expGain = Math.pow(2, a.exposure / 190);
    const brightOff = a.brightness * 0.62;
    const conK = 1 + a.contrast / 130;
    const shK = a.shadows / 100;
    const hiK = a.highlights / 100;
    const warmR = a.warmth * 0.32;
    const warmB = -a.warmth * 0.32;
    for (let v = 0; v < 256; v++) {
      const x = v / 255;
      let y = x;
      y = clamp(y * expGain, 0, 1);
      const sc = clamp((y - 0.5) * conK + 0.5, 0, 1);
      let shadow = 0;
      if (shK !== 0) {
        const w = Math.pow(1 - sc, 2);
        shadow = shK > 0 ? shK * w * 0.55 : shK * w * 0.28 * sc;
      }
      let high = 0;
      if (hiK !== 0) {
        const w = Math.pow(sc, 1.7);
        high = hiK > 0 ? hiK * (1 - w) * 0.9 : hiK * w * 0.9;
      }
      let s = sc + shadow + high;
      s += brightOff / 255;
      s = clamp(s, 0, 1);
      const base = s * 255;
      lut.r[v] = base + warmR;
      lut.g[v] = base;
      lut.b[v] = base + warmB;
    }
    return lut;
  }

  function medianPass(d, strength, w, h) {
    if (strength <= 0) return;
    const src = new Uint8ClampedArray(d);
    const nine = new Uint8Array(9);
    const mix = clamp(strength, 0, 1);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        for (let c = 0; c < 3; c++) {
          let n = 0;
          for (let dy = -1; dy <= 1; dy++) {
            const yy = clamp(y + dy, 0, h - 1);
            for (let dx = -1; dx <= 1; dx++) {
              const xx = clamp(x + dx, 0, w - 1);
              nine[n++] = src[(yy * w + xx) * 4 + c];
            }
          }
          for (let i = 1; i < 9; i++) {
            const key = nine[i];
            let j = i - 1;
            while (j >= 0 && nine[j] > key) {
              nine[j + 1] = nine[j];
              j--;
            }
            nine[j + 1] = key;
          }
          d[idx + c] = src[idx + c] + (nine[4] - src[idx + c]) * mix;
        }
      }
    }
  }

  // Edge-preserving bilateral filter: reduces noise while keeping edges sharp
  function bilateralPass(d, strength, w, h) {
    if (strength <= 0) return;
    const src = new Uint8ClampedArray(d);
    const sigmaS = 1.5;
    const sigmaR = 40 * strength;
    const r = 2;
    const sgs = new Float32Array((2 * r + 1) * (2 * r + 1));
    let si = 0;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        sgs[si++] = Math.exp(-(dx * dx + dy * dy) / (2 * sigmaS * sigmaS));
      }
    }
    const mix = clamp(strength, 0, 1);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const sr = src[idx];
        const sg = src[idx + 1];
        const sb = src[idx + 2];
        let wr = 0, wg = 0, wb = 0, wrSum = 0, wgSum = 0, wbSum = 0;
        let si2 = 0;
        for (let dy = -r; dy <= r; dy++) {
          const yy = clamp(y + dy, 0, h - 1);
          for (let dx = -r; dx <= r; dx++) {
            const xx = clamp(x + dx, 0, w - 1);
            const nidx = (yy * w + xx) * 4;
            const dr = src[nidx] - sr;
            const dg = src[nidx + 1] - sg;
            const db = src[nidx + 2] - sb;
            const gR = Math.exp(-(dr * dr + dg * dg + db * db) / (2 * sigmaR * sigmaR));
            const weight = sgs[si2++] * gR;
            wr += src[nidx] * weight; wrSum += weight;
            wg += src[nidx + 1] * weight; wgSum += weight;
            wb += src[nidx + 2] * weight; wbSum += weight;
          }
        }
        d[idx] = src[idx] + (wr / Math.max(wrSum, 1) - src[idx]) * mix;
        d[idx + 1] = src[idx + 1] + (wg / Math.max(wgSum, 1) - src[idx + 1]) * mix;
        d[idx + 2] = src[idx + 2] + (wb / Math.max(wbSum, 1) - src[idx + 2]) * mix;
      }
    }
  }

  function boxBlur3(src, w, h) {
    const tmp = new Uint8ClampedArray(src.length);
    const out = new Uint8ClampedArray(src.length);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        for (let c = 0; c < 3; c++) {
          const x0 = clamp(x - 1, 0, w - 1);
          const x2 = clamp(x + 1, 0, w - 1);
          const row = y * w;
          tmp[idx + c] =
            (src[(row + x0) * 4 + c] + src[(row + x) * 4 + c] + src[(row + x2) * 4 + c]) / 3;
        }
      }
    }
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        for (let c = 0; c < 3; c++) {
          const y0 = clamp(y - 1, 0, h - 1);
          const y2 = clamp(y + 1, 0, h - 1);
          out[idx + c] =
            (tmp[(y0 * w + x) * 4 + c] + tmp[idx + c] + tmp[(y2 * w + x) * 4 + c]) / 3;
        }
      }
    }
    return out;
  }

  function sharpenPass(d, amount, w, h) {
    if (amount <= 0) return;
    const src = new Uint8ClampedArray(d);
    const blur = boxBlur3(src, w, h);
    const k = clamp(amount, 0, 1) * 1.15;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = src[i] + (src[i] - blur[i]) * k;
      d[i + 1] = src[i + 1] + (src[i + 1] - blur[i + 1]) * k;
      d[i + 2] = src[i + 2] + (src[i + 2] - blur[i + 2]) * k;
    }
  }

  function tonePass(d, lut, sat) {
    const n = d.length;
    for (let i = 0; i < n; i += 4) {
      let r = lut.r[d[i]];
      let g = lut.g[d[i + 1]];
      let b = lut.b[d[i + 2]];
      if (sat !== 1) {
        const y = 0.299 * r + 0.587 * g + 0.114 * b;
        r = y + (r - y) * sat;
        g = y + (g - y) * sat;
        b = y + (b - y) * sat;
      }
      d[i] = r;
      d[i + 1] = g;
      d[i + 2] = b;
    }
  }

  function render(srcData, w, h, adjust, cleanup) {
    const data = new Uint8ClampedArray(srcData);
    const clean = cleanup || {};
    // 1. Deblur: recover lost sharpness from blur first
    if (clean.deblur > 0 && MRL.deblur) {
      const deb = MRL.deblur.deblur({ data: data, width: w, height: h }, { strength: clean.deblur / 100 });
      data.set(deb);
    }
    // 2. Edge-preserving denoise: clean noise without blurring edges (bilateral filter)
    if (clean.noise > 0) bilateralPass(data, clean.noise / 100, w, h);
    // 3. Local contrast / detail: enhance texture after denoising
    if (clean.detail > 0 && MRL.deblur) {
      const det = MRL.deblur.localContrast({ data: data, width: w, height: h }, { strength: clean.detail / 100 });
      data.set(det);
    }
    // 4. Sharpen: final edge enhancement
    if (clean.sharpen > 0) sharpenPass(data, clean.sharpen / 100, w, h);
    // 5. Estimate colors for black-and-white photos
    if (clean.colorize > 0 && MRL.colorize) {
      const col = MRL.colorize.colorize(
        { data: data, width: w, height: h },
        { strength: clean.colorize / 100, style: clean.colorStyle || "natural" }
      );
      data.set(col);
    }
    // 6. Tone pass: exposure, contrast, warmth, saturation
    const lut = buildLUTs(adjust);
    tonePass(data, lut, clamp(1 + adjust.saturation / 100, 0, 2.4));
    return data;
  }

  function analyzeAuto(srcData, w, h) {
    const hist = new Float64Array(256);
    const rs = new Float64Array(256);
    const gs = new Float64Array(256);
    const bs = new Float64Array(256);
    let count = 0;
    let warmAcc = 0;
    for (let y = 0; y < h; y += 2) {
      for (let x = 0; x < w; x += 2) {
        const i = (y * w + x) * 4;
        const lum = (0.299 * srcData[i] + 0.587 * srcData[i + 1] + 0.114 * srcData[i + 2]) | 0;
        hist[lum]++;
        rs[lum] += srcData[i];
        gs[lum] += srcData[i + 1];
        bs[lum] += srcData[i + 2];
        warmAcc += srcData[i] - srcData[i + 2];
        count++;
      }
    }
    let total = 0;
    let black = 0;
    let white = 255;
    for (let v = 0; v < 256; v++) {
      total += hist[v];
      if (total >= count * 0.004 && black === 0) black = v;
    }
    total = 0;
    for (let v = 255; v >= 0; v--) {
      total += hist[v];
      if (total >= count * 0.004) {
        white = v;
        break;
      }
    }
    let mean = 0;
    for (let v = 0; v < 256; v++) mean += hist[v] * v;
    mean = count ? mean / count : 128;
    let warmMean = count ? warmAcc / count : 0;

    const spread = white - black;
    const out = { exposure: 0, brightness: 0, contrast: 0, shadows: 0, highlights: 0, saturation: 0, warmth: 0 };

    // Improved exposure for faded photos
    if (mean < 100) out.exposure = clamp(Math.round((100 - mean) * 0.6), 0, 50);
    else if (mean > 180) out.exposure = -clamp(Math.round((mean - 180) * 0.25), 0, 30);
    else out.exposure = clamp(Math.round((108 - mean) * 0.55), 0, 42);

    // Improved contrast for faded photos
    if (spread < 180) out.contrast = clamp(Math.round((180 - spread) * 0.8), 0, 70);
    else out.contrast = clamp(Math.round((218 - spread) * 0.75), 0, 62);

    // Shadow/highlight recovery for faded photos
    if (black > 30) out.shadows = clamp(Math.round((black - 25) * 0.6), 0, 40);
    if (white < 220) out.highlights = clamp(Math.round((220 - white) * 0.4), 0, 32);

    // Chroma analysis
    let chroma = 0;
    const step = 4;
    for (let i = 0; i < srcData.length; i += 4 * step * 3) {
      const r = srcData[i];
      const g = srcData[i + 1];
      const b = srcData[i + 2];
      const mx = Math.max(r, g, b);
      const mn = Math.min(r, g, b);
      chroma += mx - mn;
    }
    chroma = chroma / Math.max(1, srcData.length / (4 * step * 3));

    // Saturation: always desaturate very little for B&W, add color otherwise
    const gray = MRL.colorize ? MRL.colorize.isGrayscale({ data: srcData, width: w, height: h }) : null;
    if (gray && gray.grayscale) {
      // For true grayscale: push saturation so the colorized result is vivid
      out.saturation = 32;
    } else if (chroma < 40) {
      out.saturation = clamp(Math.round((40 - chroma) * 2.5), 6, 55);
    } else {
      out.saturation = 0;
    }

    // Warmth: improved calculation
    if (warmMean > 10) out.warmth = -clamp(Math.round((warmMean - 10) * 0.7), 0, 40);

    return out;
  }

  function suggestCleanup(srcCanvas) {
    const w = Math.max(1, Math.round(srcCanvas.width / 3));
    const h = Math.max(1, Math.round(srcCanvas.height / 3));
    const t = document.createElement("canvas");
    t.width = w;
    t.height = h;
    const ctx = t.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(srcCanvas, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;
    const img = { data: data, width: w, height: h };

    const gray = MRL.colorize ? MRL.colorize.isGrayscale(img) : { grayscale: false, confidence: 0 };
    const blur = MRL.deblur ? MRL.deblur.estimateBlur(img) : { amount: 0 };
    const noise = MRL.deblur ? MRL.deblur.estimateNoise(img) : 0;

    // Improved: only force colorize for truly grayscale photos (low chroma AND low saturation)
    // Check actual colorfulness in addition to the grayscale detector
    let overallChroma = 0;
    let pixelCount = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const mx = Math.max(r, g, b);
      const mn = Math.min(r, g, b);
      overallChroma += mx - mn;
      pixelCount++;
    }
    overallChroma = pixelCount ? overallChroma / pixelCount : 0;

    let sum = 0;
    let sum2 = 0;
    let count = 0;
    for (let i = 0; i < data.length; i += 12) {
      const L = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      sum += L;
      sum2 += L * L;
      count++;
    }
    const mean = count ? sum / count : 128;
    const std = count ? Math.sqrt(Math.max(0, sum2 / count - mean * mean)) : 64;

    const cleanup = {
      noise: clamp(Math.round(noise * 100 * 6), 0, 42),
      sharpen: 0,
      // Only colorize if: (a) the grayscale detector says grayscale with high confidence,
      // AND (b) the photo has very low overall chroma (is genuinely B&W, not just low-saturation color)
      colorize: gray.grayscale && gray.confidence > 0.5 && overallChroma < 20 ? 100 : 0,
      deblur: clamp(Math.round(blur.amount * 110), 0, 100),
      detail: clamp(Math.round((70 - std) * 1.25), 0, 75),
      colorStyle: "natural",
    };

    const actions = [];
    if (cleanup.colorize > 0) actions.push("colour added");
    if (cleanup.deblur > 18) actions.push("soft focus repaired");
    if (cleanup.noise > 14) actions.push("grain softened");
    if (cleanup.detail > 14) actions.push("detail recovered");

    const report = {
      grayscale: gray.grayscale,
      grayscaleConfidence: gray.confidence,
      blurAmount: blur.amount,
      blurLabel: MRL.deblur ? MRL.deblur.describe(img) : "sharp",
      noise: noise,
      std: std,
      actions: actions,
      message: actions.length ? "Restored — " + actions.join(", ") : "Photo looks healthy — fine-tune it with the sliders",
    };

    return { cleanup: cleanup, report: report };
  }

  function suggestFromCanvas(srcCanvas) {
    const w = Math.max(1, Math.round(srcCanvas.width / 3));
    const h = Math.max(1, Math.round(srcCanvas.height / 3));
    const t = document.createElement("canvas");
    t.width = w;
    t.height = h;
    const ctx = t.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(srcCanvas, 0, 0, w, h);
    return analyzeAuto(ctx.getImageData(0, 0, w, h).data, w, h);
  }

  return {
    PARAMS: PARAMS,
    defaults: defaults,
    render: render,
    analyzeAuto: analyzeAuto,
    suggestFromCanvas: suggestFromCanvas,
    suggestCleanup: suggestCleanup,
    clamp: clamp,
  };
})();
