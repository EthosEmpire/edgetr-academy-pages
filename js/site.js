/* edgeTR Academy - site behaviour. Small, dependency-free, progressive enhancement only. */
(function () {
  "use strict";
  var doc = document;
  var root = doc.documentElement;
  var BASE = root.getAttribute("data-base") || "/";
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (s, el) { return (el || doc).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || doc).querySelectorAll(s)); };
  var withBase = function (url) { return BASE.replace(/\/$/, "") + url; };

  /* ---- mobile navigation ---- */
  var toggle = $(".nav-toggle");
  var nav = $("#main-nav");
  if (toggle && nav) {
    var setNav = function (open) {
      nav.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    };
    toggle.addEventListener("click", function () { setNav(!nav.classList.contains("is-open")); });
    doc.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && nav.classList.contains("is-open")) { setNav(false); toggle.focus(); }
    });
    doc.addEventListener("click", function (e) {
      if (nav.classList.contains("is-open") && !nav.contains(e.target) && !toggle.contains(e.target)) setNav(false);
    });
  }

  /* ---- reveal on scroll + figure animation ---- */
  var revealTargets = $$(".card-grid > *, .section-head, .path-card, .chapter-list > li, .vs-list > li, .promise > *, .split-feature > *");
  revealTargets.forEach(function (el, i) {
    el.setAttribute("data-reveal", "");
    var sibs = el.parentNode ? Array.prototype.indexOf.call(el.parentNode.children, el) : 0;
    el.style.setProperty("--d", Math.min(sibs, 8));
  });
  var figs = $$(".viz[data-animate]");
  var showAll = function () {
    revealTargets.concat(figs).forEach(function (el) { el.classList.add("is-in"); });
  };
  if (reduce || !("IntersectionObserver" in window)) {
    showAll();
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
    revealTargets.concat(figs).forEach(function (el) { io.observe(el); });
    // never leave content hidden if something goes wrong (print, odd browsers)
    window.addEventListener("beforeprint", showAll);
    setTimeout(function () {
      revealTargets.concat(figs).forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.top < window.innerHeight && r.bottom > 0) el.classList.add("is-in");
      });
    }, 1200);
  }

  /* ---- table of contents: collapse on small screens, highlight current section ---- */
  var toc = $(".toc details");
  if (toc) {
    var mq = window.matchMedia("(max-width: 900px)");
    var syncToc = function () { toc.open = !mq.matches; };
    syncToc();
    if (mq.addEventListener) mq.addEventListener("change", syncToc);
    var links = $$(".toc a");
    var byId = {};
    links.forEach(function (a) { byId[decodeURIComponent(a.hash.slice(1))] = a; });
    var heads = Object.keys(byId).map(function (id) { return doc.getElementById(id); }).filter(Boolean);
    if (heads.length && "IntersectionObserver" in window) {
      var current = null;
      var spy = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            if (current) current.classList.remove("is-active");
            current = byId[en.target.id];
            if (current) current.classList.add("is-active");
          }
        });
      }, { rootMargin: "-15% 0px -70% 0px" });
      heads.forEach(function (h) { spy.observe(h); });
    }
    links.forEach(function (a) { a.addEventListener("click", function () { if (mq.matches) toc.open = false; }); });
  }

  /* ---- shelf / glossary filter ---- */
  $$("[data-filter]").forEach(function (bar) {
    var scope = bar.parentNode;
    var input = $("[data-filter-input]", bar);
    var count = $("[data-filter-count]", bar);
    var empty = $("[data-filter-empty]", scope);
    var items = $$(".filter-item", scope);
    var levelBtns = $$("[data-filter-level]", bar);
    var level = "all";
    var noun = count ? count.textContent.replace(/^[0-9]+\s*/, "") : "";
    var apply = function () {
      var q = (input ? input.value : "").trim().toLowerCase();
      var shown = 0;
      items.forEach(function (it) {
        var ok = (!q || it.getAttribute("data-text").indexOf(q) !== -1) && (level === "all" || it.getAttribute("data-level") === level);
        it.hidden = !ok;
        if (ok) shown++;
      });
      $$(".az-group", scope).forEach(function (g) { g.hidden = !$$(".filter-item:not([hidden])", g).length; });
      if (count) count.textContent = shown + " " + noun;
      if (empty) empty.hidden = shown !== 0;
    };
    if (input) input.addEventListener("input", apply);
    levelBtns.forEach(function (b) {
      b.addEventListener("click", function () {
        level = b.getAttribute("data-filter-level");
        levelBtns.forEach(function (x) { var on = x === b; x.classList.toggle("is-on", on); x.setAttribute("aria-pressed", on ? "true" : "false"); });
        apply();
      });
    });
  });

  /* ---- wide tables and charts: keyboard-focusable only when they really scroll ---- */
  var scrollers = $$("[data-scroll-label]");
  var syncScrollers = function () {
    scrollers.forEach(function (el) {
      if (el.scrollWidth > el.clientWidth + 1) {
        el.setAttribute("tabindex", "0");
        el.setAttribute("role", "group");
        el.setAttribute("aria-label", el.getAttribute("data-scroll-label") + " (scrolls sideways)");
      } else {
        el.removeAttribute("tabindex");
        el.removeAttribute("role");
        el.removeAttribute("aria-label");
      }
    });
  };
  if (scrollers.length) {
    syncScrollers();
    window.addEventListener("resize", syncScrollers);
    window.addEventListener("load", syncScrollers);
  }

  /* ---- "/" focuses search ---- */
  doc.addEventListener("keydown", function (e) {
    if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
    var t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
    var target = $("#q") || $("#heroq") || $("#hq");
    if (target && target.offsetParent !== null) { e.preventDefault(); target.focus(); }
  });

  /* ---- search suggestions (index is loaded lazily on first focus) ---- */
  var engine = null;
  var loading = null;
  window.edgetrSearch = {
    load: function () {
      if (engine) return Promise.resolve(engine);
      if (loading) return loading;
      loading = new Promise(function (resolve, reject) {
        var go = function () {
          fetch(withBase("/search-index.json")).then(function (r) { return r.json(); }).then(function (data) {
            var MS = window.MiniSearch;
            var mini = MS.loadJSON(JSON.stringify(data.index), data.options);
            engine = { mini: mini, synonyms: data.synonyms || {}, count: data.count };
            resolve(engine);
          }).catch(reject);
        };
        if (window.MiniSearch) return go();
        var s = doc.createElement("script");
        s.src = withBase("/js/vendor/minisearch.js");
        s.onload = go;
        s.onerror = reject;
        doc.head.appendChild(s);
      });
      return loading;
    },
    run: function (eng, query) { return window.edgetrSearchCore.run(eng.mini, eng.synonyms, query); },
    suggest: function (eng, query) { return window.edgetrSearchCore.suggest(eng.mini, query); },
    url: withBase
  };

  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  $$("form[data-suggest]").forEach(function (form) {
    var input = $("input[type=search]", form);
    var list = $(".suggest", form);
    if (!input || !list) return;
    var active = -1;
    var timer = null;
    var close = function () { list.hidden = true; input.setAttribute("aria-expanded", "false"); active = -1; input.removeAttribute("aria-activedescendant"); };
    var render = function (res, q) {
      var html = "";
      res.slice(0, 6).forEach(function (r, i) {
        html += '<a role="option" id="' + list.id + "-" + i + '" href="' + esc(withBase(r.url)) + '"><small>' + esc(r.areaLabel) + "</small><span>" + esc(r.title) + "</span></a>";
      });
      if (!res.length) html = '<p class="suggest-none" role="option" aria-disabled="true" aria-selected="false">No match yet. Press Enter to search everything.</p>';
      html += '<a class="suggest-all" role="option" id="' + list.id + '-all" href="' + esc(withBase("/search/?q=" + encodeURIComponent(q))) + '">See all results for "' + esc(q) + '"</a>';
      list.innerHTML = html;
      list.hidden = false;
      input.setAttribute("aria-expanded", "true");
      active = -1;
    };
    var update = function () {
      var q = input.value.trim();
      if (q.length < 2) return close();
      window.edgetrSearch.load().then(function (eng) {
        if (input.value.trim() !== q) return;
        render(window.edgetrSearch.run(eng, q), q);
      }).catch(close);
    };
    input.addEventListener("focus", function () { window.edgetrSearch.load().catch(function () {}); });
    input.addEventListener("input", function () { clearTimeout(timer); timer = setTimeout(update, 110); });
    input.addEventListener("keydown", function (e) {
      var opts = $$("a", list);
      if (e.key === "Escape") { close(); return; }
      if (list.hidden || !opts.length) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        active = (active + (e.key === "ArrowDown" ? 1 : -1) + opts.length) % opts.length;
        opts.forEach(function (o, i) { o.classList.toggle("is-active", i === active); });
        if (opts[active].id) input.setAttribute("aria-activedescendant", opts[active].id);
        opts[active].scrollIntoView({ block: "nearest" });
      } else if (e.key === "Enter" && active >= 0) {
        e.preventDefault();
        window.location.href = opts[active].href;
      }
    });
    doc.addEventListener("click", function (e) { if (!form.contains(e.target)) close(); });
    form.addEventListener("focusout", function () { setTimeout(function () { if (!form.contains(doc.activeElement)) close(); }, 120); });
  });
})();

/* Ethos Empire family showcase: start the entrance once, and run the ambient light only while the section is on screen. */
(function () {
  var el = document.querySelector("[data-family]");
  if (!el) return;
  if (!("IntersectionObserver" in window)) { el.classList.add("is-in"); return; }
  new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      el.classList.toggle("is-live", e.isIntersecting);
      if (e.isIntersecting) el.classList.add("is-in");
    });
  }, { threshold: 0.22 }).observe(el);
})();
