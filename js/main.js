(function () {
  "use strict";

  const nav = document.getElementById("nav");
  window.addEventListener(
    "scroll",
    function () {
      nav.classList.toggle("scrolled", window.scrollY > 8);
    },
    { passive: true }
  );

  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  if (window.MRL && MRL.sample) {
    let pair = null;

    const canRestore = MRL.adjust && MRL.colorize && MRL.deblur;
    if (canRestore) {
      try {
        const before = MRL.sample.makeFadedCanvas();
        const w = before.width;
        const h = before.height;
        const restored = document.createElement("canvas");
        restored.width = w;
        restored.height = h;
        const rctx = restored.getContext("2d", { willReadFrequently: true });
        rctx.drawImage(before, 0, 0);
        const img = rctx.getImageData(0, 0, w, h);
        const adjust = MRL.adjust.suggestFromCanvas(before);
        const rec = MRL.adjust.suggestCleanup(before);
        if (adjust.saturation < 18) adjust.saturation = 18;
        if (rec.cleanup.sharpen < 14) rec.cleanup.sharpen = 14;
        const out = MRL.adjust.render(img.data, w, h, adjust, rec.cleanup);
        img.data.set(out);
        rctx.putImageData(img, 0, 0);
        pair = { before: before, after: restored };
      } catch (err) {
        pair = null;
      }
    }
    if (!pair) pair = MRL.sample.makePair();

    const hero = document.getElementById("hero-photo");
    if (hero) {
      hero.width = pair.after.width;
      hero.height = pair.after.height;
      hero.getContext("2d").drawImage(pair.after, 0, 0);
    }

    const after = document.getElementById("demo-after");
    const before = document.getElementById("demo-before");
    if (after && before) {
      after.width = pair.after.width;
      after.height = pair.after.height;
      after.getContext("2d").drawImage(pair.after, 0, 0);
      before.width = pair.before.width;
      before.height = pair.before.height;
      before.getContext("2d").drawImage(pair.before, 0, 0);
    }
  }

  const demoStage = document.getElementById("demo-stage");
  const demoRange = document.getElementById("demo-range");
  if (demoStage && demoRange) {
    demoRange.addEventListener("input", function () {
      demoStage.style.setProperty("--split", demoRange.value + "%");
    });
  }

  const revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    revealEls.forEach(function (el) {
      io.observe(el);
    });
  } else {
    revealEls.forEach(function (el) {
      el.classList.add("visible");
    });
  }
})();
