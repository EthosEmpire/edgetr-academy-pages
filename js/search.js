/* edgeTR Academy - search page. Uses the engine exposed by site.js. */
(function () {
  "use strict";
  var doc = document;
  var form = doc.querySelector("[data-search-form]");
  if (!form || !window.edgetrSearch) return;
  var input = form.querySelector("input");
  var list = doc.querySelector("[data-search-results]");
  var status = doc.querySelector("[data-search-status]");
  var empty = doc.querySelector("[data-search-empty]");
  var start = doc.querySelector("[data-search-start]");
  var filters = doc.querySelector("[data-search-filters]");
  var S = window.edgetrSearch;
  var area = "all";
  var level = "all";
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var mark = window.edgetrSearchCore.mark;

  var render = function (q) {
    q = q.trim();
    if (!q) {
      list.innerHTML = "";
      status.textContent = "";
      empty.hidden = true;
      filters.hidden = true;
      start.hidden = false;
      return;
    }
    start.hidden = true;
    status.textContent = "Searching...";
    S.load().then(function (eng) {
      if (input.value.trim() !== q) return;
      var all = S.run(eng, q);
      var res = all.filter(function (r) {
        return (area === "all" || r.area === area) && (level === "all" || r.level === level);
      });
      filters.hidden = all.length === 0;
      if (!res.length) {
        list.innerHTML = "";
        var sugg = S.suggest(eng, q).filter(function (s) { return s.toLowerCase() !== q.toLowerCase(); });
        var html = "<p><strong>No results for “" + esc(q) + "”" + (all.length ? " with these filters" : "") + ".</strong></p><ul>";
        if (all.length) html += "<li>Try removing a filter above.</li>";
        sugg.forEach(function (s) { html += '<li>Did you mean <a href="' + esc(S.url("/search/?q=" + encodeURIComponent(s))) + '">' + esc(s) + "</a>?</li>"; });
        html += '<li>Check the spelling, or try a shorter word.</li><li>Look it up in the <a href="' + S.url("/glossary/") + '">A-Z Glossary</a>.</li><li>Browse the <a href="' + S.url("/library/") + '">Library</a> or the <a href="' + S.url("/foundations/") + '">Foundations</a>.</li></ul>';
        empty.innerHTML = html;
        empty.hidden = false;
        status.textContent = "0 results";
        return;
      }
      empty.hidden = true;
      status.textContent = res.length + (res.length === 1 ? " result" : " results") + " for “" + q + "”";
      list.innerHTML = res.slice(0, 60).map(function (r) {
        return '<li><a href="' + esc(S.url(r.url)) + '"><small>' + esc(r.areaLabel) + (r.level ? " · " + esc(r.level) : "") + "</small><strong>" + mark(r.title, q) + "</strong><span>" + mark(r.summary || "", q) + "</span></a></li>";
      }).join("");
    }).catch(function () {
      status.textContent = "Search could not load. Please browse the Glossary or the Library instead.";
    });
  };

  var params = new URLSearchParams(window.location.search);
  var initial = params.get("q") || "";
  input.value = initial;
  render(initial);

  var timer = null;
  input.addEventListener("input", function () {
    clearTimeout(timer);
    timer = setTimeout(function () {
      var q = input.value.trim();
      var url = q ? "?q=" + encodeURIComponent(q) : window.location.pathname;
      window.history.replaceState(null, "", url);
      render(q);
    }, 120);
  });
  form.addEventListener("submit", function (e) { e.preventDefault(); render(input.value); });

  Array.prototype.forEach.call(doc.querySelectorAll("[data-f-area], [data-f-level]"), function (b) {
    b.addEventListener("click", function () {
      var isArea = b.hasAttribute("data-f-area");
      if (isArea) area = b.getAttribute("data-f-area"); else level = b.getAttribute("data-f-level");
      Array.prototype.forEach.call(b.parentNode.children, function (x) { var on = x === b; x.classList.toggle("is-on", on); x.setAttribute("aria-pressed", on ? "true" : "false"); });
      render(input.value);
    });
  });
})();
