/* edgeTR Academy - search ranking. Shared by the browser (site.js) and the build-time search test.
   Ranking: title > aliases > tags > summary > body, exact-title boost, prefix + light typo tolerance, synonym expansion. */
(function (root) {
  "use strict";
  function expand(query, synonyms) {
    var lower = query.toLowerCase();
    var out = [query];
    var exact = false;
    Object.keys(synonyms || {}).forEach(function (key) {
      if (key.charAt(0) === "_") return;
      if (lower === key) exact = true;
      if (lower === key || (" " + lower + " ").indexOf(" " + key + " ") !== -1) out = out.concat(synonyms[key]);
    });
    return { queries: out, exact: exact };
  }
  function plural(a, b) { return a === b || a === b + "s" || a + "s" === b || a === b + "es" || a + "es" === b; }
  function makeOptions(lower) {
    return {
      boost: { title: 6, aliases: 4.5, tags: 2.4, summary: 1.6, body: 1 },
      prefix: function (term) { return term.length > 1; },
      fuzzy: function (term) { return term.length > 4 ? 0.2 : term.length > 3 ? 0.15 : 0; },
      combineWith: "AND",
      boostDocument: function (id, term, stored) {
        var t = String(stored.title || "").toLowerCase();
        var aliases = String(stored.aliases || "").toLowerCase().split(" | ");
        var boost = 1;
        if (stored.kind === "term") {
          // a glossary stub never outranks a full page whose title matches
          boost = plural(t, lower) || aliases.indexOf(lower) !== -1 ? 2 : 0.7;
        } else {
          if (plural(t, lower)) boost = 6;
          else if (aliases.indexOf(lower) !== -1) boost = 3.6;
          else if (t.indexOf(lower) === 0) boost = 2.4;
          else if ((" " + t.replace(/[^a-z0-9 ]/g, " ") + " ").indexOf(" " + lower + " ") !== -1) boost = 1.5;
          if (stored.pillar) boost *= 1.4;
          if (stored.kind === "shelf") boost *= 0.85;
        }
        return boost;
      }
    };
  }
  function run(mini, synonyms, query) {
    var q = String(query || "").trim();
    if (!q) return [];
    var ex = expand(q, synonyms);
    var seen = {};
    var out = [];
    ex.queries.forEach(function (qq, qi) {
      var opts = makeOptions(qq.toLowerCase());
      var res = mini.search(qq, opts);
      if (!res.length && qi === 0) {
        opts.combineWith = "OR";
        res = mini.search(qq, opts);
      }
      // when the whole query is a known synonym (for example "sl"), the expansion is what the reader meant
      var weight = qi === 0 ? (ex.exact ? 0.35 : 1) : ex.exact ? 1 : 0.8;
      res.forEach(function (r) {
        r.score *= weight;
        var prev = seen[r.id];
        if (prev) {
          // keep the best score a page earned across the query and its synonyms
          if (r.score > prev.score) prev.score = r.score;
          return;
        }
        seen[r.id] = r;
        out.push(r);
      });
    });
    // a glossary entry sits just below the full page it points to
    var byUrl = {};
    out.forEach(function (r) { byUrl[r.url] = r; });
    out.forEach(function (r) {
      if (r.kind === "term" && r.see && byUrl[r.see] && r.score >= byUrl[r.see].score) r.score = byUrl[r.see].score * 0.98;
    });
    out.sort(function (a, b) { return b.score - a.score; });
    return out;
  }
  function suggest(mini, query) {
    return mini.autoSuggest(query, { fuzzy: 0.25, prefix: true }).slice(0, 3).map(function (x) { return x.suggestion; });
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; });
  }
  /* Highlight query words. The raw text is split first and every piece is escaped on its own,
     so a word can never match inside a tag or an entity produced by an earlier step. */
  function mark(text, query) {
    var terms = String(query || "").split(/\s+/).filter(function (t) { return t.length > 1; })
      .map(function (t) { return t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); })
      .sort(function (x, y) { return y.length - x.length; });
    if (!terms.length) return esc(text);
    return String(text).split(new RegExp("(" + terms.join("|") + ")", "ig"))
      .map(function (part, i) { return i % 2 ? "<mark>" + esc(part) + "</mark>" : esc(part); }).join("");
  }
  root.edgetrSearchCore = { run: run, suggest: suggest, expand: expand, mark: mark, esc: esc };
})(typeof window !== "undefined" ? window : globalThis);
