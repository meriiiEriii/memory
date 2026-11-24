// Test: does MRL.deblur truly unblur (deconvolve) an image?
require("./deblur.js");
const MRL = globalThis.MRL;

function makeSharpImage(w, h) {
  // White background with hard-edged dark shapes.
  const d = new Uint8ClampedArray(w * h * 4).fill(255);
  const put = (x, y, v) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = (y * w + x) * 4;
    d[i] = d[i + 1] = d[i + 2] = v;
  };
  // Filled circle
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const dx = x - 50, dy = y - 50;
      if (dx * dx + dy * dy < 30 * 30) put(x, y, 30);
      // Vertical bar (sharp edge test)
      if (x > 100 && x < 115 && y > 20 && y < 140) put(x, y, 60);
      // Thin line (high frequency test)
      if (y === 150 && x > 10 && x < 150) put(x, y, 0);
    }
  return d;
}

function gaussianBlur(src, w, h, sigma) {
  const radius = Math.ceil(sigma * 3);
  const k = [];
  let ksum = 0;
  for (let i = -radius; i <= radius; i++) {
    const v = Math.exp(-(i * i) / (2 * sigma * sigma));
    k.push(v);
    ksum += v;
  }
  for (let i = 0; i < k.length; i++) k[i] /= ksum;
  const tmp = new Float32Array(w * h * 4);
  const out = new Uint8ClampedArray(w * h * 4);
  // horizontal
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      for (let c = 0; c < 3; c++) {
        let s = 0;
        for (let i = -radius; i <= radius; i++) {
          const xx = Math.min(w - 1, Math.max(0, x + i));
          s += src[(y * w + xx) * 4 + c] * k[i + radius];
        }
        tmp[(y * w + x) * 4 + c] = s;
      }
  // vertical
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      for (let c = 0; c < 3; c++) {
        let s = 0;
        for (let i = -radius; i <= radius; i++) {
          const yy = Math.min(h - 1, Math.max(0, y + i));
          s += tmp[(yy * w + x) * 4 + c] * k[i + radius];
        }
        out[(y * w + x) * 4 + c] = s;
        out[(y * w + x) * 4 + 3] = 255;
      }
  return out;
}

function gradientEnergy(d, w, h) {
  let sum = 0;
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      const gx = Math.abs(d[i + 4] - d[i - 4]);
      const gy = Math.abs(d[i + w * 4] - d[i - w * 4]);
      sum += gx + gy;
    }
  return sum / ((w - 2) * (h - 2));
}

const W = 200, H = 200;
const sharp = makeSharpImage(W, H);
const blurred = gaussianBlur(sharp, W, H, 2.0);

const gSharp = gradientEnergy(sharp, W, H);
const gBlur = gradientEnergy(blurred, W, H);

console.log("blur estimate on blurred image:", JSON.stringify(MRL.deblur.estimateBlur({ data: blurred, width: W, height: H })));

const t0 = Date.now();
const result = MRL.deblur.deblur({ data: blurred, width: W, height: H }, { strength: 1 });
const ms = Date.now() - t0;

const gResult = gradientEnergy(result, W, H);

console.log("gradient energy — sharp:", gSharp.toFixed(2), "| blurred:", gBlur.toFixed(2), "| deblurred:", gResult.toFixed(2));
console.log("recovered vs blurred: " + ((gResult / gBlur - 1) * 100).toFixed(1) + "% more detail");
console.log("recovered vs original: " + ((gResult / gSharp) * 100).toFixed(1) + "%");
console.log("time:", ms + "ms");

if (gResult > gBlur * 1.25) {
  console.log("PASS: deconvolution recovered significant detail");
} else {
  console.log("FAIL: not enough detail recovered");
  process.exit(1);
}
