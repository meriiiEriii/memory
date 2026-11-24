var G = typeof window !== "undefined" ? window : globalThis;

G.MRL = G.MRL || {};

/*
 * Memory Lane - black & white photo colourisation engine (v1.1.0)
 *
 * The colourisation algorithm is ported from the "Old Photo Restorer"
 * web app (https://rhea-mae06.github.io/yami_oldphotorestorer/ - app.js):
 *   1. Old-photo detection: a Hasler-Susstrunk colourfulness metric
 *      (red-green / yellow-blue opponent channels) classifies the photo
 *      as monochrome / sepia / faded.
 *   2. Luminance-preserving heuristic colourisation for old photos:
 *      a warm base tint, a brown pull in dark regions, centre-weighted
 *      skin tones, and - when the top of the frame reads as plain sky -
 *      a blue sky / green foliage split.
 *   3. Modern colour photos are left untouched: the reference app only
 *      colourises photos it detects as old.
 *
 * The public API (colorize / isGrayscale / analyze / describe) is
 * unchanged, so editor.html, index.html and adjust.js keep working
 * without modification.
 */
G.MRL.colorize = (function () {
  "use strict";

  const WARM_TARGET = [215, 150, 95];

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function clamp01(v) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
  }

  function mix(a, b, t) {
    return a + (b - a) * t;
  }

  // BT.709 luminance - kept for isGrayscale/analyze so the auto-detection
  // thresholds used by adjust.js behave exactly as before.
  function lum(r, g, b) {
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function strideFor(n, maxSamples) {
    return Math.max(1, Math.floor(n / maxSamples));
  }

  function isGrayscale(img) {
    if (!img || !img.data || !img.width || !img.height) {
      return { grayscale: true, confidence: 1, meanChroma: 0 };
    }
    const d = img.data;
    const n = img.width * img.height;
    const stride = strideFor(n, 40000);
    let count = 0;
    let sum = 0;
    let low = 0;
    for (let p = 0; p < n; p += stride) {
      const i = p * 4;
      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];
      let mx = r;
      let mn = r;
      if (g > mx) mx = g;
      if (b > mx) mx = b;
      if (g < mn) mn = g;
      if (b < mn) mn = b;
      const c = mx - mn;
      sum += c;
      if (c <= 6) low++;
      count++;
    }
    const meanChroma = count ? sum / count : 0;
    const lowRatio = count ? low / count : 1;
    const grayscale = meanChroma < 12 || lowRatio >= 0.92;
    let confidence = clamp(1 - meanChroma / 16, 0, 1);
    if (lowRatio >= 0.92) {
      confidence = Math.max(confidence, clamp(0.6 + lowRatio * 0.4, 0, 1));
    } else if (lowRatio >= 0.8) {
      confidence = Math.max(confidence, 0.55);
    }
    return { grayscale: grayscale, confidence: confidence, meanChroma: meanChroma };
  }

  /*
   * Old-photo detection ported from the reference app's analyze():
   * 0.5%-clipped histograms per channel and for luminance, plus the
   * colourfulness of the image from red-green / yellow-blue statistics.
   */
  function analyzeOld(img) {
    if (!img || !img.data || !img.width || !img.height || !img.data.length) {
      return { old: false, colorfulness: 0, gray: true, sepia: false, faded: false, lo: null, hi: null, loL: 0, hiL: 255 };
    }
    const d = img.data;
    const n = d.length / 4;
    const H = [0, 1, 2, 3].map(function () { return new Uint32Array(256); });
    let sumRG = 0;
    let sumRG2 = 0;
    let sumYB = 0;
    let sumYB2 = 0;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];
      H[0][r]++;
      H[1][g]++;
      H[2][b]++;
      H[3][(0.299 * r + 0.587 * g + 0.114 * b) | 0]++;
      const rg = r - g;
      const yb = (r + g) * 0.5 - b;
      sumRG += rg;
      sumRG2 += rg * rg;
      sumYB += yb;
      sumYB2 += yb * yb;
    }
    const clip = n * 0.005;
    const lo = [];
    const hi = [];
    H.forEach(function (h) {
      let a = 0;
      let l = 0;
      let r = 255;
      while (l < 254 && (a += h[l]) < clip) l++;
      a = 0;
      while (r > l + 20 && (a += h[r]) < clip) r--;
      lo.push(l);
      hi.push(Math.max(r, l + 20));
    });
    const meanRG = sumRG / n;
    const meanYB = sumYB / n;
    const stdRG = Math.sqrt(Math.max(0, sumRG2 / n - meanRG * meanRG));
    const stdYB = Math.sqrt(Math.max(0, sumYB2 / n - meanYB * meanYB));
    const colorfulness = Math.sqrt(stdRG * stdRG + stdYB * stdYB) + 0.3 * Math.sqrt(meanRG * meanRG + meanYB * meanYB);
    const mono = colorfulness < 18;
    const sepia = colorfulness < 34 && meanRG > 6 && meanYB > 4;
    const faded = hi[3] - lo[3] < 110;
    return {
      lo: lo.slice(0, 3),
      hi: hi.slice(0, 3),
      loL: lo[3],
      hiL: hi[3],
      gray: colorfulness < 8,
      old: mono || sepia || (faded && colorfulness < 26),
      colorfulness: colorfulness,
      sepia: sepia,
      faded: faded,
    };
  }

  function applyStyle(rgb, style) {
    let r = rgb[0];
    let g = rgb[1];
    let b = rgb[2];
    if (style === "warm") {
      r = r + (WARM_TARGET[0] - r) * 0.22;
      g = g + (WARM_TARGET[1] - g) * 0.22;
      b = b + (WARM_TARGET[2] - b) * 0.22;
    } else if (style === "vivid") {
      const y = lum(r, g, b);
      r = y + (r - y) * 1.25;
      g = y + (g - y) * 1.25;
      b = y + (b - y) * 1.25;
    }
    return [r, g, b];
  }

  /*
   * Colourisation (ported from the reference app's colour()):
   *   strength 0 -> photo untouched, strength 1 -> full colour estimate.
   *   For a pure black & white photo this is identical to the reference
   *   app's "colour recovery" amount. Photos not detected as old keep
   *   their existing colours (the reference app never recolours those).
   */
  function colorize(img, options) {
    const opts = options || {};
    const strength = clamp(opts.strength === undefined ? 1 : opts.strength, 0, 1);
    const style = opts.style || "natural";
    const src = img.data;
    const w = img.width;
    const h = img.height;
    const out = new Uint8ClampedArray(src.length);
    if (!src.length) return out;
    if (strength <= 0) {
      out.set(src);
      return out;
    }

    const st = analyzeOld(img);

    // The reference app tints the top of the frame blue only when the top
    // third is a plain bright region (sky or a studio backdrop).
    let skyLikely = false;
    if (st.old) {
      const topRows = Math.max(1, Math.floor(h * 0.35));
      let sum = 0;
      let sum2 = 0;
      let cnt = 0;
      for (let py = 0; py < topRows; py += 2) {
        for (let px = 0; px < w; px += 2) {
          const j = (py * w + px) * 4;
          const L = 0.299 * src[j] + 0.587 * src[j + 1] + 0.114 * src[j + 2];
          sum += L;
          sum2 += L * L;
          cnt++;
        }
      }
      const mean = cnt ? sum / cnt : 0;
      const std = cnt ? Math.sqrt(Math.max(0, sum2 / cnt - mean * mean)) : 255;
      skyLikely = mean > 165 && std < 48;
    }

    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const i = (py * w + px) * 4;
        const r0 = src[i];
        const g0 = src[i + 1];
        const b0 = src[i + 2];
        // BT.601 luminance, as used by the reference algorithm.
        const y = 0.299 * r0 + 0.587 * g0 + 0.114 * b0;

        let r = r0;
        let gg = g0;
        let b = b0;
        if (st.old) {
          // Normalised pixel position, as in the reference app.
          const xn = px / w;
          const yn = py / h;
          // Warm paper base tint.
          let cr = y * 1.02 + 2;
          let cg = y * 0.99 + 2;
          let cb = y * 0.96 + 3;
          // Dark regions pull towards brown instead of grey.
          const dark = clamp01(1 - y / 95);
          cr = mix(cr, 30 + y * 0.32, dark * 0.65);
          cg = mix(cg, 22 + y * 0.26, dark * 0.65);
          cb = mix(cb, 18 + y * 0.22, dark * 0.65);
          // Centre-weighted skin tones.
          const skinTone = clamp01((y - 95) / 70) * (1 - clamp01((y - 228) / 27));
          const nx = Math.abs(xn - 0.5) * 2;
          const ny = Math.abs(yn - 0.5) * 2;
          const central = clamp01(1 - (nx * 0.75 + ny * 0.55));
          const skin = skinTone * (0.35 + 0.65 * central);
          cr = mix(cr, y * 1.14 + 20, skin * 0.85);
          cg = mix(cg, y * 0.93 + 7, skin * 0.85);
          cb = mix(cb, y * 0.79 + 3, skin * 0.85);
          if (skyLikely) {
            // Blue sky towards the top, foliage towards the bottom.
            const sky = Math.max(0, 1 - yn / 0.55) * clamp01((y - 130) / 70);
            cr = mix(cr, y * 0.62 + 8, sky * 0.85);
            cg = mix(cg, y * 0.84 + 10, sky * 0.85);
            cb = mix(cb, Math.min(255, y * 1.16 + 18), sky * 0.85);
            const fol = clamp01((yn - 0.45) / 0.35) * clamp01((y - 45) / 70) * (1 - clamp01((y - 185) / 55));
            cr = mix(cr, y * 0.72, fol * 0.55);
            cg = mix(cg, y * 1.06, fol * 0.55);
            cb = mix(cb, y * 0.60, fol * 0.55);
          }
          r = cr;
          gg = cg;
          b = cb;
        }

        if (style !== "natural") {
          const styled = applyStyle([r, gg, b], style);
          r = styled[0];
          gg = styled[1];
          b = styled[2];
        }

        // Strength blends the colour estimate back into the original
        // photo; for pure grayscale input this matches the reference
        // app's behaviour exactly.
        out[i] = r0 + (r - r0) * strength;
        out[i + 1] = g0 + (gg - g0) * strength;
        out[i + 2] = b0 + (b - b0) * strength;
        out[i + 3] = src[i + 3];
      }
    }
    return out;
  }

  function analyze(img) {
    const g = isGrayscale(img);
    if (!img || !img.data || !img.width || !img.height) {
      return { meanChroma: 0, grayscale: true, confidence: 1, darkRatio: 0, brightRatio: 0, colorfulness: 0, old: true };
    }
    const d = img.data;
    const n = img.width * img.height;
    const stride = strideFor(n, 40000);
    let count = 0;
    let dark = 0;
    let bright = 0;
    for (let p = 0; p < n; p += stride) {
      const i = p * 4;
      const L = lum(d[i], d[i + 1], d[i + 2]) / 255;
      if (L < 0.12) dark++;
      if (L > 0.9) bright++;
      count++;
    }
    const oldInfo = analyzeOld(img);
    return {
      meanChroma: g.meanChroma,
      grayscale: g.grayscale,
      confidence: g.confidence,
      darkRatio: count ? dark / count : 0,
      brightRatio: count ? bright / count : 0,
      colorfulness: oldInfo.colorfulness,
      old: oldInfo.old,
    };
  }

  function describe(img) {
    const g = isGrayscale(img);
    if (g.grayscale) return "black & white";
    return "already in colour";
  }

  return {
    isGrayscale: isGrayscale,
    colorize: colorize,
    analyze: analyze,
    describe: describe,
    version: "1.1.0",
  };
})();
