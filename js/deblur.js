var G = typeof window !== "undefined" ? window : globalThis;

G.MRL = G.MRL || {};

G.MRL.deblur = (function () {
  "use strict";

  const MAX_SAMPLE = 400;
  const RATIO_CLEAN = 0.24;
  const RATIO_SPAN = 0.19;

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function lum(r, g, b) {
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function downsampleLum(img, maxSide) {
    const w = img.width;
    const h = img.height;
    const d = img.data;
    const scale = Math.min(1, maxSide / Math.max(w, h));
    const sw = Math.max(8, Math.round(w * scale));
    const sh = Math.max(8, Math.round(h * scale));
    const out = new Float32Array(sw * sh);
    const xRatio = w / sw;
    const yRatio = h / sh;
    for (let y = 0; y < sh; y++) {
      const y0 = Math.min(h - 1, Math.floor(y * yRatio));
      let y1 = Math.max(y0 + 1, Math.floor((y + 1) * yRatio));
      if (y1 > h) y1 = h;
      for (let x = 0; x < sw; x++) {
        const x0 = Math.min(w - 1, Math.floor(x * xRatio));
        let x1 = Math.max(x0 + 1, Math.floor((x + 1) * xRatio));
        if (x1 > w) x1 = w;
        let sum = 0;
        let count = 0;
        for (let yy = y0; yy < y1; yy++) {
          let i = (yy * w + x0) * 4;
          for (let xx = x0; xx < x1; xx++, i += 4) {
            sum += lum(d[i], d[i + 1], d[i + 2]);
            count++;
          }
        }
        out[y * sw + x] = count ? sum / count : 0;
      }
    }
    return { data: out, w: sw, h: sh };
  }

  function blurFloat(src, w, h, r) {
    const tmp = new Float32Array(w * h);
    const out = new Float32Array(w * h);
    const win = r * 2 + 1;
    for (let y = 0; y < h; y++) {
      const row = y * w;
      let sum = 0;
      for (let x = -r; x <= r; x++) {
        const xx = x < 0 ? 0 : x > w - 1 ? w - 1 : x;
        sum += src[row + xx];
      }
      for (let x = 0; x < w; x++) {
        tmp[row + x] = sum / win;
        const addX = x + r + 1 > w - 1 ? w - 1 : x + r + 1;
        const remX = x - r < 0 ? 0 : x - r;
        sum += src[row + addX] - src[row + remX];
      }
    }
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let y = -r; y <= r; y++) {
        const yy = y < 0 ? 0 : y > h - 1 ? h - 1 : y;
        sum += tmp[yy * w + x];
      }
      for (let y = 0; y < h; y++) {
        out[y * w + x] = sum / win;
        const addY = y + r + 1 > h - 1 ? h - 1 : y + r + 1;
        const remY = y - r < 0 ? 0 : y - r;
        sum += tmp[addY * w + x] - tmp[remY * w + x];
      }
    }
    return out;
  }

  function sharpnessRatio(img) {
    const s = downsampleLum(img, MAX_SAMPLE);
    const fine = blurFloat(s.data, s.w, s.h, 1);
    const mid = blurFloat(s.data, s.w, s.h, 3);
    const wide = blurFloat(s.data, s.w, s.h, 4);
    let hf = 0;
    let contrast = 0;
    let noiseSum = 0;
    let noiseCount = 0;
    const n = s.w * s.h;
    for (let i = 0; i < n; i++) {
      const dev = Math.abs(s.data[i] - fine[i]);
      hf += dev;
      contrast += Math.abs(s.data[i] - wide[i]);
      if (Math.abs(s.data[i] - mid[i]) < 4) {
        noiseSum += dev;
        noiseCount++;
      }
    }
    hf /= n;
    contrast /= n;
    const noiseDev = noiseCount ? noiseSum / noiseCount : 0;
    const cleanHf = Math.max(0, hf - noiseDev * 0.7);
    const ratio = cleanHf / (contrast + 1);
    return { ratio: ratio, hf: hf, contrast: contrast, noiseDev: noiseDev };
  }

  function estimateBlur(img) {
    if (!img || !img.data || !img.width || !img.height) {
      return { amount: 0, sharpness: 1, radius: 1 };
    }
    const info = sharpnessRatio(img);
    const amount = clamp((RATIO_CLEAN - info.ratio) / RATIO_SPAN, 0, 1);
    const sharpness = clamp(info.ratio / RATIO_CLEAN, 0, 1);
    const radius = clamp(1 + Math.round(amount * 6.0), 1, 7);
    return { amount: amount, sharpness: sharpness, radius: radius };
  }

  function blurRGBA(src, w, h, r) {
    const horiz = new Uint8ClampedArray(src.length);
    const vert = new Uint8ClampedArray(src.length);
    const win = r * 2 + 1;
    for (let y = 0; y < h; y++) {
      const row = y * w;
      let sr = 0;
      let sg = 0;
      let sb = 0;
      for (let x = -r; x <= r; x++) {
        const xx = x < 0 ? 0 : x > w - 1 ? w - 1 : x;
        const i = (row + xx) * 4;
        sr += src[i];
        sg += src[i + 1];
        sb += src[i + 2];
      }
      for (let x = 0; x < w; x++) {
        const o = (row + x) * 4;
        horiz[o] = sr / win;
        horiz[o + 1] = sg / win;
        horiz[o + 2] = sb / win;
        horiz[o + 3] = src[o + 3];
        const addX = x + r + 1 > w - 1 ? w - 1 : x + r + 1;
        const remX = x - r < 0 ? 0 : x - r;
        const ia = (row + addX) * 4;
        const ir = (row + remX) * 4;
        sr += src[ia] - src[ir];
        sg += src[ia + 1] - src[ir + 1];
        sb += src[ia + 2] - src[ir + 2];
      }
    }
    for (let x = 0; x < w; x++) {
      let sr = 0;
      let sg = 0;
      let sb = 0;
      for (let y = -r; y <= r; y++) {
        const yy = y < 0 ? 0 : y > h - 1 ? h - 1 : y;
        const i = (yy * w + x) * 4;
        sr += horiz[i];
        sg += horiz[i + 1];
        sb += horiz[i + 2];
      }
      for (let y = 0; y < h; y++) {
        const o = (y * w + x) * 4;
        vert[o] = sr / win;
        vert[o + 1] = sg / win;
        vert[o + 2] = sb / win;
        vert[o + 3] = horiz[o + 3];
        const addY = y + r + 1 > h - 1 ? h - 1 : y + r + 1;
        const remY = y - r < 0 ? 0 : y - r;
        const ia = (addY * w + x) * 4;
        const ir = (remY * w + x) * 4;
        sr += horiz[ia] - horiz[ir];
        sg += horiz[ia + 1] - horiz[ir + 1];
        sb += horiz[ia + 2] - horiz[ir + 2];
      }
    }
    return vert;
  }

  function laplacian(src, w, h) {
    const out = new Float32Array(src.length); // same length as RGBA data
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = (y * w + x) * 4;
        const tl = (y - 1) * w + x - 1;
        const tc = (y - 1) * w + x;
        const tr = (y - 1) * w + x + 1;
        const ml = y * w + x - 1;
        const mc = y * w + x;
        const mr = y * w + x + 1;
        const bl = (y + 1) * w + x - 1;
        const bc = (y + 1) * w + x;
        const br = (y + 1) * w + x + 1;
        const c = 8;
        for (let ch = 0; ch < 3; ch++) {
          const val =
            c * src[mc * 4 + ch] -
            (src[tl * 4 + ch] + src[tc * 4 + ch] + src[tr * 4 + ch] +
             src[ml * 4 + ch] + src[mr * 4 + ch] +
             src[bl * 4 + ch] + src[bc * 4 + ch] + src[br * 4 + ch]);
          out[i + ch] = val;
        }
      }
    }
    return out;
  }

  /* ------------------------------------------------------------------
     TRUE UNBLUR — Richardson-Lucy deconvolution with a Gaussian PSF.

     Unsharp masking only boosts edges that survive. Deconvolution
     actually reverses the blur: it models the blur as a Gaussian point
     spread function K and iteratively solves  y ≈ K * x  for the sharp
     image x. Each iteration:
        est   = K ⊗ x            (re-blur the current estimate)
        ratio = y / est          (where did we lose energy?)
        corr  = K ⊗ ratio        (spread the correction back)
        x    *= corr
     Because the Gaussian is symmetric, Kᵗ = K. The Gaussian is
     approximated with 3 box passes (O(1) per pixel, sliding window),
     so the whole thing stays fast enough for live preview.
  ------------------------------------------------------------------ */

  function boxesForGauss(sigma, n) {
    const wIdeal = Math.sqrt((12 * sigma * sigma) / n + 1);
    let wl = Math.floor(wIdeal);
    if (wl % 2 === 0) wl--;
    const wu = wl + 2;
    const mIdeal =
      (12 * sigma * sigma - n * wl * wl - 4 * n * wl - 3 * n) / (-4 * wl - 4);
    const m = Math.round(mIdeal);
    const radii = [];
    for (let i = 0; i < n; i++) {
      const size = i < m ? wl : wu;
      radii.push(Math.max(1, Math.round((size - 1) / 2)));
    }
    return radii;
  }

  function gaussApprox(src, w, h, sigma) {
    const radii = boxesForGauss(sigma, 3);
    let a = src;
    for (let i = 0; i < radii.length; i++) {
      a = blurFloat(a, w, h, radii[i]);
    }
    return a;
  }

  function richardsonLucy(img, sigma, iterations, strength) {
    const w = img.width;
    const h = img.height;
    const n = w * h;
    const d = img.data;

    // Split into float planes per channel.
    const planes = [
      new Float32Array(n),
      new Float32Array(n),
      new Float32Array(n),
    ];
    for (let i = 0, p = 0; p < n; i += 4, p++) {
      planes[0][p] = d[i];
      planes[1][p] = d[i + 1];
      planes[2][p] = d[i + 2];
    }

    // Original observation y (fixed target of the deconvolution).
    const y = [planes[0].slice(), planes[1].slice(), planes[2].slice()];

    const est = new Float32Array(n);
    const ratio = new Float32Array(n);
    const corr = new Float32Array(n);

    const dampen = 0.55 + 0.45 * strength; // relaxation factor

    for (let c = 0; c < 3; c++) {
      const x = planes[c];
      const yc = y[c];
      for (let it = 0; it < iterations; it++) {
        // est = K ⊗ x
        const b = gaussApprox(x, w, h, sigma);
        for (let p = 0; p < n; p++) {
          const e = b[p] < 0.5 ? 0.5 : b[p];
          let r = yc[p] / e;
          if (r < 0.1) r = 0.1;
          else if (r > 6) r = 6;
          ratio[p] = r;
        }
        // corr = K ⊗ ratio  (Kᵗ = K for symmetric Gaussian)
        const cc = gaussApprox(ratio, w, h, sigma);
        for (let p = 0; p < n; p++) {
          let v = x[p] * (1 + (cc[p] - 1) * dampen);
          if (v < 0) v = 0;
          else if (v > 255) v = 255;
          x[p] = v;
        }
      }
    }

    // Merge back to RGBA.
    const out = new Uint8ClampedArray(d.length);
    for (let i = 0, p = 0; p < n; i += 4, p++) {
      out[i] = planes[0][p];
      out[i + 1] = planes[1][p];
      out[i + 2] = planes[2][p];
      out[i + 3] = d[i + 3];
    }
    return out;
  }

  function deblur(img, options) {
    const opts = options || {};
    const strength = clamp(opts.strength === undefined ? 1 : opts.strength, 0, 1);
    const src = img.data;
    const w = img.width;
    const h = img.height;
    const out = new Uint8ClampedArray(src.length);
    if (!src.length) return out;
    if (strength <= 0) {
      out.set(src);
      return out;
    }

    const est = estimateBlur(img);
    const amount = est.amount;
    if (amount <= 0.01) {
      out.set(src);
      return out;
    }

    // --- Stage 1: true unblur via Richardson-Lucy deconvolution ---
    // Iterations scale with requested strength and image size so large
    // photos stay responsive.
    const pxCount = w * h;
    let iters = Math.round(1 + strength * amount * 6);
    if (pxCount > 1500000) {
      iters = Math.max(1, Math.round((iters * 1500000) / pxCount));
    }
    iters = Math.max(1, Math.min(iters, 8));
    const sigma = 0.55 + amount * 2.4;
    const deconvolved = richardsonLucy(
      { data: src, width: w, height: h },
      sigma,
      iters,
      strength
    );

    // --- Stage 2: multi-pass sharpening for extra micro-contrast ---
    // RL already recovered most of the lost detail, so the sharpening
    // refinement runs on a damped amount to avoid halos.
    const refine = amount * 0.4;
    const passes = refine < 0.4 ? 1 : refine < 0.7 ? 2 : 3;
    let cur = deconvolved;

    for (let pass = 0; pass < passes; pass++) {
      const passStrength = strength * (refine * 0.55 + 0.35) / passes;
      const radius = clamp(Math.round(est.radius * (0.7 + 0.6 * (pass / Math.max(1, passes - 1)))), 1, 7);
      const k = passStrength * refine * 3.6;

      const blur = blurRGBA(cur, w, h, radius);
      const lap = laplacian(cur, w, h);

      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const i = (y * w + x) * 4;
          const xl = i - 4;
          const xr = i + 4;
          const iu = ((y - 1) * w + x) * 4;
          const id = ((y + 1) * w + x) * 4;
          const grad =
            Math.abs(lum(cur[xr], cur[xr + 1], cur[xr + 2]) - lum(cur[xl], cur[xl + 1], cur[xl + 2])) +
            Math.abs(lum(cur[id], cur[id + 1], cur[id + 2]) - lum(cur[iu], cur[iu + 1], cur[iu + 2]));
          const gate = clamp((grad - 2) / 24, 0.08, 1);
          const corr = k * gate;
          const lapL = lap[i];
          const lapG = lap[i + 1];
          const lapB = lap[i + 2];
          const sr = cur[i];
          const sg = cur[i + 1];
          const sb = cur[i + 2];
          const bL = blur[i];
          const bG = blur[i + 1];
          const bB = blur[i + 2];
          const sharpL = sr + corr * (sr - bL) + passStrength * refine * 0.5 * lapL;
          const sharpG = sg + corr * (sg - bG) + passStrength * refine * 0.5 * lapG;
          const sharpB = sb + corr * (sb - bB) + passStrength * refine * 0.5 * lapB;
          cur[i] = clamp(sharpL, sr - 90, sr + 90);
          cur[i + 1] = clamp(sharpG, sg - 90, sg + 90);
          cur[i + 2] = clamp(sharpB, sb - 90, sb + 90);
          cur[i + 3] = cur[i + 3];
        }
      }
    }

    // Final fine detail pass
    const fineBlur = blurRGBA(cur, w, h, 1);
    const k2 = strength * refine * 1.0;
    for (let i = 0; i < cur.length; i += 4) {
      const sr = cur[i];
      const sg = cur[i + 1];
      const sb = cur[i + 2];
      out[i] = clamp(sr + k2 * (sr - fineBlur[i]), sr - 60, sr + 60);
      out[i + 1] = clamp(sg + k2 * (sg - fineBlur[i + 1]), sg - 60, sg + 60);
      out[i + 2] = clamp(sb + k2 * (sb - fineBlur[i + 2]), sb - 60, sb + 60);
      out[i + 3] = cur[i + 3];
    }
    return out;
  }

  function estimateNoise(img) {
    if (!img || !img.data || !img.width || !img.height) return 0;
    const s = downsampleLum(img, MAX_SAMPLE);
    const fine = blurFloat(s.data, s.w, s.h, 1);
    const wide = blurFloat(s.data, s.w, s.h, 3);
    let sum = 0;
    let count = 0;
    for (let i = 0; i < s.data.length; i++) {
      if (Math.abs(s.data[i] - wide[i]) < 4) {
        sum += Math.abs(s.data[i] - fine[i]);
        count++;
      }
    }
    if (!count) return 0;
    return clamp(sum / count / 255, 0, 1);
  }

  function localContrast(img, options) {
    const opts = options || {};
    const strength = clamp(opts.strength === undefined ? 1 : opts.strength, 0, 1);
    const src = img.data;
    const out = new Uint8ClampedArray(src.length);
    if (!src.length) return out;
    if (strength <= 0) {
      out.set(src);
      return out;
    }
    const w = img.width;
    const h = img.height;
    const tilesX = clamp(Math.round(w / 48), 1, 16);
    const tilesY = clamp(Math.round(h / 48), 1, 16);
    const luts = new Uint8Array(tilesX * tilesY * 256);

    for (let ty = 0; ty < tilesY; ty++) {
      const y0 = Math.floor((ty * h) / tilesY);
      let y1 = Math.floor(((ty + 1) * h) / tilesY);
      if (y1 <= y0) y1 = Math.min(h, y0 + 1);
      for (let tx = 0; tx < tilesX; tx++) {
        const x0 = Math.floor((tx * w) / tilesX);
        let x1 = Math.floor(((tx + 1) * w) / tilesX);
        if (x1 <= x0) x1 = Math.min(w, x0 + 1);
        const hist = new Uint32Array(256);
        let total = 0;
        for (let y = y0; y < y1; y++) {
          let i = (y * w + x0) * 4;
          for (let x = x0; x < x1; x++, i += 4) {
            const L = lum(src[i], src[i + 1], src[i + 2]) | 0;
            hist[L]++;
            total++;
          }
        }
        const limit = Math.max(1, Math.floor((2.2 * total) / 256));
        let excess = 0;
        for (let v = 0; v < 256; v++) {
          if (hist[v] > limit) {
            excess += hist[v] - limit;
            hist[v] = limit;
          }
        }
        const share = Math.floor(excess / 256);
        let remainder = excess - share * 256;
        for (let v = 0; v < 256; v++) {
          hist[v] += share;
          if (remainder > 0) {
            hist[v]++;
            remainder--;
          }
        }
        const base = (ty * tilesX + tx) * 256;
        let acc = 0;
        let cdfMin = 0;
        let found = false;
        for (let v = 0; v < 256; v++) {
          acc += hist[v];
          if (!found && acc > 0) {
            cdfMin = acc;
            found = true;
          }
        }
        const span = Math.max(1, total - cdfMin);
        for (let v = 0; v < 256; v++) {
          let c = 0;
          for (let u = 0; u <= v; u++) c += hist[u];
          const mapped = Math.round(((c - cdfMin) * 255) / span);
          luts[base + v] = mapped < 0 ? 0 : mapped > 255 ? 255 : mapped;
        }
      }
    }

    for (let y = 0; y < h; y++) {
      const v = (y * tilesY) / h - 0.5;
      let y0 = Math.floor(v);
      const fy = v - y0;
      y0 = y0 < 0 ? 0 : y0 > tilesY - 1 ? tilesY - 1 : y0;
      const y1 = y0 + 1 > tilesY - 1 ? tilesY - 1 : y0 + 1;
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const sr = src[i];
        const sg = src[i + 1];
        const sb = src[i + 2];
        const L = lum(sr, sg, sb);
        const lv = L | 0;
        const u = (x * tilesX) / w - 0.5;
        let x0 = Math.floor(u);
        const fx = u - x0;
        x0 = x0 < 0 ? 0 : x0 > tilesX - 1 ? tilesX - 1 : x0;
        const x1 = x0 + 1 > tilesX - 1 ? tilesX - 1 : x0 + 1;

        const b00 = (y0 * tilesX + x0) * 256;
        const b10 = (y0 * tilesX + x1) * 256;
        const b01 = (y1 * tilesX + x0) * 256;
        const b11 = (y1 * tilesX + x1) * 256;

        const w00 = (1 - fx) * (1 - fy);
        const w10 = fx * (1 - fy);
        const w01 = (1 - fx) * fy;
        const w11 = fx * fy;

        const mapped =
          luts[b00 + lv] * w00 + luts[b10 + lv] * w10 + luts[b01 + lv] * w01 + luts[b11 + lv] * w11;
        let scale = L > 1 ? mapped / L : 1;
        scale = clamp(scale, 0.5, 2.2);
        const nr = clamp(sr * scale, 0, 255);
        const ng = clamp(sg * scale, 0, 255);
        const nb = clamp(sb * scale, 0, 255);
        out[i] = sr + (nr - sr) * strength;
        out[i + 1] = sg + (ng - sg) * strength;
        out[i + 2] = sb + (nb - sb) * strength;
        out[i + 3] = src[i + 3];
      }
    }
    return out;
  }

  function restore(img, options) {
    const opts = options || {};
    const deblurAmount = clamp(opts.deblur === undefined ? 0 : opts.deblur, 0, 1);
    const detailAmount = clamp(opts.detail === undefined ? 0 : opts.detail, 0, 1);
    let data = new Uint8ClampedArray(img.data);
    if (deblurAmount > 0) {
      data = deblur({ data: data, width: img.width, height: img.height }, { strength: deblurAmount });
    }
    if (detailAmount > 0) {
      data = localContrast({ data: data, width: img.width, height: img.height }, { strength: detailAmount });
    }
    return data;
  }

  function describe(img) {
    const est = estimateBlur(img);
    if (est.amount < 0.25) return "sharp";
    if (est.amount < 0.6) return "slightly soft";
    return "very blurry";
  }

  return {
    estimateBlur: estimateBlur,
    deblur: deblur,
    estimateNoise: estimateNoise,
    localContrast: localContrast,
    restore: restore,
    describe: describe,
    version: "3.0.0",
  };
})();
