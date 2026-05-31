/* YunHai landing — Demo 02 controller: scheduling preference → itinerary fill.
 * Scene 1 selects a pace on the dot-scale. Scene 2 drops activities into the day
 * in order, with real drive-time pills appearing between them and a live transit total.
 */
(function () {
  'use strict';

  function Timeline() { this.t = []; }
  Timeline.prototype.at = function (ms, fn) { this.t.push(setTimeout(fn, ms)); return this; };
  Timeline.prototype.clear = function () { this.t.forEach(clearTimeout); this.t = []; };

  function fmtMins(v) {
    v = Math.round(v);
    if (v < 60) return v + 'm';
    return Math.floor(v / 60) + 'h ' + (v % 60) + 'm';
  }

  function Sequence(root) {
    var tl = new Timeline();
    var sceneP = root.querySelector('[data-sq-scene="pref"]');
    var sceneF = root.querySelector('[data-sq-scene="fill"]');
    var tag = root.querySelector('[data-sq-tag]');
    var statk = root.querySelector('[data-sq-statk]');
    var statv = root.querySelector('[data-sq-statv]');

    // scene 1
    var dots = Array.prototype.slice.call(root.querySelectorAll('.sqd'));
    var fill = root.querySelector('.sqp__fill');
    var nowMeta = root.querySelector('.sqp__choice .now-meta');
    var TARGET = 2; // 0-indexed → 3rd dot, "Moderate"

    // scene 2
    var steps = Array.prototype.slice.call(root.querySelectorAll('[data-sq-step]'));
    var count = root.querySelector('[data-sq-count]');
    var total = root.querySelector('[data-sq-total]');
    var footNote = root.querySelector('[data-sq-note]');
    var activityCount = root.querySelectorAll('.sqcard').length;

    function reset() {
      tl.clear();
      sceneP.classList.add('is-active');
      sceneF.classList.remove('is-active');
      tag.textContent = '∴ Scheduling preference';
      statk.textContent = 'Step';
      statv.textContent = '1 / 2';
      dots.forEach(function (d) { d.classList.remove('done', 'now'); });
      fill.style.width = '0';
      if (nowMeta) nowMeta.classList.remove('in');
      // scene 2 reset
      steps.forEach(function (s) { s.classList.remove('in'); });
      if (count) count.textContent = '0 stops';
      if (total) total.textContent = '0m';
      if (footNote) footNote.style.opacity = '0';
    }

    function play() {
      reset();
      // ---- scene 1: walk the scale to TARGET (Moderate) ----
      var stepDur = 300;
      for (var i = 0; i <= TARGET; i++) {
        (function (idx) {
          tl.at(500 + idx * stepDur, function () {
            dots.forEach(function (d, j) {
              d.classList.toggle('done', j < idx);
              d.classList.toggle('now', j === idx);
            });
            var pct = (idx / (dots.length - 1)) * 100;
            fill.style.width = 'calc(' + pct + '% - ' + (pct / 100 * 24) + 'px)';
          });
        })(i);
      }
      var afterScale = 500 + (TARGET + 1) * stepDur + 200;
      tl.at(afterScale, function () { if (nowMeta) nowMeta.classList.add('in'); });

      // ---- transition to scene 2 ----
      var s2 = afterScale + 1100;
      tl.at(s2, function () {
        sceneP.classList.remove('is-active');
        sceneF.classList.add('is-active');
        tag.textContent = '∴ Ordering your day';
        statk.textContent = 'Stops';
        statv.textContent = '0 / ' + activityCount;
      });

      // ---- scene 2: reveal each step (anchor / transit / card) in order ----
      var t = s2 + 600;
      var placed = 0;
      var runningTransit = 0;
      steps.forEach(function (el) {
        var isCard = el.classList.contains('sqcard') || !!el.querySelector('.sqcard');
        var isTransit = el.classList.contains('sqtransit');
        var mins = parseInt(el.getAttribute('data-mins') || '0', 10);
        var gap = isTransit ? 360 : 560;
        tl.at(t, function () {
          el.classList.add('in');
          if (isCard) {
            placed++;
            if (count) count.textContent = placed + (placed === 1 ? ' stop' : ' stops');
            statv.textContent = placed + ' / ' + activityCount;
          }
          if (isTransit && mins) {
            runningTransit += mins;
            if (total) total.textContent = fmtMins(runningTransit);
          }
        });
        t += gap;
      });

      tl.at(t + 150, function () { if (footNote) footNote.style.opacity = '1'; });
      tl.at(t + 850, function () { if (onDone) onDone(); });
    }

    var onDone = null;
    return { reset: reset, play: play, done: function (cb) { onDone = cb; }, root: root };
  }

  function init() {
    var root = document.querySelector('[data-demo="sequence"]');
    if (!root) return;
    var demo = Sequence(root);
    demo.reset();

    var btn = document.querySelector('.chapter__replay[data-replay="sequence"]');
    if (btn) {
      btn.addEventListener('click', function () {
        btn.classList.add('is-playing');
        demo.done(function () { btn.classList.remove('is-playing'); });
        demo.play();
      });
    }

    var seen = false;
    function inView() {
      var r = root.getBoundingClientRect();
      var vh = window.innerHeight || document.documentElement.clientHeight;
      var visible = Math.min(r.bottom, vh) - Math.max(r.top, 0);
      return visible > 0 && visible >= Math.min(root.offsetHeight, vh) * 0.5;
    }
    function maybePlay() {
      if (seen || !inView()) return;
      seen = true;
      window.removeEventListener('scroll', maybePlay);
      if (btn) {
        btn.classList.add('is-playing');
        demo.done(function () { btn.classList.remove('is-playing'); });
      }
      demo.play();
    }
    window.addEventListener('scroll', maybePlay, { passive: true });
    window.addEventListener('resize', maybePlay, { passive: true });
    maybePlay();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
