window.MRL = window.MRL || {};

MRL.sample = (function () {
  const W = 960;
  const H = 720;

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function drawScene(ctx, w, h) {
    const sky = ctx.createLinearGradient(0, 0, 0, h * 0.62);
    sky.addColorStop(0, "#f4e3be");
    sky.addColorStop(0.55, "#eecf9d");
    sky.addColorStop(1, "#e2b47d");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h * 0.64);

    const sunY = h * 0.3;
    const glow = ctx.createRadialGradient(w * 0.68, sunY, 12, w * 0.68, sunY, 190);
    glow.addColorStop(0, "rgba(255,244,214,0.95)");
    glow.addColorStop(0.4, "rgba(255,224,158,0.5)");
    glow.addColorStop(1, "rgba(255,224,158,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h * 0.65);
    ctx.beginPath();
    ctx.arc(w * 0.68, sunY, 46, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,250,232,0.95)";
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.5)";
    const cloud = (cx, cy, s) => {
      ctx.beginPath();
      ctx.ellipse(cx, cy, s * 1.9, s * 0.6, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + s, cy - s * 0.3, s * 1.2, s * 0.5, 0, 0, Math.PI * 2);
      ctx.ellipse(cx - s * 1.1, cy - s * 0.15, s, s * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
    };
    cloud(w * 0.22, h * 0.2, 30);
    cloud(w * 0.52, h * 0.13, 22);
    cloud(w * 0.8, h * 0.24, 26);

    const hill = (baseY, amp, freq, phase, color) => {
      ctx.beginPath();
      ctx.moveTo(0, h);
      ctx.lineTo(0, baseY);
      for (let x = 0; x <= w; x += 8) {
        ctx.lineTo(x, baseY + Math.sin(x * freq + phase) * amp);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    };
    hill(h * 0.6, 16, 0.006, 1.2, "#b57f52");
    hill(h * 0.68, 12, 0.009, 4.1, "#a06a44");
    hill(h * 0.78, 9, 0.011, 2.2, "#7d5136");

    const ground = ctx.createLinearGradient(0, h * 0.74, 0, h);
    ground.addColorStop(0, "#8a5a3a");
    ground.addColorStop(1, "#5f3d26");
    ctx.fillStyle = ground;
    ctx.fillRect(0, h * 0.76, w, h * 0.24);

    ctx.strokeStyle = "rgba(228,205,168,0.75)";
    ctx.lineWidth = 26;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(w * 0.36, h);
    ctx.quadraticCurveTo(w * 0.44, h * 0.86, w * 0.62, h * 0.785);
    ctx.stroke();

    ctx.fillStyle = "#4a301d";
    ctx.fillRect(w * 0.265, h * 0.6, 14, h * 0.17);
    ctx.beginPath();
    ctx.arc(w * 0.272, h * 0.55, 52, 0, Math.PI * 2);
    ctx.arc(w * 0.235, h * 0.59, 34, 0, Math.PI * 2);
    ctx.arc(w * 0.312, h * 0.585, 36, 0, Math.PI * 2);
    ctx.fillStyle = "#4c6744";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(w * 0.272, h * 0.586, 50, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(88,116,78,0.55)";
    ctx.fill();

    const hx = w * 0.63;
    const hy = h * 0.645;
    const hw = 170;
    const hh = 118;
    ctx.fillStyle = "#c8b49a";
    ctx.fillRect(hx, hy, hw, hh);
    ctx.fillStyle = "#efe3cf";
    ctx.fillRect(hx, hy, hw, 8);
    ctx.fillStyle = "#6d3a2a";
    ctx.beginPath();
    ctx.moveTo(hx - 16, hy);
    ctx.lineTo(hx + hw / 2, hy - 74);
    ctx.lineTo(hx + hw + 16, hy);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#5f3d26";
    ctx.fillRect(hx + hw * 0.42, hy + hh * 0.44, 26, hh * 0.56);
    ctx.fillStyle = "#3d2c1e";
    ctx.fillRect(hx + 18, hy + 22, 34, 40);
    ctx.fillRect(hx + hw - 52, hy + 22, 34, 40);
    ctx.strokeStyle = "#efe3cf";
    ctx.lineWidth = 4;
    ctx.strokeRect(hx + 18, hy + 22, 34, 40);
    ctx.strokeRect(hx + hw - 52, hy + 22, 34, 40);
    ctx.fillStyle = "#4a2f1c";
    ctx.fillRect(hx - 42, hy + hh + 6, 6, 26);
    ctx.fillRect(hx + hw + 36, hy + hh + 6, 6, 26);
    ctx.fillRect(hx - 42, hy + hh + 12, hw + 84, 5);

    const pickets = 11;
    for (let i = 0; i < pickets; i++) {
      const px = w * 0.05 + i * (w * 0.14);
      if (px > w * 0.9) break;
      ctx.fillStyle = "#e8dcc6";
      ctx.fillRect(px, hy + hh - 6, 7, 36);
    }
    ctx.fillStyle = "#e8dcc6";
    ctx.fillRect(w * 0.05, hy + hh + 2, w * 0.16, 5);

    const flock = [
      [0.35, 0.32],
      [0.4, 0.29],
      [0.44, 0.33],
      [0.12, 0.4],
    ];
    ctx.strokeStyle = "rgba(74,55,40,0.6)";
    ctx.lineWidth = 2.4;
    flock.forEach(([fx, fy]) => {
      const fxp = fx * w;
      const fyp = fy * h;
      ctx.beginPath();
      ctx.moveTo(fxp - 8, fyp);
      ctx.quadraticCurveTo(fxp - 3, fyp - 5, fxp, fyp);
      ctx.quadraticCurveTo(fxp + 3, fyp - 5, fxp + 8, fyp);
      ctx.stroke();
    });
  }

  function makeCleanCanvas() {
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d");
    drawScene(ctx, W, H);
    return c;
  }

  function makeFadedCanvas() {
    const c = makeCleanCanvas();
    const ctx = c.getContext("2d");
    const img = ctx.getImageData(0, 0, W, H);
    const d = img.data;
    const rnd = mulberry32(7071);
    for (let i = 0; i < d.length; i += 4) {
      const v = (rnd() - 0.5) * 26;
      d[i] = (d[i] + v) | 0;
      d[i + 1] = (d[i + 1] + v * 0.9) | 0;
      d[i + 2] = (d[i + 2] + v * 0.8) | 0;
      const lum = 0.299 * d[i] + 0.587 * (d[i + 1]) + 0.114 * (d[i + 2]);
      const lift = (255 - lum) * 0.18;
      d[i] = Math.min(255, d[i] + lift);
      d[i + 1] = Math.min(255, d[i + 1] + lift * 0.85);
      d[i + 2] = Math.min(255, d[i + 2] + lift * 0.55);
      const s = 0.42;
      d[i] = (d[i] * s + 112 * (1 - s)) | 0;
      d[i + 1] = (d[i + 1] * s + 84 * (1 - s)) | 0;
      d[i + 2] = (d[i + 2] * s + 40 * (1 - s)) | 0;
    }
    ctx.putImageData(img, 0, 0);

    const rand = mulberry32(4242);
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = "#f2e6d2";
    for (let i = 0; i < 240; i++) {
      ctx.beginPath();
      ctx.arc(rand() * W, rand() * H, rand() * 1.8 + 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.fillStyle = "rgba(146,101,42,0.28)";
    for (let i = 0; i < 7; i++) {
      const sx = rand() * W;
      const sy = rand() * H;
      ctx.beginPath();
      ctx.ellipse(sx, sy, 12 + rand() * 40, 9 + rand() * 24, rand() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
      if (rand() > 0.4) {
        ctx.beginPath();
        ctx.ellipse(sx + 8, sy + 10, 20 + rand() * 30, 14 + rand() * 16, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.fillStyle = "rgba(60,38,20,0.4)";
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.ellipse(rand() * W, rand() * H, 14 + rand() * 26, 10 + rand() * 18, rand(), 0, Math.PI * 2);
      ctx.fill();
    }

    const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.78);
    vig.addColorStop(0, "rgba(20,12,6,0)");
    vig.addColorStop(1, "rgba(20,12,6,0.5)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = "rgba(255,248,236,0.5)";
    ctx.lineWidth = 3;
    ctx.strokeRect(6, 6, W - 12, H - 12);
    ctx.strokeStyle = "rgba(40,24,10,0.35)";
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(rand() * W * 0.4, 0);
      ctx.lineTo(rand() * W * 0.4 + 30, H);
      ctx.stroke();
    }
    return c;
  }

  function drawPortrait(ctx, w, h) {
    const bg = ctx.createLinearGradient(w * 0.1, 0, w * 0.9, h);
    bg.addColorStop(0, "#eef0ee");
    bg.addColorStop(0.5, "#d5d8d3");
    bg.addColorStop(1, "#b9bdb8");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    const cx = w * 0.5;
    const headY = h * 0.4;
    const headR = h * 0.185;

    ctx.fillStyle = "#59412f";
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.255, h * 0.95);
    ctx.bezierCurveTo(cx - w * 0.24, h * 0.7, cx - w * 0.13, h * 0.6, cx - w * 0.075, h * 0.57);
    ctx.lineTo(cx + w * 0.075, h * 0.57);
    ctx.bezierCurveTo(cx + w * 0.13, h * 0.6, cx + w * 0.24, h * 0.7, cx + w * 0.255, h * 0.95);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#a97445";
    ctx.fillRect(cx - w * 0.048, h * 0.46, w * 0.096, h * 0.15);

    ctx.beginPath();
    ctx.ellipse(cx, headY, headR * 0.9, headR * 1.12, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#bd8a5e";
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(cx, headY, headR * 0.98, headR * 1.02, 0, Math.PI, Math.PI * 2);
    ctx.fillStyle = "#43301f";
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx - headR * 0.86, headY + headR * 0.1, headR * 0.22, headR * 0.5, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + headR * 0.86, headY + headR * 0.1, headR * 0.22, headR * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#3b2718";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - headR * 0.34, headY + headR * 0.05);
    ctx.lineTo(cx - headR * 0.12, headY + headR * 0.05);
    ctx.moveTo(cx + headR * 0.12, headY + headR * 0.05);
    ctx.lineTo(cx + headR * 0.34, headY + headR * 0.05);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - headR * 0.18, headY + headR * 0.5);
    ctx.quadraticCurveTo(cx, headY + headR * 0.62, cx + headR * 0.18, headY + headR * 0.5);
    ctx.stroke();
  }

  function makePortraitCanvas() {
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d");
    drawPortrait(ctx, W, H);
    const img = ctx.getImageData(0, 0, W, H);
    const d = img.data;
    const rnd = mulberry32(9091);
    for (let i = 0; i < d.length; i += 4) {
      const v = (rnd() - 0.5) * 18;
      d[i] = (d[i] + v) | 0;
      d[i + 1] = (d[i + 1] + v * 0.9) | 0;
      d[i + 2] = (d[i + 2] + v * 0.8) | 0;
      const s = 0.72;
      d[i] = (d[i] * s + 126 * (1 - s)) | 0;
      d[i + 1] = (d[i + 1] * s + 101 * (1 - s)) | 0;
      d[i + 2] = (d[i + 2] * s + 68 * (1 - s)) | 0;
    }
    ctx.putImageData(img, 0, 0);

    const rand = mulberry32(3311);
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = "#f4ebdc";
    for (let i = 0; i < 130; i++) {
      ctx.beginPath();
      ctx.arc(rand() * W, rand() * H, rand() * 1.5 + 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = "rgba(140,100,48,0.22)";
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.ellipse(rand() * W, rand() * H, 16 + rand() * 34, 10 + rand() * 20, rand() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, H * 0.82);
    vig.addColorStop(0, "rgba(30,18,8,0)");
    vig.addColorStop(1, "rgba(30,18,8,0.42)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(255,248,236,0.55)";
    ctx.lineWidth = 3;
    ctx.strokeRect(6, 6, W - 12, H - 12);
    return c;
  }

  function drawStudioPortrait(ctx, w, h) {
    const bg = ctx.createRadialGradient(w * 0.42, h * 0.26, h * 0.06, w * 0.5, h * 0.46, h * 1.1);
    bg.addColorStop(0, "#eeebe4");
    bg.addColorStop(0.38, "#cbc7bf");
    bg.addColorStop(0.72, "#8d8982");
    bg.addColorStop(1, "#4f4b46");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    const cx = w * 0.47;
    const headY = h * 0.37;
    const headR = h * 0.165;

    const body = ctx.createLinearGradient(cx - w * 0.3, h * 0.6, cx + w * 0.3, h);
    body.addColorStop(0, "#5a564f");
    body.addColorStop(0.45, "#36322c");
    body.addColorStop(1, "#1d1b18");
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.3, h * 1.02);
    ctx.bezierCurveTo(cx - w * 0.28, h * 0.73, cx - w * 0.15, h * 0.615, cx - w * 0.078, h * 0.585);
    ctx.lineTo(cx + w * 0.078, h * 0.585);
    ctx.bezierCurveTo(cx + w * 0.15, h * 0.615, cx + w * 0.28, h * 0.73, cx + w * 0.3, h * 1.02);
    ctx.closePath();
    ctx.fill();

    const neck = ctx.createLinearGradient(cx - w * 0.05, 0, cx + w * 0.05, 0);
    neck.addColorStop(0, "#8d8880");
    neck.addColorStop(0.45, "#c6c1b8");
    neck.addColorStop(1, "#79746d");
    ctx.fillStyle = neck;
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.04, headY + headR * 0.62);
    ctx.lineTo(cx - w * 0.047, h * 0.6);
    ctx.lineTo(cx + w * 0.047, h * 0.6);
    ctx.lineTo(cx + w * 0.04, headY + headR * 0.62);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "rgba(52,49,44,0.42)";
    ctx.beginPath();
    ctx.ellipse(cx, headY + headR * 0.72, w * 0.048, h * 0.02, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#dbd7cf";
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.072, h * 0.578);
    ctx.lineTo(cx, h * 0.7);
    ctx.lineTo(cx + w * 0.072, h * 0.578);
    ctx.lineTo(cx + w * 0.048, h * 0.566);
    ctx.lineTo(cx, h * 0.606);
    ctx.lineTo(cx - w * 0.048, h * 0.566);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#4c4740";
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.011, h * 0.63);
    ctx.lineTo(cx + w * 0.011, h * 0.63);
    ctx.lineTo(cx + w * 0.018, h * 0.84);
    ctx.lineTo(cx, h * 0.9);
    ctx.lineTo(cx - w * 0.018, h * 0.84);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#b6b1a9";
    ctx.beginPath();
    ctx.ellipse(cx - headR * 0.8, headY + headR * 0.18, headR * 0.12, headR * 0.25, 0.1, 0, Math.PI * 2);
    ctx.ellipse(cx + headR * 0.8, headY + headR * 0.18, headR * 0.12, headR * 0.25, -0.1, 0, Math.PI * 2);
    ctx.fill();

    const face = ctx.createRadialGradient(
      cx - headR * 0.34,
      headY - headR * 0.3,
      headR * 0.08,
      cx,
      headY + headR * 0.04,
      headR * 1.3
    );
    face.addColorStop(0, "#eae6de");
    face.addColorStop(0.5, "#c6c1b7");
    face.addColorStop(0.85, "#98938a");
    face.addColorStop(1, "#77726a");
    ctx.fillStyle = face;
    ctx.beginPath();
    ctx.ellipse(cx, headY, headR * 0.78, headR * 1.02, 0, 0, Math.PI * 2);
    ctx.fill();

    const hair = ctx.createLinearGradient(cx, headY - headR * 1.15, cx, headY + headR * 0.35);
    hair.addColorStop(0, "#3d382f");
    hair.addColorStop(0.55, "#26221c");
    hair.addColorStop(1, "#15120e");
    ctx.fillStyle = hair;
    ctx.beginPath();
    ctx.moveTo(cx - headR * 0.84, headY + headR * 0.44);
    ctx.bezierCurveTo(cx - headR * 1.0, headY - headR * 0.62, cx - headR * 0.6, headY - headR * 1.16, cx, headY - headR * 1.14);
    ctx.bezierCurveTo(cx + headR * 0.6, headY - headR * 1.16, cx + headR * 1.0, headY - headR * 0.62, cx + headR * 0.84, headY + headR * 0.44);
    ctx.bezierCurveTo(cx + headR * 0.8, headY - headR * 0.1, cx + headR * 0.6, headY - headR * 0.4, cx + headR * 0.24, headY - headR * 0.47);
    ctx.bezierCurveTo(cx + headR * 0.12, headY - headR * 0.38, cx + headR * 0.02, headY - headR * 0.52, cx - headR * 0.1, headY - headR * 0.45);
    ctx.bezierCurveTo(cx - headR * 0.26, headY - headR * 0.56, cx - headR * 0.42, headY - headR * 0.4, cx - headR * 0.52, headY - headR * 0.46);
    ctx.bezierCurveTo(cx - headR * 0.66, headY - headR * 0.3, cx - headR * 0.74, headY + headR * 0.04, cx - headR * 0.84, headY + headR * 0.44);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "rgba(126,118,105,0.16)";
    ctx.lineWidth = headR * 0.05;
    ctx.lineCap = "round";
    for (let s = 0; s < 9; s++) {
      const t = -0.8 + (s / 8) * 1.6;
      const sx = cx + t * headR * 0.62;
      ctx.beginPath();
      ctx.moveTo(sx, headY - headR * 1.02);
      ctx.quadraticCurveTo(sx + t * headR * 0.2, headY - headR * 0.72, sx + t * headR * 0.34, headY - headR * 0.38);
      ctx.stroke();
    }

    const eyeY = headY + headR * 0.1;
    const eyeDx = headR * 0.34;

    ctx.strokeStyle = "rgba(58,53,46,0.5)";
    ctx.lineWidth = headR * 0.05;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(cx - eyeDx - headR * 0.18, eyeY - headR * 0.24);
    ctx.quadraticCurveTo(cx - eyeDx, eyeY - headR * 0.31, cx - eyeDx + headR * 0.16, eyeY - headR * 0.23);
    ctx.moveTo(cx + eyeDx - headR * 0.16, eyeY - headR * 0.23);
    ctx.quadraticCurveTo(cx + eyeDx, eyeY - headR * 0.31, cx + eyeDx + headR * 0.18, eyeY - headR * 0.24);
    ctx.stroke();

    ctx.fillStyle = "rgba(64,59,52,0.72)";
    ctx.beginPath();
    ctx.ellipse(cx - eyeDx, eyeY, headR * 0.11, headR * 0.055, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + eyeDx, eyeY, headR * 0.11, headR * 0.055, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(96,90,82,0.22)";
    ctx.beginPath();
    ctx.ellipse(cx - eyeDx - headR * 0.02, eyeY + headR * 0.07, headR * 0.14, headR * 0.055, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + eyeDx - headR * 0.02, eyeY + headR * 0.07, headR * 0.14, headR * 0.055, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(118,112,103,0.24)";
    ctx.beginPath();
    ctx.ellipse(cx + headR * 0.14, eyeY + headR * 0.34, headR * 0.13, headR * 0.19, -0.25, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(104,98,90,0.45)";
    ctx.lineWidth = headR * 0.055;
    ctx.beginPath();
    ctx.moveTo(cx + headR * 0.05, eyeY + headR * 0.06);
    ctx.quadraticCurveTo(cx + headR * 0.14, eyeY + headR * 0.33, cx - headR * 0.02, eyeY + headR * 0.4);
    ctx.stroke();

    ctx.strokeStyle = "rgba(88,82,74,0.5)";
    ctx.lineWidth = headR * 0.06;
    ctx.beginPath();
    ctx.moveTo(cx - headR * 0.17, headY + headR * 0.6);
    ctx.quadraticCurveTo(cx, headY + headR * 0.66, cx + headR * 0.17, headY + headR * 0.6);
    ctx.stroke();

    ctx.fillStyle = "rgba(122,115,106,0.16)";
    ctx.beginPath();
    ctx.ellipse(cx - headR * 0.44, headY + headR * 0.32, headR * 0.2, headR * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function makeBlackWhiteCanvas() {
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d");
    drawStudioPortrait(ctx, W, H);

    const grain = ctx.getImageData(0, 0, W, H);
    const gd = grain.data;
    const rnd = mulberry32(4813);
    for (let i = 0; i < gd.length; i += 4) {
      const v = (rnd() - 0.5) * 24;
      gd[i] = (gd[i] + v) | 0;
      gd[i + 1] = (gd[i + 1] + v) | 0;
      gd[i + 2] = (gd[i + 2] + v) | 0;
    }
    ctx.putImageData(grain, 0, 0);

    const rand = mulberry32(6151);
    ctx.fillStyle = "rgba(245,245,245,0.75)";
    for (let i = 0; i < 70; i++) {
      ctx.beginPath();
      ctx.arc(rand() * W, rand() * H, rand() * 1.6 + 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(24,24,24,0.6)";
    for (let i = 0; i < 40; i++) {
      ctx.beginPath();
      ctx.arc(rand() * W, rand() * H, rand() * 1.4 + 0.3, 0, Math.PI * 2);
      ctx.fill();
    }

    if (typeof ctx.filter === "string") {
      const soft = document.createElement("canvas");
      soft.width = W;
      soft.height = H;
      const sctx = soft.getContext("2d");
      sctx.drawImage(c, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.filter = "blur(1.2px)";
      ctx.drawImage(soft, 0, 0);
      ctx.filter = "none";
    }

    const tone = ctx.getImageData(0, 0, W, H);
    const td = tone.data;
    for (let i = 0; i < td.length; i += 4) {
      const lum = 0.299 * td[i] + 0.587 * td[i + 1] + 0.114 * td[i + 2];
      let v = 128 + (lum - 128) * 1.06;
      if (v < 0) v = 0;
      else if (v > 255) v = 255;
      const g = Math.round(v);
      td[i] = Math.min(255, g + 2);
      td[i + 1] = g;
      td[i + 2] = Math.max(0, g - 2);
    }
    ctx.putImageData(tone, 0, 0);

    const rnd2 = mulberry32(9173);
    for (let i = 0; i < td.length; i += 4) {
      const v = (rnd2() - 0.5) * 12;
      td[i] = (td[i] + v) | 0;
      td[i + 1] = (td[i + 1] + v) | 0;
      td[i + 2] = (td[i + 2] + v) | 0;
    }
    ctx.putImageData(tone, 0, 0);

    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 7; i++) {
      const sx = rnd() * W;
      ctx.beginPath();
      ctx.moveTo(sx, rand() * H * 0.25);
      ctx.lineTo(sx + (rand() - 0.5) * 26, H * (0.55 + rand() * 0.42));
      ctx.stroke();
    }

    const vig = ctx.createRadialGradient(W * 0.46, H * 0.42, H * 0.3, W * 0.46, H * 0.46, H * 0.86);
    vig.addColorStop(0, "rgba(12,12,12,0)");
    vig.addColorStop(1, "rgba(12,12,12,0.42)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);
    return c;
  }

  function drawGardenScene(ctx, w, h) {
    const sky = ctx.createLinearGradient(0, 0, 0, h * 0.62);
    sky.addColorStop(0, "#8fbfe4");
    sky.addColorStop(1, "#dbeaf2");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h * 0.64);

    ctx.fillStyle = "rgba(255,255,255,0.62)";
    const cloud = (cx, cy, s) => {
      ctx.beginPath();
      ctx.ellipse(cx, cy, s * 2.1, s * 0.62, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + s * 1.1, cy - s * 0.32, s * 1.3, s * 0.5, 0, 0, Math.PI * 2);
      ctx.ellipse(cx - s * 1.2, cy - s * 0.16, s * 1.1, s * 0.46, 0, 0, Math.PI * 2);
      ctx.fill();
    };
    cloud(w * 0.24, h * 0.16, 30);
    cloud(w * 0.66, h * 0.11, 22);

    const lawn = ctx.createLinearGradient(0, h * 0.56, 0, h);
    lawn.addColorStop(0, "#84b365");
    lawn.addColorStop(1, "#4f7d3e");
    ctx.fillStyle = lawn;
    ctx.fillRect(0, h * 0.58, w, h * 0.42);

    ctx.fillStyle = "#3f6b36";
    for (let x = -20; x < w + 60; x += 62) {
      ctx.beginPath();
      ctx.arc(x, h * 0.6, 42, 0, Math.PI * 2);
      ctx.fill();
    }

    const hx = w * 0.07;
    const hy = h * 0.33;
    const hw = w * 0.33;
    const hh = h * 0.25;
    ctx.fillStyle = "#efe4cd";
    ctx.fillRect(hx, hy, hw, hh);
    ctx.fillStyle = "#b4553c";
    ctx.beginPath();
    ctx.moveTo(hx - 24, hy + 4);
    ctx.lineTo(hx + hw / 2, hy - 78);
    ctx.lineTo(hx + hw + 24, hy + 4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#f7f2e6";
    ctx.fillRect(hx + 24, hy + 26, 58, 52);
    ctx.fillRect(hx + hw - 82, hy + 26, 58, 52);
    ctx.fillStyle = "#4c8fbf";
    ctx.fillRect(hx + 30, hy + 32, 46, 40);
    ctx.fillRect(hx + hw - 76, hy + 32, 46, 40);
    ctx.fillStyle = "#6b4a2f";
    ctx.fillRect(hx + hw * 0.4, hy + hh * 0.44, 54, hh * 0.56);
    ctx.fillStyle = "#e8d59c";
    ctx.beginPath();
    ctx.arc(hx + hw * 0.4 + 44, hy + hh * 0.72, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#6b4a2f";
    ctx.fillRect(w * 0.735 - 17, h * 0.44, 34, h * 0.3);
    ctx.fillStyle = "#4f8a43";
    ctx.beginPath();
    ctx.arc(w * 0.735, h * 0.36, 116, 0, Math.PI * 2);
    ctx.arc(w * 0.735 - 74, h * 0.43, 72, 0, Math.PI * 2);
    ctx.arc(w * 0.735 + 78, h * 0.44, 66, 0, Math.PI * 2);
    ctx.arc(w * 0.735 - 24, h * 0.27, 70, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(116,160,88,0.62)";
    ctx.beginPath();
    ctx.arc(w * 0.735 - 44, h * 0.3, 60, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#d8c49a";
    ctx.beginPath();
    ctx.moveTo(hx + hw * 0.38, hy + hh);
    ctx.lineTo(hx + hw * 0.62, hy + hh);
    ctx.quadraticCurveTo(w * 0.52, h * 0.79, w * 0.57, h);
    ctx.lineTo(w * 0.27, h);
    ctx.quadraticCurveTo(w * 0.31, h * 0.81, hx + hw * 0.38, hy + hh);
    ctx.closePath();
    ctx.fill();

    const rnd = mulberry32(3141);
    const petals = ["#e8635a", "#f2d35c", "#f4f1e6", "#d97ab0"];
    for (let i = 0; i < 54; i++) {
      const fx = rnd() * w;
      const fy = h * 0.63 + rnd() * h * 0.35;
      ctx.fillStyle = petals[i % petals.length];
      ctx.beginPath();
      ctx.arc(fx, fy, rnd() * 4 + 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function makeBlurryCanvas() {
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d");

    const soft = document.createElement("canvas");
    soft.width = W;
    soft.height = H;
    const sctx = soft.getContext("2d");
    drawGardenScene(sctx, W, H);

    if (typeof ctx.filter === "string") {
      ctx.filter = "blur(3.5px)";
      ctx.drawImage(soft, 0, 0);
      ctx.filter = "none";
    } else {
      const small = document.createElement("canvas");
      small.width = Math.round(W / 4);
      small.height = Math.round(H / 4);
      const mctx = small.getContext("2d");
      mctx.drawImage(soft, 0, 0, small.width, small.height);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(small, 0, 0, W, H);
    }

    const img = ctx.getImageData(0, 0, W, H);
    const d = img.data;
    const rnd = mulberry32(8842);
    for (let i = 0; i < d.length; i += 4) {
      const v = (rnd() - 0.5) * 12;
      d[i] = (d[i] + v) | 0;
      d[i + 1] = (d[i + 1] + v) | 0;
      d[i + 2] = (d[i + 2] + v) | 0;
    }
    ctx.putImageData(img, 0, 0);

    const haze = ctx.createRadialGradient(W * 0.5, H * 0.42, H * 0.1, W * 0.5, H * 0.5, H * 0.92);
    haze.addColorStop(0, "rgba(255,252,240,0.2)");
    haze.addColorStop(1, "rgba(222,230,236,0.32)");
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, W, H);

    const rand = mulberry32(5523);
    ctx.fillStyle = "rgba(255,255,255,0.16)";
    for (let i = 0; i < 90; i++) {
      ctx.beginPath();
      ctx.arc(rand() * W, rand() * H, rand() * 1.6 + 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    return c;
  }

  function makePair() {
    return { before: makeFadedCanvas(), after: makeCleanCanvas() };
  }

  return {
    makePair: makePair,
    makeFadedCanvas: makeFadedCanvas,
    makePortraitCanvas: makePortraitCanvas,
    makeBlackWhiteCanvas: makeBlackWhiteCanvas,
    makeBlurryCanvas: makeBlurryCanvas,
    width: W,
    height: H,
  };
})();
