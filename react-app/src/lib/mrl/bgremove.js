var G = typeof window !== "undefined" ? window : globalThis;

G.MRL = G.MRL || {};

/*
 * Memory Lane - background removal (v1.0.0)
 *
 * Turns the background of a photo transparent using pure pixel math -
 * no model download, runs in milliseconds. Used by the editor's Remove
 * panel ("Remove background" button and manual cut-out tools).
 *
 * How it works:
 *   1. Border sampling - the pixels along the four edges are grouped
 *      into up to `clusters` background reference colours (a coarse
 *      RGB histogram of the border, biggest buckets first).
 *   2. Flood fill - starting from every border pixel whose colour is
 *      close to a reference, neighbours join the background while
 *      their colour stays within the tolerance of a reference. The
 *      tolerance adapts to how uniform the border is (a studio
 *      backdrop gets a tight tolerance, a textured one a wider net).
 *      The subject, which is not connected to the border, survives.
 *   3. Feathering - a 1px 3x3 blur on the alpha mask (boundary pixels
 *      only) softens the cut-out edge so the subject blends onto any
 *      new backdrop.
 *
 * Public API:
 *   autoRemove({data, width, height}, options) ->
 *     { data: new RGBA buffer with alpha 0 (background) / 255 (subject)
 *             and feathered boundary pixels,
 *       removedRatio: fraction of pixels made transparent,
 *       tolerance: the colour tolerance that was used }
 *
* options:
 *   clusters   - max background reference colours (default 4)
 *   tolerance  - fixed colour tolerance; omit to auto-tune
 *   feather    - set false to skip the 1px edge softening
 *   fill       - "transparent" (default) punches the background to alpha 0,
 *                "white" keeps the image opaque and repaints the background
 *                pure white (RGB 255, alpha 255), blending at the edges
 */
G.MRL.bgremove = (function () {
  "use strict";

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  // Euclidean RGB distance normalised to the 0..255 range.
  function dist(r1, g1, b1, r2, g2, b2) {
    var dr = r1 - r2;
    var dg = g1 - g2;
    var db = b1 - b2;
    return Math.sqrt(dr * dr + dg * dg + db * db) / 1.7320508;
  }

  function autoRemove(img, options) {
    var opts = options || {};
    var w = img.width;
    var h = img.height;
    var d = img.data;
    var out = new Uint8ClampedArray(d);
    var n = w * h;
    if (!n) return { data: out, width: w, height: h, removedRatio: 0, tolerance: 0 };

    /* ---- 1. background reference colours from the border ---- */
    var K = clamp(opts.clusters || 4, 1, 8);
    var buckets = {};
    var borderIdx = [];
    function sample(px) {
      var i = px * 4;
      borderIdx.push(px);
      if (d[i + 3] < 10) return; // already transparent = background
      var key = ((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4);
      var b = buckets[key];
      if (!b) b = buckets[key] = { r: 0, g: 0, b: 0, c: 0 };
      b.r += d[i];
      b.g += d[i + 1];
      b.b += d[i + 2];
      b.c++;
    }
    var x;
    var y;
    for (x = 0; x < w; x++) {
      sample(x);
      sample((h - 1) * w + x);
    }
    for (y = 1; y < h - 1; y++) {
      sample(y * w);
      sample(y * w + w - 1);
    }
    if (!borderIdx.length) return { data: out, width: w, height: h, removedRatio: 0, tolerance: 0 };

    var list = [];
    for (var key in buckets) {
      if (Object.prototype.hasOwnProperty.call(buckets, key)) {
        var bk = buckets[key];
        list.push({ r: bk.r / bk.c, g: bk.g / bk.c, b: bk.b / bk.c, c: bk.c });
      }
    }
    list.sort(function (a, b) { return b.c - a.c; });
    // Keep the dominant border colours only: a bucket must cover at least
    // 20% of the border to become a reference. This stops a subject that
    // touches the border from turning its own colour into a "background"
    // reference (which would make the flood eat the subject). Near-
    // duplicates of an already-kept reference are skipped.
    var refs = [];
    for (var li = 0; li < list.length && refs.length < K; li++) {
      var cand = list[li];
      if (li > 0 && cand.c < borderIdx.length * 0.2) break;
      var dup = false;
      for (var ri = 0; ri < refs.length; ri++) {
        if (dist(cand.r, cand.g, cand.b, refs[ri].r, refs[ri].g, refs[ri].b) < 24) {
          dup = true;
          break;
        }
      }
      if (!dup) refs.push({ r: cand.r, g: cand.g, b: cand.b });
    }
    if (!refs.length) return { data: out, width: w, height: h, removedRatio: 0, tolerance: 0 };

    // tolerance adapts to how uniform the border is
    var tol = opts.tolerance;
    if (tol === undefined) {
      var sum = 0;
      var cnt = 0;
      var stride = Math.max(1, Math.floor(borderIdx.length / 400));
      for (var bi = 0; bi < borderIdx.length; bi += stride) {
        var pi = borderIdx[bi] * 4;
        var best = 1e9;
        for (var rr = 0; rr < refs.length; rr++) {
          var dd = dist(d[pi], d[pi + 1], d[pi + 2], refs[rr].r, refs[rr].g, refs[rr].b);
          if (dd < best) best = dd;
        }
        sum += best;
        cnt++;
      }
      var meanDist = cnt ? sum / cnt : 0;
      tol = clamp(10 + meanDist * 2.2, 26, 96);
    }
    tol = clamp(tol, 1, 255);

    /* ---- 2. flood fill from the border ---- */
    function nearRef(px) {
      var p = px * 4;
      for (var rr = 0; rr < refs.length; rr++) {
        if (dist(d[p], d[p + 1], d[p + 2], refs[rr].r, refs[rr].g, refs[rr].b) < tol) return true;
      }
      return false;
    }

    var isBg = new Uint8Array(n);
    var stack = new Int32Array(n);
    var sp = 0;
    function seed(px) {
      if (!isBg[px] && nearRef(px)) {
        isBg[px] = 1;
        stack[sp++] = px;
      }
    }
    function tryJoin(nx) {
      if (!isBg[nx] && nearRef(nx)) {
        isBg[nx] = 1;
        stack[sp++] = nx;
      }
    }
    for (x = 0; x < w; x++) {
      seed(x);
      seed((h - 1) * w + x);
    }
    for (y = 1; y < h - 1; y++) {
      seed(y * w);
      seed(y * w + w - 1);
    }
    while (sp > 0) {
      var cur = stack[--sp];
      var cx = cur % w;
      if (cx > 0) tryJoin(cur - 1);
      if (cx < w - 1) tryJoin(cur + 1);
      if (cur >= w) tryJoin(cur - w);
      if (cur + w < n) tryJoin(cur + w);
    }

    /* ---- 3. alpha mask + 1px feather on boundary pixels ---- */
    var alpha = new Uint8Array(n);
    var removed = 0;
    for (var p = 0; p < n; p++) {
      if (isBg[p]) {
        alpha[p] = 0;
        removed++;
      } else {
        alpha[p] = 255;
      }
    }
    if (opts.feather !== false) {
      var soft = new Uint8Array(alpha);
      for (var fy = 0; fy < h; fy++) {
        for (var fx = 0; fx < w; fx++) {
          var fp = fy * w + fx;
          var a0 = alpha[fp];
          var mixed = false;
          if ((fx > 0 && alpha[fp - 1] !== a0) || (fx < w - 1 && alpha[fp + 1] !== a0) ||
              (fy > 0 && alpha[fp - w] !== a0) || (fy < h - 1 && alpha[fp + w] !== a0)) {
            mixed = true;
          }
          if (!mixed) continue; // only boundary pixels need softening
          var sum = 0;
          var c = 0;
          for (var dy = -1; dy <= 1; dy++) {
            var yy = fy + dy;
            if (yy < 0 || yy >= h) continue;
            for (var dx = -1; dx <= 1; dx++) {
              var xx = fx + dx;
              if (xx < 0 || xx >= w) continue;
              sum += alpha[yy * w + xx];
              c++;
            }
          }
          soft[fp] = Math.round(sum / c);
        }
      }
      alpha = soft;
    }
for (p = 0; p < n; p++) {
      if (opts.fill === "white") {
        // Keep the photo opaque: repaint the background pure white, and
        // blend the feathered boundary towards white as well.
        var o = p * 4;
        var a = alpha[p] / 255;
        out[o] = out[o] * a + 255 * (1 - a);
        out[o + 1] = out[o + 1] * a + 255 * (1 - a);
        out[o + 2] = out[o + 2] * a + 255 * (1 - a);
        out[o + 3] = 255;
      } else {
        out[p * 4 + 3] = alpha[p];
      }
    }

    return { data: out, width: w, height: h, removedRatio: removed / n, tolerance: tol, refs: refs };
  }

  return { autoRemove: autoRemove, version: "1.0.0" };
})();

