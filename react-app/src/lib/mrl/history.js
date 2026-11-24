window.MRL = window.MRL || {};

MRL.history = (function () {
  "use strict";

  function flatten(canvas, usePng) {
    if (usePng) {
      return canvas.toDataURL("image/png");
    }
    const f = document.createElement("canvas");
    f.width = canvas.width;
    f.height = canvas.height;
    const ctx = f.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, f.width, f.height);
    ctx.drawImage(canvas, 0, 0);
    return f.toDataURL("image/jpeg", 0.92);
  }

  function create(limit) {
    return { stack: [], index: -1, limit: limit || 8 };
  }

  function push(h, canvas, usePng, meta) {
    h.stack.length = h.index + 1;
    h.stack.push({
      image: flatten(canvas, usePng),
      meta: meta ? JSON.parse(JSON.stringify(meta)) : null,
    });
    if (h.stack.length > h.limit) h.stack.shift();
    h.index = h.stack.length - 1;
  }

  function restore(h, canvas, cb) {
    const entry = h.stack[h.index];
    if (!entry) {
      if (cb) cb(null, null);
      return;
    }
    const url = entry.image;
    const img = new Image();
    img.onload = function () {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext("2d").drawImage(img, 0, 0);
      if (cb) cb(img, entry.meta);
    };
    img.onerror = function () {
      if (cb) cb(null, entry.meta);
    };
    img.src = url;
  }

  function undo(h, canvas, cb) {
    if (h.index <= 0) return false;
    h.index--;
    restore(h, canvas, cb);
    return true;
  }

  function redo(h, canvas, cb) {
    if (h.index >= h.stack.length - 1) return false;
    h.index++;
    restore(h, canvas, cb);
    return true;
  }

  function reset(h) {
    h.stack.length = 0;
    h.index = -1;
  }

  return {
    create: create,
    push: push,
    undo: undo,
    redo: redo,
    reset: reset,
    canUndo: function (h) {
      return h.index > 0;
    },
    canRedo: function (h) {
      return h.index < h.stack.length - 1;
    },
  };
})();
