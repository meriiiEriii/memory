window.MRL = window.MRL || {};

MRL.inpaint = (function () {
  "use strict";

  const MAX_AREA = 1500000;

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function buildOrders(n, w, maskIdx) {
    const rowFwd = new Int32Array(n);
    const rowBwd = new Int32Array(n);
    for (let k = 0; k < n; k++) {
      rowFwd[k] = k;
      rowBwd[k] = n - 1 - k;
    }
    const colKey = new Int32Array(n);
    for (let k = 0; k < n; k++) colKey[k] = maskIdx[k] % w;
    const colFwd = new Int32Array(n);
    for (let k = 0; k < n; k++) colFwd[k] = k;
    colFwd.sort(function (a, b) {
      return colKey[a] - colKey[b];
    });
    return { rowFwd: rowFwd, rowBwd: rowBwd, colFwd: colFwd };
  }

  function initBoundaryFill(w, h, d, idxMap, maskIdx, n) {
    const cur = new Float32Array(n * 3);
    const set = new Uint8Array(n);
    const orders = buildOrders(n, w, maskIdx);
    const lists = [orders.rowFwd, orders.rowBwd, orders.colFwd, orders.rowBwd, orders.rowFwd];
    for (let li = 0; li < lists.length; li++) {
      const list = lists[li];
      for (let si = 0; si < list.length; si++) {
        const k = list[si];
        if (set[k]) continue;
        const p = maskIdx[k];
        const x = p % w;
        const y = (p / w) | 0;
        let r = 0;
        let g = 0;
        let b = 0;
        let c = 0;
        for (let dir = 0; dir < 4; dir++) {
          let q = -1;
          if (dir === 0 && x > 0) q = p - 1;
          else if (dir === 1 && x < w - 1) q = p + 1;
          else if (dir === 2 && y > 0) q = p - w;
          else if (dir === 3 && y < h - 1) q = p + w;
          if (q < 0) continue;
          const mi = idxMap[q];
          if (mi < 0) {
            r += d[q * 4];
            g += d[q * 4 + 1];
            b += d[q * 4 + 2];
            c++;
          } else if (set[mi]) {
            r += cur[mi * 3];
            g += cur[mi * 3 + 1];
            b += cur[mi * 3 + 2];
            c++;
          }
        }
        if (c > 0) {
          cur[k * 3] = r / c;
          cur[k * 3 + 1] = g / c;
          cur[k * 3 + 2] = b / c;
          set[k] = 1;
        }
      }
    }
    for (let k = 0; k < n; k++) {
      if (!set[k]) {
        cur[k * 3] = 128;
        cur[k * 3 + 1] = 128;
        cur[k * 3 + 2] = 128;
      }
    }
    return cur;
  }

  function distanceTransform(w, h, idxMap, maskIdx, n) {
    const dist = new Uint16Array(w * h);
    let front = [];
    for (let k = 0; k < n; k++) {
      const p = maskIdx[k];
      const x = p % w;
      const y = (p / w) | 0;
      if (
        (x > 0 && idxMap[p - 1] < 0) ||
        (x < w - 1 && idxMap[p + 1] < 0) ||
        (y > 0 && idxMap[p - w] < 0) ||
        (y < h - 1 && idxMap[p + w] < 0)
      ) {
        dist[p] = 1;
        front.push(p);
      }
    }
    let layer = 1;
    while (front.length) {
      layer++;
      const next = [];
      for (let i = 0; i < front.length; i++) {
        const p = front[i];
        const x = p % w;
        const y = (p / w) | 0;
        for (let dir = 0; dir < 4; dir++) {
          let q = -1;
          if (dir === 0 && x > 0) q = p - 1;
          else if (dir === 1 && x < w - 1) q = p + 1;
          else if (dir === 2 && y > 0) q = p - w;
          else if (dir === 3 && y < h - 1) q = p + w;
          if (q < 0) continue;
          if (idxMap[q] >= 0 && dist[q] === 0) {
            dist[q] = layer;
            next.push(q);
          }
        }
      }
      front = next;
    }
    return dist;
  }

  function diffusionRefine(w, h, d, idxMap, maskIdx, n, cur, iterations, onBatch) {
    return new Promise(function (resolve) {
      const bufB = new Float32Array(n * 3);
      let src = cur;
      let dst = bufB;
      let done = 0;
      function step() {
        const end = Math.min(iterations, done + 5);
        for (; done < end; done++) {
          for (let k = 0; k < n; k++) {
            const p = maskIdx[k];
            const x = p % w;
            const y = (p / w) | 0;
            let r = 0;
            let g = 0;
            let b = 0;
            let c = 0;
            for (let dir = 0; dir < 4; dir++) {
              let q = -1;
              if (dir === 0 && x > 0) q = p - 1;
              else if (dir === 1 && x < w - 1) q = p + 1;
              else if (dir === 2 && y > 0) q = p - w;
              else if (dir === 3 && y < h - 1) q = p + w;
              if (q < 0) continue;
              const mi = idxMap[q];
              if (mi < 0) {
                r += d[q * 4];
                g += d[q * 4 + 1];
                b += d[q * 4 + 2];
              } else {
                r += src[mi * 3];
                g += src[mi * 3 + 1];
                b += src[mi * 3 + 2];
              }
              c++;
            }
            dst[k * 3] = r / c;
            dst[k * 3 + 1] = g / c;
            dst[k * 3 + 2] = b / c;
          }
          const t = src;
          src = dst;
          dst = t;
        }
        if (onBatch) onBatch(done / iterations);
        if (done < iterations) {
          setTimeout(step, 0);
        } else {
          resolve(src);
        }
      }
      setTimeout(step, 0);
    });
  }

  function quarterScale(w, h, d, idxMap, s) {
    const qw = Math.max(1, Math.ceil(w / s));
    const qh = Math.max(1, Math.ceil(h / s));
    const qd = new Float32Array(qw * qh * 3);
    const qKnown = new Uint8Array(qw * qh);
    for (let qy = 0; qy < qh; qy++) {
      for (let qx = 0; qx < qw; qx++) {
        const qi = qy * qw + qx;
        const x0 = qx * s;
        const y0 = qy * s;
        const x1 = Math.min(x0 + s, w);
        const y1 = Math.min(y0 + s, h);
        let r = 0;
        let g = 0;
        let b = 0;
        let c = 0;
        let allKnown = 1;
        for (let y = y0; y < y1 && allKnown; y++) {
          for (let x = x0; x < x1 && allKnown; x++) {
            const p = y * w + x;
            if (idxMap[p] >= 0) {
              allKnown = 0;
            } else {
              r += d[p * 4];
              g += d[p * 4 + 1];
              b += d[p * 4 + 2];
              c++;
            }
          }
        }
        if (allKnown && c > 0) {
          qd[qi * 3] = r / c;
          qd[qi * 3 + 1] = g / c;
          qd[qi * 3 + 2] = b / c;
          qKnown[qi] = 1;
        }
      }
    }
    return { qw: qw, qh: qh, qd: qd, qKnown: qKnown };
  }

  function quarterFill(qw, qh, qd, qKnown, iterations) {
    const n = qw * qh;
    const cur = new Float32Array(n * 3);
    const nxt = new Float32Array(n * 3);
    for (let qi = 0; qi < n; qi++) {
      const known = qKnown[qi] ? 1 : 0;
      cur[qi * 3] = known ? qd[qi * 3] : 128;
      cur[qi * 3 + 1] = known ? qd[qi * 3 + 1] : 128;
      cur[qi * 3 + 2] = known ? qd[qi * 3 + 2] : 128;
    }
    for (let it = 0; it < iterations; it++) {
      for (let qi = 0; qi < n; qi++) {
        const x = qi % qw;
        const y = (qi / qw) | 0;
        let r = 0;
        let g = 0;
        let b = 0;
        let c = 0;
        for (let dir = 0; dir < 4; dir++) {
          let q = -1;
          if (dir === 0 && x > 0) q = qi - 1;
          else if (dir === 1 && x < qw - 1) q = qi + 1;
          else if (dir === 2 && y > 0) q = qi - qw;
          else if (dir === 3 && y < qh - 1) q = qi + qw;
          if (q < 0) continue;
          r += cur[q * 3];
          g += cur[q * 3 + 1];
          b += cur[q * 3 + 2];
          c++;
        }
        if (c > 0) {
          nxt[qi * 3] = r / c;
          nxt[qi * 3 + 1] = g / c;
          nxt[qi * 3 + 2] = b / c;
        }
      }
      cur.set(nxt);
    }
    for (let qi = 0; qi < n; qi++) {
      if (qKnown[qi]) {
        cur[qi * 3] = qd[qi * 3];
        cur[qi * 3 + 1] = qd[qi * 3 + 1];
        cur[qi * 3 + 2] = qd[qi * 3 + 2];
      }
    }
    return cur;
  }

  function buildValidIntegral(qw, qh, qKnown) {
    const pad = qw + 1;
    const integ = new Int32Array(pad * (qh + 1));
    for (let y = 0; y < qh; y++) {
      let rowSum = 0;
      const ib = (y + 1) * pad;
      const it = y * pad;
      for (let x = 0; x < qw; x++) {
        rowSum += qKnown[y * qw + x] ? 1 : 0;
        integ[ib + x + 1] = integ[it + x + 1] + rowSum;
      }
    }
    return integ;
  }

  function patchFullValid(integ, qw, sx, sy, R) {
    const x0 = sx - R;
    const y0 = sy - R;
    const x1 = sx + R + 1;
    const y1 = sy + R + 1;
    const area = (x1 - x0) * (y1 - y0);
    const a = integ[y0 * (qw + 1) + x0];
    const b = integ[y0 * (qw + 1) + x1];
    const c = integ[y1 * (qw + 1) + x0];
    const e = integ[y1 * (qw + 1) + x1];
    return e - b - c + a === area;
  }

  function patchMatchStage(w, h, d, q, qCur, idxMap, s, filled, maskIdx, n, onProgress, done) {
    const qw = q.qw;
    const qh = q.qh;
    const qKnown = q.qKnown;
    const qn = qw * qh;
    const R = 2;
    const qd = qCur;
    const integ = buildValidIntegral(qw, qh, qKnown);
    const qHole = [];
    for (let qi = 0; qi < qn; qi++) {
      if (!qKnown[qi]) qHole.push(qi);
    }
    const validSrc = [];
    for (let qi = 0; qi < qn; qi++) {
      const qx = qi % qw;
      const qy = (qi / qw) | 0;
      if (!qKnown[qi]) continue;
      if (qx >= R && qx < qw - R && qy >= R && qy < qh - R) validSrc.push(qi);
    }
    if (!validSrc.length) {
      composeFull();
      return;
    }

    const offX = new Int16Array(qn);
    const offY = new Int16Array(qn);
    const texed = new Uint8Array(qn);
    const rand = mulberry32(0x9e3779b9);
    for (let hi = 0; hi < qHole.length; hi++) {
      const qi = qHole[hi];
      const src = validSrc[(rand() * validSrc.length) | 0];
      offX[qi] = (src % qw) - (qi % qw);
      offY[qi] = ((src / qw) | 0) - ((qi / qw) | 0);
    }

    const srcMean = new Float32Array(qn * 3);
    for (let vi = 0; vi < validSrc.length; vi++) {
      const qi = validSrc[vi];
      const cx = qi % qw;
      const cy = (qi / qw) | 0;
      let r = 0;
      let g = 0;
      let b = 0;
      let c = 0;
      for (let dy = -R; dy <= R; dy++) {
        for (let dx = -R; dx <= R; dx++) {
          const pj = (cy + dy) * qw + (cx + dx);
          r += q.qd[pj * 3];
          g += q.qd[pj * 3 + 1];
          b += q.qd[pj * 3 + 2];
          c++;
        }
      }
      srcMean[qi * 3] = r / c;
      srcMean[qi * 3 + 1] = g / c;
      srcMean[qi * 3 + 2] = b / c;
    }
    function ssd(tx, ty, sx, sy) {
      if (sx < R || sx >= qw - R || sy < R || sy >= qh - R) return Infinity;
      if (!patchFullValid(integ, qw, sx, sy, R)) return Infinity;
      const sqi = sy * qw + sx;
      const smR = srcMean[sqi * 3];
      const smG = srcMean[sqi * 3 + 1];
      const smB = srcMean[sqi * 3 + 2];
      let tsumR = 0;
      let tsumG = 0;
      let tsumB = 0;
      let wsum = 0;
      const dy0 = Math.max(-R, -ty);
      const dy1 = Math.min(R, qh - 1 - ty);
      const dx0 = Math.max(-R, -tx);
      const dx1 = Math.min(R, qw - 1 - tx);
      for (let dy = dy0; dy <= dy1; dy++) {
        const trow = (ty + dy) * qw;
        for (let dx = dx0; dx <= dx1; dx++) {
          const tqi = trow + tx + dx;
          const wt = qKnown[tqi] ? 1 : texed[tqi] ? 0.8 : 0.25;
          tsumR += wt * qd[tqi * 3];
          tsumG += wt * qd[tqi * 3 + 1];
          tsumB += wt * qd[tqi * 3 + 2];
          wsum += wt;
        }
      }
      const tMeanR = tsumR / wsum;
      const tMeanG = tsumG / wsum;
      const tMeanB = tsumB / wsum;
      let sum = 0;
      for (let dy = dy0; dy <= dy1; dy++) {
        const trow = (ty + dy) * qw;
        const srow = (sy + dy) * qw;
        for (let dx = dx0; dx <= dx1; dx++) {
          const tqi = trow + tx + dx;
          const sq2 = srow + sx + dx;
          const wt = qKnown[tqi] ? 1 : texed[tqi] ? 0.8 : 0.25;
          const dr = qd[tqi * 3] - tMeanR - (qd[sq2 * 3] - smR);
          const dg = qd[tqi * 3 + 1] - tMeanG - (qd[sq2 * 3 + 1] - smG);
          const db = qd[tqi * 3 + 2] - tMeanB - (qd[sq2 * 3 + 2] - smB);
          sum += wt * (dr * dr + dg * dg + db * db);
        }
      }
      const mR = tMeanR - smR;
      const mG = tMeanG - smG;
      const mB = tMeanB - smB;
      const struct = (sum + 0.35 * (mR * mR + mG * mG + mB * mB) * wsum) / wsum;
      const ox = sx - tx;
      const oy = sy - ty;
      return struct + 0.006 * (ox * ox + oy * oy);
    }

    const layerDist = new Int32Array(qn);
    for (let hi = 0; hi < qHole.length; hi++) layerDist[qHole[hi]] = -1;
    let frontier = [];
    for (let hi = 0; hi < qHole.length; hi++) {
      const qi = qHole[hi];
      const x = qi % qw;
      const y = (qi / qw) | 0;
      if (
        (x > 0 && qKnown[qi - 1]) ||
        (x < qw - 1 && qKnown[qi + 1]) ||
        (y > 0 && qKnown[qi - qw]) ||
        (y < qh - 1 && qKnown[qi + qw])
      ) {
        layerDist[qi] = 1;
        frontier.push(qi);
      }
    }
    let maxLayer = 1;
    while (frontier.length) {
      maxLayer++;
      const next = [];
      for (let i = 0; i < frontier.length; i++) {
        const qi = frontier[i];
        const x = qi % qw;
        const y = (qi / qw) | 0;
        for (let dir = 0; dir < 4; dir++) {
          let nb = -1;
          if (dir === 0 && x > 0) nb = qi - 1;
          else if (dir === 1 && x < qw - 1) nb = qi + 1;
          else if (dir === 2 && y > 0) nb = qi - qw;
          else if (dir === 3 && y < qh - 1) nb = qi + qw;
          if (nb < 0) continue;
          if (!qKnown[nb] && layerDist[nb] === -1) {
            layerDist[nb] = maxLayer;
            next.push(nb);
          }
        }
      }
      frontier = next;
    }
    maxLayer--;
    const layers = new Array(maxLayer + 2);
    for (let li = 0; li < layers.length; li++) layers[li] = [];
    for (let hi = 0; hi < qHole.length; hi++) layers[layerDist[qHole[hi]]].push(qHole[hi]);

    let curLayer = 1;
    let passesDone = 0;
    const PASSES = 2;
    function layerStep() {
      if (curLayer > maxLayer) {
        if (onProgress) onProgress(0.9);
        composeFull();
        return;
      }
      const cells = layers[curLayer];
      const fwd = passesDone % 2 === 0;
      for (let ci = 0; ci < cells.length; ci++) {
        const qi = fwd ? cells[ci] : cells[cells.length - 1 - ci];
        const tx = qi % qw;
        const ty = (qi / qw) | 0;
        let best = ssd(tx, ty, tx + offX[qi], ty + offY[qi]);
        let bx = offX[qi];
        let by = offY[qi];
        const neigh = fwd ? [qi - 1, qi - qw, qi + 1, qi + qw] : [qi + 1, qi + qw, qi - 1, qi - qw];
        for (let nq = 0; nq < 4; nq++) {
          const nb = neigh[nq];
          if (nb < 0 || nb >= qn) continue;
          if (offX[nb] === 0 && offY[nb] === 0) continue;
          const nx = tx + offX[nb];
          const ny = ty + offY[nb];
          if (nx < R || nx >= qw - R || ny < R || ny >= qh - R) continue;
          const sc = ssd(tx, ty, nx, ny);
          if (sc < best) {
            best = sc;
            bx = offX[nb];
            by = offY[nb];
          }
        }
        for (let t = 0; t < 2; t++) {
          const src = validSrc[(rand() * validSrc.length) | 0];
          const nx = (src % qw) - tx;
          const ny = ((src / qw) | 0) - ty;
          if (nx < R || nx >= qw - R || ny < R || ny >= qh - R) continue;
          const sc = ssd(tx, ty, nx, ny);
          if (sc < best) {
            best = sc;
            bx = nx;
            by = ny;
          }
        }
        offX[qi] = bx;
        offY[qi] = by;
      }
      passesDone++;
      if (onProgress) onProgress(0.18 + 0.72 * ((curLayer - 1 + passesDone / PASSES) / maxLayer));
      if (passesDone < PASSES) {
        setTimeout(layerStep, 0);
      } else {
        for (let ci = 0; ci < cells.length; ci++) {
          const qi = cells[ci];
          const sx = Math.max(0, Math.min(qw - 1, (qi % qw) + offX[qi]));
          const sy = Math.max(0, Math.min(qh - 1, ((qi / qw) | 0) + offY[qi]));
          const sqi = sy * qw + sx;
          if (qKnown[sqi]) {
            qCur[qi * 3] = q.qd[sqi * 3];
            qCur[qi * 3 + 1] = q.qd[sqi * 3 + 1];
            qCur[qi * 3 + 2] = q.qd[sqi * 3 + 2];
          }
          texed[qi] = 1;
        }
        curLayer++;
        passesDone = 0;
        setTimeout(layerStep, 0);
      }
    }

    function noiseSigma() {
      let sv = 0;
      let count = 0;
      const step = Math.max(1, Math.round(Math.sqrt((w * h) / 16000)));
      for (let y = 1; y < h - 1; y += step) {
        for (let x = 1; x < w - 1; x += step) {
          const p = y * w + x;
          if (idxMap[p] >= 0) continue;
          const center = d[p * 4] * 0.299 + d[p * 4 + 1] * 0.587 + d[p * 4 + 2] * 0.114;
          let mean = 0;
          let wc = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const q2 = (y + dy) * w + (x + dx);
              if (idxMap[q2] >= 0) continue;
              mean += d[q2 * 4] * 0.299 + d[q2 * 4 + 1] * 0.587 + d[q2 * 4 + 2] * 0.114;
              wc++;
            }
          }
          if (wc > 4) {
            const diff = center - mean / wc;
            sv += diff * diff;
            count++;
          }
        }
      }
      return count > 40 ? Math.sqrt(sv / count) * 0.85 : 2.2;
    }

    function composeFull() {
      const dist = distanceTransform(w, h, idxMap, maskIdx, n);
      const gramp = noiseSigma();
      const rnd = mulberry32(0x5eed1234);
      const out = new Float32Array(n * 3);
      const tgtMean = new Float32Array(qn * 3);
      for (let qi = 0; qi < qn; qi++) {
        const cx = qi % qw;
        const cy = (qi / qw) | 0;
        let mr = 0;
        let mg = 0;
        let mb = 0;
        let c = 0;
        for (let dy = -R; dy <= R; dy++) {
          const yy = Math.max(0, Math.min(qh - 1, cy + dy));
          for (let dx = -R; dx <= R; dx++) {
            const xx = Math.max(0, Math.min(qw - 1, cx + dx));
            const pj = yy * qw + xx;
            mr += qCur[pj * 3];
            mg += qCur[pj * 3 + 1];
            mb += qCur[pj * 3 + 2];
            c++;
          }
        }
        tgtMean[qi * 3] = mr / c;
        tgtMean[qi * 3 + 1] = mg / c;
        tgtMean[qi * 3 + 2] = mb / c;
      }
      let k = 0;
      const chunk = 40000;
      function compStep() {
        const end = Math.min(n, k + chunk);
        for (; k < end; k++) {
          const p = maskIdx[k];
          const x = p % w;
          const y = (p / w) | 0;
          const fx = (x % s) / s;
          const fy = (y % s) / s;
          const cx = (x / s) | 0;
          const cy = (y / s) | 0;
          let tr = 0;
          let tg = 0;
          let tb = 0;
          let wSum = 0;
          for (let oy = 0; oy <= 1; oy++) {
            const qy = Math.min(qh - 1, cy + oy);
            for (let ox = 0; ox <= 1; ox++) {
              const qx = Math.min(qw - 1, cx + ox);
              const qi = qy * qw + qx;
              if (offX[qi] === 0 && offY[qi] === 0 && qKnown[qi]) continue;
              const wx = ox === 0 ? 1 - fx : fx;
              const wy = oy === 0 ? 1 - fy : fy;
              const wq = wx * wy;
              if (wq < 1e-4) continue;
              const sxp = x + offX[qi] * s;
              const syp = y + offY[qi] * s;
              const clx = Math.max(0, Math.min(w - 1, sxp));
              const cly = Math.max(0, Math.min(h - 1, syp));
              const sq = cly * w + clx;
              if (idxMap[sq] >= 0) continue;
              const sQx = Math.max(0, Math.min(qw - 1, qx + offX[qi]));
              const sQy = Math.max(0, Math.min(qh - 1, qy + offY[qi]));
              const srcQi = sQy * qw + sQx;
              let vr;
              let vg;
              let vb;
              if (srcMean[srcQi * 3] !== 0 || srcMean[srcQi * 3 + 1] !== 0 || srcMean[srcQi * 3 + 2] !== 0) {
                const dvR = tgtMean[qi * 3] - srcMean[srcQi * 3];
                const dvG = tgtMean[qi * 3 + 1] - srcMean[srcQi * 3 + 1];
                const dvB = tgtMean[qi * 3 + 2] - srcMean[srcQi * 3 + 2];
                vr = d[sq * 4] + dvR;
                vg = d[sq * 4 + 1] + dvG;
                vb = d[sq * 4 + 2] + dvB;
              } else {
                vr = d[sq * 4];
                vg = d[sq * 4 + 1];
                vb = d[sq * 4 + 2];
              }
              tr += wq * vr;
              tg += wq * vg;
              tb += wq * vb;
              wSum += wq;
            }
          }
          const depth = dist[p];
          const tRaw = Math.min(1, Math.max(0, (depth - 2) / 7));
          const wTex = tRaw * tRaw * (3 - 2 * tRaw);
          let texR;
          let texG;
          let texB;
          if (wSum > 0.001) {
            texR = tr / wSum;
            texG = tg / wSum;
            texB = tb / wSum;
          } else {
            texR = filled[k * 3];
            texG = filled[k * 3 + 1];
            texB = filled[k * 3 + 2];
          }
          let orr = filled[k * 3] * (1 - wTex) + texR * wTex;
          let ogg = filled[k * 3 + 1] * (1 - wTex) + texG * wTex;
          let obb = filled[k * 3 + 2] * (1 - wTex) + texB * wTex;
          const gamp = gramp * (0.12 + 0.88 * wTex);
          if (gamp > 0.01) {
            const u1 = Math.max(1e-6, rnd());
            const u2 = rnd();
            const mag = Math.sqrt(-2 * Math.log(u1));
            const ang = 6.283185307179586 * u2;
            orr += gamp * mag * Math.cos(ang);
            ogg += gamp * mag * Math.sin(ang);
            obb += gamp * mag * Math.cos(ang + 1.5707963267948966);
          }
          out[k * 3] = orr;
          out[k * 3 + 1] = ogg;
          out[k * 3 + 2] = obb;
        }
        if (k < n) {
          setTimeout(compStep, 0);
        } else {
          edgeSoften(dist, out);
          reanchor(dist, out);
          finish(out);
        }
      }
      compStep();
    }

    function edgeSoften(dist, out) {
      for (let k = 0; k < n; k++) {
        const p = maskIdx[k];
        if (dist[p] > 2) continue;
        const x = p % w;
        const y = (p / w) | 0;
        let r = 0;
        let g = 0;
        let b = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const xx = Math.max(0, Math.min(w - 1, x + dx));
            const yy = Math.max(0, Math.min(h - 1, y + dy));
            const q2 = yy * w + xx;
            const mi = idxMap[q2];
            if (mi >= 0) {
              r += out[mi * 3];
              g += out[mi * 3 + 1];
              b += out[mi * 3 + 2];
            } else {
              r += d[q2 * 4];
              g += d[q2 * 4 + 1];
              b += d[q2 * 4 + 2];
            }
          }
        }
        const br = r / 9;
        const bg = g / 9;
        const bb = b / 9;
        out[k * 3] = out[k * 3] * 0.45 + br * 0.55;
        out[k * 3 + 1] = out[k * 3 + 1] * 0.45 + bg * 0.55;
        out[k * 3 + 2] = out[k * 3 + 2] * 0.45 + bb * 0.55;
      }
    }

    function reanchor(dist, out) {
      const orig = new Float32Array(out);
      let cur = out.slice();
      let nxt2 = new Float32Array(n * 3);
      const passes = 10;
      for (let it = 0; it < passes; it++) {
        for (let k = 0; k < n; k++) {
          const p = maskIdx[k];
          const x = p % w;
          const y = (p / w) | 0;
          let r = 0;
          let g = 0;
          let b = 0;
          let c = 0;
          for (let dir = 0; dir < 4; dir++) {
            let q = -1;
            if (dir === 0 && x > 0) q = p - 1;
            else if (dir === 1 && x < w - 1) q = p + 1;
            else if (dir === 2 && y > 0) q = p - w;
            else if (dir === 3 && y < h - 1) q = p + w;
            if (q < 0) continue;
            const mi = idxMap[q];
            if (mi < 0) {
              r += d[q * 4];
              g += d[q * 4 + 1];
              b += d[q * 4 + 2];
            } else {
              r += cur[mi * 3];
              g += cur[mi * 3 + 1];
              b += cur[mi * 3 + 2];
            }
            c++;
          }
          nxt2[k * 3] = r / c;
          nxt2[k * 3 + 1] = g / c;
          nxt2[k * 3 + 2] = b / c;
        }
        const t2 = cur;
        cur = nxt2;
        nxt2 = t2;
      }
      for (let k = 0; k < n; k++) {
        const p = maskIdx[k];
        const wA = Math.max(0, Math.min(0.6, ((6 - dist[p]) / 6) * 0.6));
        out[k * 3] = orig[k * 3] * (1 - wA) + cur[k * 3] * wA;
        out[k * 3 + 1] = orig[k * 3 + 1] * (1 - wA) + cur[k * 3 + 1] * wA;
        out[k * 3 + 2] = orig[k * 3 + 2] * (1 - wA) + cur[k * 3 + 2] * wA;
      }
    }

    function finish(out) {
      done(out);
    }

    setTimeout(layerStep, 0);
  }

  function run(imageData, maskData, onProgress) {
    return new Promise(function (resolve) {
      const w = imageData.width;
      const h = imageData.height;
      const d = imageData.data;
      const m = maskData.data;

      if (maskData.width !== w || maskData.height !== h) {
        resolve(-2);
        return;
      }

      let n = 0;
      for (let a = 3; a < m.length; a += 4) {
        if (m[a] > 8) n++;
      }
      if (n === 0) {
        resolve(0);
        return;
      }
      if (n > MAX_AREA) {
        resolve(-1);
        return;
      }

      const idxMap = new Int32Array(w * h).fill(-1);
      const maskIdx = new Int32Array(n);
      let idx = 0;
      for (let p = 0, a = 3; p < w * h; p++, a += 4) {
        if (m[a] > 8) {
          idxMap[p] = idx;
          maskIdx[idx++] = p;
        }
      }

      function report(f) {
        if (onProgress) onProgress(f);
      }

      report(0.02);
      let base = initBoundaryFill(w, h, d, idxMap, maskIdx, n);
      report(0.1);

      const iterations = Math.round(Math.max(40, Math.min(90, 6000000 / n)));
      diffusionRefine(w, h, d, idxMap, maskIdx, n, base, iterations, function (f) {
        report(0.1 + 0.07 * f);
      }).then(function (filled) {
        const s = Math.max(2, Math.min(8, Math.round(Math.sqrt(n / 50000))));
        const qs = quarterScale(w, h, d, idxMap, s);
        const qCur = quarterFill(qs.qw, qs.qh, qs.qd, qs.qKnown, 48);
        report(0.18);
        patchMatchStage(w, h, d, qs, qCur, idxMap, s, filled, maskIdx, n, onProgress, function (out) {
          for (let k = 0; k < n; k++) {
            const p = maskIdx[k];
            d[p * 4] = Math.round(Math.max(0, Math.min(255, out[k * 3])));
            d[p * 4 + 1] = Math.round(Math.max(0, Math.min(255, out[k * 3 + 1])));
            d[p * 4 + 2] = Math.round(Math.max(0, Math.min(255, out[k * 3 + 2])));
          }
          resolve(n);
        });
      });
    });
  }

  function floodFromSeed(imgData, sx, sy, tolerance) {
    const w = imgData.width;
    const h = imgData.height;
    const d = imgData.data;
    const n = w * h;
    const T = Math.max(0, tolerance);
    const x0 = Math.min(w - 1, Math.max(0, Math.round(sx)));
    const y0 = Math.min(h - 1, Math.max(0, Math.round(sy)));
    const seed = y0 * w + x0;
    const sr = d[seed * 4];
    const sg = d[seed * 4 + 1];
    const sb = d[seed * 4 + 2];
    const mask = new Uint8Array(n);
    const queue = new Int32Array(n);
    let head = 0;
    let tail = 0;
    mask[seed] = 255;
    queue[tail++] = seed;
    while (head < tail) {
      const p = queue[head++];
      const x = p % w;
      const y = (p / w) | 0;
      if (x > 0) {
        const q = p - 1;
        const i = q * 4;
        if (!mask[q] && (Math.abs(d[i] - sr) + Math.abs(d[i + 1] - sg) + Math.abs(d[i + 2] - sb)) / 3 <= T) {
          mask[q] = 255;
          queue[tail++] = q;
        }
      }
      if (x < w - 1) {
        const q = p + 1;
        const i = q * 4;
        if (!mask[q] && (Math.abs(d[i] - sr) + Math.abs(d[i + 1] - sg) + Math.abs(d[i + 2] - sb)) / 3 <= T) {
          mask[q] = 255;
          queue[tail++] = q;
        }
      }
      if (y > 0) {
        const q = p - w;
        const i = q * 4;
        if (!mask[q] && (Math.abs(d[i] - sr) + Math.abs(d[i + 1] - sg) + Math.abs(d[i + 2] - sb)) / 3 <= T) {
          mask[q] = 255;
          queue[tail++] = q;
        }
      }
      if (y < h - 1) {
        const q = p + w;
        const i = q * 4;
        if (!mask[q] && (Math.abs(d[i] - sr) + Math.abs(d[i + 1] - sg) + Math.abs(d[i + 2] - sb)) / 3 <= T) {
          mask[q] = 255;
          queue[tail++] = q;
        }
      }
    }
    return mask;
  }

  return {
    run: run,
    floodFromSeed: floodFromSeed,
  };
})();
