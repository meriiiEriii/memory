/**
 * server.js — Memory Lane cloud AI restoration proxy
 * ---------------------------------------------------
 * WHY THIS FILE EXISTS:
 *   Browsers cannot call https://api.replicate.com directly:
 *     1. Replicate blocks cross-origin (CORS) requests from web pages.
 *     2. Your API token must NEVER be placed in front-end JavaScript,
 *        because anyone who opens DevTools could steal it.
 *   So the browser talks to THIS tiny server (same origin), and only the
 *   server talks to Replicate using the token.
 *
 * RUN IT (PowerShell):
 *      node server.js
 *   The Replicate token is read from the REPLICATE_API_TOKEN environment
 *   variable, or from a local ".env" file next to server.js containing:
 *      REPLICATE_API_TOKEN=r8_your_token_here
 *   Never paste the token into source files you share or submit.
 *   Then open:  http://localhost:3000/cloud-restore.html
 *
 * OPTIONAL DEMO MODE (no token, no credits, no internet):
 *      $env:MEMORY_LANE_MOCK = "1"
 *      node server.js
 *   The API pretends to restore: after two polls it "succeeds" and echoes
 *   your photo back, so you can demo/test the whole flow offline.
 *
 * REQUIRES: Node.js 18 or newer (for the built-in "fetch").
 * NO npm install needed — zero dependencies.
 */

"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
/**
 * Read the Replicate token WITHOUT hardcoding it in this file.
 * Order: 1) REPLICATE_API_TOKEN environment variable, 2) a local .env file
 * next to server.js with a line  REPLICATE_API_TOKEN=r8_...
 * (Strips quotes, stray whitespace and a UTF-8 BOM from Notepad.)
 */
function loadReplicateToken() {
  const fromEnv = (process.env.REPLICATE_API_TOKEN || "").trim();
  if (fromEnv) return fromEnv;
  try {
    const text = fs.readFileSync(path.join(__dirname, ".env"), "utf8").replace(/^\uFEFF/, "");
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*REPLICATE_API_TOKEN\s*=\s*(.+?)\s*$/);
      if (m) return m[1].replace(/^["']|["']$/g, "");
    }
  } catch (e) {
    /* no .env file — that is fine, TOKEN stays empty */
  }
  return "";
}
const TOKEN = loadReplicateToken();
const MOCK = process.env.MEMORY_LANE_MOCK === "1";
const MAX_BODY = 15 * 1024 * 1024; // 15 MB cap for incoming JSON

/**
 * Model catalogue. Each entry knows how to build a Replicate "input" object
 * and how to extract the final image URL from the prediction "output".
 * (CodeFormer restores faces + background; GFPGAN focuses on faces.)
 */
const MODELS = {
  codeformer: {
    endpoint: "https://api.replicate.com/v1/models/sczhou/codeformer/predictions",
    buildInput: function (image, opts) {
      return {
        image: image,                       // data URI or public URL
        codeformer_fidelity: clamp01(opts.fidelity === undefined ? 0.7 : Number(opts.fidelity)),
        face_upsample: true,                // upscale the face region 2x
        background_enhance: true,           // sharpen the rest of the photo too
      };
    },
    pickOutput: function (output) {
      return Array.isArray(output) ? output[0] : output;
    },
  },
  gfpgan: {
    endpoint: "https://api.replicate.com/v1/models/tencentarc/gfpgan/predictions",
    buildInput: function (image, opts) {
      return {
        img: image,                         // GFPGAN names its input "img"
        version: "v1.4",
        scale: opts.scale ? Number(opts.scale) : 2,
      };
    },
    pickOutput: function (output) {
      return Array.isArray(output) ? output[0] : output;
    },
  },
};

function clamp01(v) {
  v = Number(v);
  if (isNaN(v)) return 0.7;
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** In mock mode we remember each submitted image so we can echo it back. */
const mockStore = new Map();

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(body);
}

/** Collect the whole request body, parse it as JSON (with a size cap). */
function readJson(req) {
  return new Promise(function (resolve, reject) {
    let size = 0;
    const chunks = [];
    req.on("data", function (c) {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error("Image too large (15 MB limit)"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", function () {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {});
      } catch (e) {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

/** Forward a request to Replicate and return the parsed JSON response. */
async function replicate(endpoint, options) {
  const res = await fetch(endpoint, {
    method: options.method || "GET",
    headers: {
      // If you ever get 401 with a legacy token, try "Token " instead of "Bearer ".
      Authorization: "Bearer " + TOKEN,
      "Content-Type": "application/json",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await res.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch (e) {
    /* keep json empty; we still surface status + raw text below */
  }
  return { ok: res.ok, status: res.status, json: json, raw: text };
}

/* ------------------------------------------------------------------ */
/* API routes                                                          */
/* ------------------------------------------------------------------ */

/**
 * POST /api/predictions — generic "start a prediction" passthrough used by
 * the Remini-style enhance.html page. The browser sends one of:
 *     { version: "<64-char model hash>", input: {...} }   (pinned version)
 *     { model: "owner/name",             input: {...} }   (latest version)
 * The server attaches the Replicate token and forwards the request.
 */
async function handleCreatePrediction(req, res) {
  let body;
  try {
    body = await readJson(req);
  } catch (e) {
    sendJson(res, 400, { error: e.message });
    return;
  }

  const input = body.input;
  if (!input || typeof input !== "object") {
    sendJson(res, 400, { error: "Missing input object" });
    return;
  }
  const version = typeof body.version === "string" ? body.version : "";
  const model = typeof body.model === "string" ? body.model : "";
  if (!version && !model) {
    sendJson(res, 400, { error: "Provide version (model hash) or model (owner/name)" });
    return;
  }
  // Whitelist shapes so we never forward arbitrary paths to Replicate.
  if (version && !/^[a-f0-9]{64}$/i.test(version)) {
    sendJson(res, 400, { error: "Invalid version hash" });
    return;
  }
  if (model && !/^[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*$/i.test(model)) {
    sendJson(res, 400, { error: "Invalid model name" });
    return;
  }

  // ---- Demo mode: fake a prediction, echo the image back later --------
  if (MOCK) {
    const id = "mock" + Date.now().toString(36);
    mockStore.set(id, { image: String(input.image || input.img || ""), polls: 0 });
    sendJson(res, 200, { id: id, status: "starting", mock: true });
    return;
  }

  // ---- Real mode: create the prediction on Replicate ------------------
  if (!TOKEN) {
    sendJson(res, 500, {
      error:
        "Server is missing REPLICATE_API_TOKEN. Set it with " +
        '"$env:REPLICATE_API_TOKEN = \\"r8_...\\"" or add a line ' +
        '"REPLICATE_API_TOKEN=r8_..." to the .env file next to server.js',
    });
    return;
  }

  try {
    let endpoint;
    let payload;
    if (version) {
      endpoint = "https://api.replicate.com/v1/predictions";
      payload = { version: version, input: input };
    } else {
      endpoint = "https://api.replicate.com/v1/models/" + model + "/predictions";
      payload = { input: input };
    }
    const out = await replicate(endpoint, { method: "POST", body: payload });
    if (!out.ok) {
      sendJson(res, out.status === 401 ? 401 : 502, {
        error: "Replicate rejected the request (" + out.status + "): " + (out.json.detail || out.raw.slice(0, 300)),
      });
      return;
    }
    sendJson(res, 200, { id: out.json.id, status: out.json.status });
  } catch (e) {
    sendJson(res, 502, { error: "Could not reach Replicate: " + e.message });
  }
}

/** POST /api/restore  { image, model, fidelity, scale } -> { id, status } */
async function handleRestore(req, res) {
  let body;
  try {
    body = await readJson(req);
  } catch (e) {
    sendJson(res, 400, { error: e.message });
    return;
  }

  const image = body.image || "";
  const modelKey = MODELS[body.model] ? body.model : "codeformer";
  const model = MODELS[modelKey];

  if (typeof image !== "string" || image.indexOf("data:image/") !== 0) {
    sendJson(res, 400, { error: "Send the photo as a data:image/... URI" });
    return;
  }

  // ---- Demo mode: fake a prediction, echo the image back later --------
  if (MOCK) {
    const id = "mock" + Date.now().toString(36);
    mockStore.set(id, { image: image, polls: 0 });
    sendJson(res, 200, { id: id, status: "starting", mock: true });
    return;
  }

  // ---- Real mode: create a prediction on Replicate --------------------
  if (!TOKEN) {
    sendJson(res, 500, {
      error:
        "Server is missing REPLICATE_API_TOKEN. Set it with " +
        '"$env:REPLICATE_API_TOKEN = \\"r8_...\\"" or add a line ' +
        '"REPLICATE_API_TOKEN=r8_..." to the .env file next to server.js',
    });
    return;
  }

  try {
    const out = await replicate(model.endpoint, {
      method: "POST",
      body: { input: model.buildInput(image, body) },
    });
    if (!out.ok) {
      sendJson(res, out.status === 401 ? 401 : 502, {
        error: "Replicate rejected the request (" + out.status + "): " + (out.json.detail || out.raw.slice(0, 300)),
      });
      return;
    }
    sendJson(res, 200, { id: out.json.id, status: out.json.status });
  } catch (e) {
    sendJson(res, 502, { error: "Could not reach Replicate: " + e.message });
  }
}

/**
 * GET /api/predictions/<id>
 * The browser polls this every ~1.5 s until status is "succeeded".
 * We normalise the response to { status, output, error }.
 */
async function handlePoll(req, res, id) {
  if (!/^[A-Za-z0-9]+$/.test(id)) {
    sendJson(res, 400, { error: "Bad prediction id" });
    return;
  }

  // ---- Demo mode -------------------------------------------------------
  if (MOCK) {
    const rec = mockStore.get(id);
    if (!rec) {
      sendJson(res, 404, { error: "Unknown mock id" });
      return;
    }
    rec.polls++;
    if (rec.polls === 1) {
      sendJson(res, 200, { status: "processing" });
    } else {
      // After the 2nd poll pretend the AI finished and hand back the image.
      sendJson(res, 200, { status: "succeeded", output: rec.image });
      mockStore.delete(id);
    }
    return;
  }

  // ---- Real mode: ask Replicate for the prediction status --------------
  if (!TOKEN) {
    sendJson(res, 500, { error: "Server is missing REPLICATE_API_TOKEN" });
    return;
  }

  try {
    const out = await replicate("https://api.replicate.com/v1/predictions/" + id, { method: "GET" });
    if (!out.ok) {
      sendJson(res, 502, { error: "Replicate poll failed (" + out.status + ")" });
      return;
    }
    const model = MODELS.codeformer; // output shape is the same for both models
    sendJson(res, 200, {
      status: out.json.status,
      output: out.json.status === "succeeded" ? model.pickOutput(out.json.output) : null,
      error: out.json.error || null,
    });
  } catch (e) {
    sendJson(res, 502, { error: "Could not reach Replicate: " + e.message });
  }
}

/* ------------------------------------------------------------------ */
/* Static file serving (so the whole site works through this server)   */
/* ------------------------------------------------------------------ */

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function serveStatic(req, res, urlPath) {
  let p = urlPath.split("?")[0];
  try {
    p = decodeURIComponent(p);
  } catch (e) {
    res.writeHead(400);
    res.end("Bad request");
    return;
  }

  // The React build (react-app/dist) takes priority when it exists.
  // Unknown routes fall back to the SPA entry so React Router can handle them.
  const distDir = path.join(ROOT, "react-app", "dist");
  const distIndex = path.join(distDir, "index.html");
  const hasReactBuild = fs.existsSync(distIndex);

  if (p === "/" && hasReactBuild) p = "/__react_index__";
  if (p === "/__react_index__") {
    res.writeHead(200, { "Content-Type": MIME[".html"] });
    fs.createReadStream(distIndex).pipe(res);
    return;
  }

  // Files inside the React build (e.g. /assets/index-*.js).
  // Path-traversal guard: the joined path must stay inside react-app/dist.
  const distCandidate = path.join(distDir, p);
  const distRel = path.relative(distDir, distCandidate);
  if (hasReactBuild && p.startsWith("/assets/") && !distRel.startsWith("..") && !path.isAbsolute(distRel) &&
      fs.existsSync(distCandidate)) {
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(distCandidate).toLowerCase()] || "application/octet-stream",
    });
    fs.createReadStream(distCandidate).pipe(res);
    return;
  }

  if (p === "/") p = "/index.html";
  const full = path.join(ROOT, p);
  // Path-traversal guard: never serve anything outside this folder.
  // path.relative is used instead of startsWith so sibling folders
  // (e.g. "C:\\...\\dart-copy") cannot slip through the prefix check.
  // Dotfiles (.env, .git, ...) and server.js itself are never served.
  const rel = path.relative(ROOT, full);
  const base = path.basename(full);
  if (rel.startsWith("..") || path.isAbsolute(rel) || base.startsWith(".") || base === "server.js") {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.readFile(full, function (err, data) {
    if (err) {
      // SPA fallback: unknown paths render the React app.
      if (hasReactBuild && !path.extname(p)) {
        res.writeHead(200, { "Content-Type": MIME[".html"] });
        fs.createReadStream(distIndex).pipe(res);
        return;
      }
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
      return;
    }
    // COOP + COEP enable cross-origin isolation, which unlocks multi-threaded
    // WASM for the on-device AI (2-4x faster inference). Only editor.html needs
    // isolation (it runs the AI), so other pages keep loading normally.
    const wantsIsolation = p === "/editor.html";
    const headers = {
      "Content-Type": MIME[path.extname(full).toLowerCase()] || "application/octet-stream",
    };
    if (wantsIsolation) {
      headers["Cross-Origin-Opener-Policy"] = "same-origin";
      headers["Cross-Origin-Embedder-Policy"] = "require-corp";
    }
    res.writeHead(200, headers);
    res.end(data);
  });
}

/* ------------------------------------------------------------------ */
/* Server bootstrap                                                    */
/* ------------------------------------------------------------------ */

const server = http.createServer(function (req, res) {
  const url = req.url || "/";

  if (req.method === "POST" && url.indexOf("/api/restore") === 0) {
    handleRestore(req, res);
    return;
  }
  if (req.method === "POST" && url.indexOf("/api/predictions") === 0) {
    handleCreatePrediction(req, res);
    return;
  }
  if (req.method === "GET" && url.indexOf("/api/predictions/") === 0) {
    handlePoll(req, res, url.slice("/api/predictions/".length).split("?")[0]);
    return;
  }
  if (req.method === "GET") {
    serveStatic(req, res, url);
    return;
  }
  res.writeHead(405);
  res.end("Method not allowed");
});

server.listen(PORT, function () {
  console.log("Memory Lane server running at http://localhost:" + PORT);
  console.log("  Cloud restore page:  http://localhost:" + PORT + "/cloud-restore.html");
  console.log("  Mode: " + (MOCK ? "MOCK (demo, no API calls)" : TOKEN ? "LIVE (Replicate token found)" : "LIVE but NO TOKEN set"));
});
