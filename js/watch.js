/* edgeTR Academy - "Watch in 60 Seconds" player.
   Plays a sequence of animated figures in sync with a small narration track.
   No autoplay, no third-party code. Works in captions-only mode when a lesson has no audio. */
(function () {
  "use strict";
  var doc = document;
  var BASE = doc.documentElement.getAttribute("data-base") || "/";
  var withBase = function (url) { return BASE.replace(/\/$/, "") + url; };
  var clock = function (t) { t = Math.max(0, t); return Math.floor(t / 60) + ":" + ("0" + Math.floor(t % 60)).slice(-2); };
  var SPEEDS = [1, 1.25, 1.5, 0.75];
  var ICON = {
    play: '<path d="M7.500 4.500v15l12-7.500z"/>',
    pause: '<path d="M8.500 5v14M15.500 5v14"/>',
    volume: '<path d="M4 9.500v5h3.500l4.500 4v-13l-4.500 4z"/><path d="M15.500 9a4 4 0 0 1 0 6M18 6.500a7.500 7.500 0 0 1 0 11"/>',
    muted: '<path d="M4 9.500v5h3.500l4.500 4v-13l-4.500 4z"/><path d="M16 9.500l5 5M21 9.500l-5 5"/>'
  };
  var setIcon = function (btn, name) { var svg = btn.querySelector("svg"); if (svg) svg.innerHTML = ICON[name]; };

  Array.prototype.forEach.call(doc.querySelectorAll("[data-watch]"), function (root) {
    var q = function (s) { return root.querySelector(s); };
    var data;
    try { data = JSON.parse(q("[data-watch-data]").textContent); } catch (e) { return; }
    var lines = data.lines;
    var duration = data.duration;
    var stage = q("[data-watch-stage]");
    var caption = q("[data-watch-caption]");
    var intro = caption.textContent;
    var toggle = q("[data-watch-toggle]");
    var seek = q("[data-watch-seek]");
    var timeEl = q("[data-watch-time]");
    var speedBtn = q("[data-watch-speed]");
    var muteBtn = q("[data-watch-mute]");
    var ccBtn = q("[data-watch-cc]");
    var status = q("[data-watch-status]");
    var bigPlay = q("[data-watch-start]");
    var audioUrl = root.getAttribute("data-audio");
    var audio = null;
    var silent = !audioUrl;      // captions-only mode (no narration file)
    var playing = false;
    var started = false;
    var captionsOn = true;
    var speedIndex = 0;
    var t = 0;                    // current time in seconds
    var lastTick = 0;
    var raf = 0;
    var scenes = [];
    var activeScene = -1;
    var activeLine = -1;
    var dragging = false;

    root.classList.add("is-ready");

    function buildScenes() {
      if (scenes.length) return;
      var tpl = q("[data-watch-scenes]");
      if (tpl && tpl.content) stage.insertBefore(tpl.content.cloneNode(true), bigPlay);
      scenes = Array.prototype.slice.call(stage.querySelectorAll(".watch-scene"));
    }

    function ensureAudio() {
      if (audio || silent) return;
      audio = new Audio();
      audio.preload = "auto";
      audio.src = withBase(audioUrl);
      audio.addEventListener("ended", function () { finish(); });
      audio.addEventListener("error", function () {
        // keep the lesson usable without sound
        silent = true;
        audio = null;
        if (muteBtn) muteBtn.hidden = true;
        status.textContent = "The narration could not be loaded. Playing with captions only.";
        if (playing) { lastTick = performance.now(); }
      });
    }

    function lineAt(time) {
      for (var i = lines.length - 1; i >= 0; i--) if (time >= lines[i].s) return i;
      return 0;
    }

    function showScene(index, animate) {
      if (index === activeScene) return;
      activeScene = index;
      scenes.forEach(function (el, i) {
        var on = i === index;
        el.classList.toggle("is-active", on);
        el.setAttribute("aria-hidden", on ? "false" : "true");
        var fig = el.querySelector(".watch-figure");
        if (fig) {
          fig.classList.remove("is-in");
          if (on && animate) { void fig.offsetWidth; fig.classList.add("is-in"); }
        }
      });
    }

    function render(animate) {
      var li = lineAt(t);
      var line = lines[li];
      showScene(line.c, animate);
      if (li !== activeLine) {
        activeLine = li;
        if (started) caption.textContent = line.t;
      }
      var sceneEl = scenes[line.c];
      if (sceneEl) {
        Array.prototype.forEach.call(sceneEl.querySelectorAll(".watch-points li"), function (p) {
          p.classList.toggle("is-on", t + 0.05 >= parseFloat(p.getAttribute("data-at")));
        });
      }
      if (!dragging) seek.value = String(Math.round(t * 10) / 10);
      seek.setAttribute("aria-valuetext", clock(t) + " of " + clock(duration));
      seek.style.setProperty("--p", (duration ? (t / duration) * 100 : 0) + "%");
      timeEl.textContent = clock(t) + " / " + clock(duration);
    }

    function tick(now) {
      if (!playing) return;
      if (!silent && audio) {
        t = audio.currentTime;
      } else {
        t += ((now - lastTick) / 1000) * SPEEDS[speedIndex];
        lastTick = now;
        if (t >= duration) { t = duration; render(true); finish(); return; }
      }
      render(true);
      raf = requestAnimationFrame(tick);
    }

    function setPlaying(on) {
      playing = on;
      root.classList.toggle("is-playing", on);
      toggle.setAttribute("aria-label", on ? "Pause" : "Play");
      toggle.setAttribute("title", on ? "Pause" : "Play");
      setIcon(toggle, on ? "pause" : "play");
    }

    function play() {
      buildScenes();
      ensureAudio();
      if (t >= duration - 0.05) { t = 0; activeLine = -1; activeScene = -1; }
      if (!started) {
        started = true;
        root.classList.add("is-started");
        activeLine = -1;
      }
      var begin = function () {
        setPlaying(true);
        lastTick = performance.now();
        render(true);
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(tick);
      };
      if (!silent && audio) {
        audio.playbackRate = SPEEDS[speedIndex];
        if (Math.abs(audio.currentTime - t) > 0.3) { try { audio.currentTime = t; } catch (e) {} }
        var p = audio.play();
        if (p && p.then) {
          p.then(begin).catch(function () {
            // the browser refused to play sound: fall back to captions only
            silent = true;
            if (muteBtn) muteBtn.hidden = true;
            status.textContent = "Sound could not start. Playing with captions only.";
            begin();
          });
        } else begin();
      } else begin();
    }

    function pause() {
      if (audio) audio.pause();
      setPlaying(false);
      cancelAnimationFrame(raf);
    }

    function finish() {
      pause();
      root.classList.add("is-ended");
      status.textContent = "Finished. Use Replay to watch again.";
    }

    function seekTo(time, keepState) {
      buildScenes();
      t = Math.max(0, Math.min(duration, time));
      if (audio) { try { audio.currentTime = Math.min(t, Math.max(0, (audio.duration || duration) - 0.05)); } catch (e) {} }
      if (!started) { started = true; root.classList.add("is-started"); }
      root.classList.remove("is-ended");
      status.textContent = "";
      activeLine = -1;
      lastTick = performance.now();
      render(false);
      if (!keepState && !playing) play();
    }

    toggle.addEventListener("click", function () { if (playing) pause(); else { root.classList.remove("is-ended"); status.textContent = ""; play(); } });
    bigPlay.addEventListener("click", function () { root.classList.remove("is-ended"); status.textContent = ""; play(); toggle.focus(); });
    q("[data-watch-replay]").addEventListener("click", function () { pause(); t = 0; if (audio) { try { audio.currentTime = 0; } catch (e) {} } activeLine = -1; activeScene = -1; root.classList.remove("is-ended"); status.textContent = ""; play(); });
    seek.addEventListener("input", function () { dragging = true; seekTo(parseFloat(seek.value), true); });
    seek.addEventListener("change", function () { dragging = false; seekTo(parseFloat(seek.value), true); });
    speedBtn.addEventListener("click", function () {
      speedIndex = (speedIndex + 1) % SPEEDS.length;
      var s = SPEEDS[speedIndex];
      speedBtn.textContent = s + "×";
      speedBtn.setAttribute("aria-label", "Playback speed: " + s + " times");
      if (audio) audio.playbackRate = s;
    });
    if (muteBtn) muteBtn.addEventListener("click", function () {
      ensureAudio();
      if (!audio) return;
      audio.muted = !audio.muted;
      muteBtn.setAttribute("aria-pressed", audio.muted ? "true" : "false");
      muteBtn.setAttribute("aria-label", audio.muted ? "Unmute narration" : "Mute narration");
      muteBtn.setAttribute("title", audio.muted ? "Unmute narration" : "Mute narration");
      setIcon(muteBtn, audio.muted ? "muted" : "volume");
    });
    ccBtn.addEventListener("click", function () {
      captionsOn = !captionsOn;
      ccBtn.setAttribute("aria-pressed", captionsOn ? "true" : "false");
      root.classList.toggle("is-cc-off", !captionsOn);
    });
    Array.prototype.forEach.call(root.querySelectorAll("[data-seek]"), function (b) {
      b.addEventListener("click", function () { seekTo(parseFloat(b.getAttribute("data-seek")), false); stage.scrollIntoView({ block: "nearest" }); });
    });
    // keyboard shortcuts while focus is inside the player (never on the range input itself, which has its own keys)
    root.addEventListener("keydown", function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      var tag = e.target.tagName;
      if (tag === "INPUT" || tag === "SUMMARY") return;
      var k = e.key.toLowerCase();
      if (k === "k") { e.preventDefault(); toggle.click(); }
      else if (k === "m" && muteBtn) { e.preventDefault(); muteBtn.click(); }
      else if (k === "c") { e.preventDefault(); ccBtn.click(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); seekTo(t + 5, true); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); seekTo(t - 5, true); }
    });
    // stop when the player is scrolled far away or the tab is hidden
    doc.addEventListener("visibilitychange", function () { if (doc.hidden && playing) pause(); });

    // test hook (read-only state, used by the automated playback checks)
    root.watchState = function () { return { t: t, playing: playing, silent: silent, line: activeLine, scene: activeScene, started: started, speed: SPEEDS[speedIndex], audioTime: audio ? audio.currentTime : null, audioDuration: audio ? audio.duration : null, muted: audio ? audio.muted : null }; };
  });
})();
