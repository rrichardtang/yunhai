/* YunHai landing — Demo 01 controller: profile builder → live signal.
 * Self-contained: wires its own replay button + scroll-in autoplay.
 */
(function () {
  'use strict';

  function Timeline() { this.t = []; }
  Timeline.prototype.at = function (ms, fn) { this.t.push(setTimeout(fn, ms)); return this; };
  Timeline.prototype.clear = function () { this.t.forEach(clearTimeout); this.t = []; };

  function typeInto(el, text, perChar, tl, startAt, done) {
    for (var i = 0; i <= text.length; i++) {
      (function (n) {
        tl.at(startAt + n * perChar, function () { el.textContent = text.slice(0, n); });
      })(i);
    }
    if (done) tl.at(startAt + text.length * perChar + 40, done);
    return startAt + text.length * perChar + 40;
  }

  function Profile(root) {
    var tl = new Timeline();
    var bar = {
      tag: root.querySelector('[data-pf-tag]'),
      statk: root.querySelector('[data-pf-statk]'),
      statv: root.querySelector('[data-pf-statv]')
    };
    var sceneBuild = root.querySelector('[data-scene="build"]');
    var sceneUse = root.querySelector('[data-scene="use"]');
    var qs = Array.prototype.slice.call(root.querySelectorAll('.pfq'));
    var sumWrap = root.querySelector('.pf__summary');
    var sumHead = root.querySelector('.pf__summary-head');
    var sumHeadTxt = root.querySelector('[data-sum-head]');
    var sumBody = root.querySelector('[data-sum-body]');
    var sumCaret = root.querySelector('.pf__summary-body .scaret');

    // scene 2 refs
    var sigInput = root.querySelector('.pf__signal-input');
    var sigTyped = root.querySelector('.pf__signal-typed');
    var sigSend = root.querySelector('.pf__signal-send');
    var sigStatus = root.querySelector('.pf__signal-status');
    var sigSaved = root.querySelector('.pf__signal-saved');
    var newChip = root.querySelector('[data-new-chip]');
    var updated = root.querySelector('[data-updated]');
    var whyEl = root.querySelector('[data-why]');

    var WHY_BASE = 'A forested Shinto shrine in central Tokyo, a serene wooded walk that pairs neatly with Harajuku next door.';
    var WHY_NEW = 'The west-gate path frames a clean sunset over the great wooden torii, exactly the kind of evening you flagged.';
    var SUMMARY = "Curious, slow-paced, and food-led. You'd rather find the offbeat than tick off a top-10. Calm mornings, lively nights, and always somewhere with a view.";

    function setAnswered(n) { bar.statv.textContent = n + ' / 4'; }

    function reset() {
      tl.clear();
      sceneBuild.classList.add('is-active');
      sceneUse.classList.remove('is-active');
      bar.tag.textContent = '∴ Building your profile';
      bar.statk.textContent = 'Answered';
      setAnswered(0);
      qs.forEach(function (q) {
        q.classList.remove('in', 'is-active', 'is-typing');
        q.querySelectorAll('.pfpill').forEach(function (p) { p.classList.remove('picked'); });
        var t = q.querySelector('.pfq__typed'); if (t) t.textContent = '';
      });
      sumHead.classList.remove('done');
      sumHeadTxt.textContent = 'Reading your answers…';
      sumWrap.classList.remove('typing');
      sumBody.childNodes[0] && (sumBody.childNodes[0].textContent = '');
      // reset scene 2
      sigInput.classList.remove('is-typing');
      sigTyped.textContent = '';
      sigStatus.classList.remove('in');
      sigSaved.classList.remove('in');
      newChip.classList.remove('in');
      updated.classList.remove('in');
      whyEl.style.opacity = '1';
      whyEl.textContent = WHY_BASE;
    }

    function pick(qIndex, dotIndex, at) {
      tl.at(at, function () {
        var pills = qs[qIndex].querySelectorAll('.pfpill');
        if (pills[dotIndex]) pills[dotIndex].classList.add('picked');
      });
    }

    function play() {
      reset();
      var t = 300;

      // Q1 — interests (multi pill): Foodie(0), Slow travel(4), Off the beaten path(5)
      tl.at(t, function () { qs[0].classList.add('in'); });
      pick(0, 0, t + 450);
      pick(0, 4, t + 720);
      pick(0, 5, t + 980);
      tl.at(t + 1050, function () { setAnswered(1); });

      // Q2 — pace (single pill): Balanced(1)
      tl.at(t + 1400, function () { qs[1].classList.add('in'); });
      pick(1, 1, t + 1800);
      tl.at(t + 1870, function () { setAnswered(2); });

      // Q3 — free text
      var q3start = t + 2250;
      tl.at(q3start - 120, function () { qs[2].classList.add('in', 'is-active', 'is-typing'); });
      var q3typed = qs[2].querySelector('.pfq__typed');
      var q3end = typeInto(q3typed, 'Sunsets, tiny vinyl bars, anywhere with a view', 24, tl, q3start, function () {
        qs[2].classList.remove('is-typing', 'is-active'); setAnswered(3);
      });

      // Q4 — free text
      var q4start = q3end + 360;
      tl.at(q4start - 120, function () { qs[3].classList.add('in', 'is-active', 'is-typing'); });
      var q4typed = qs[3].querySelector('.pfq__typed');
      var q4end = typeInto(q4typed, 'Me + my partner. Quiet mornings, lively nights', 24, tl, q4start, function () {
        qs[3].classList.remove('is-typing', 'is-active'); setAnswered(4);
      });

      // AI summary
      var sumStart = q4end + 450;
      tl.at(sumStart - 200, function () { sumHeadTxt.textContent = 'Generating your traveler profile…'; });
      tl.at(sumStart - 150, function () { sumWrap.classList.add('typing'); });
      var bodyNode = sumBody.childNodes[0];
      var sumEnd = typeInto(bodyNode, SUMMARY, 17, tl, sumStart, function () {
        sumWrap.classList.remove('typing');
        sumHead.classList.add('done');
        sumHeadTxt.textContent = 'Traveler profile ready';
      });

      // ---- transition to scene 2 ----
      var s2 = sumEnd + 1100;
      tl.at(s2, function () {
        sceneBuild.classList.remove('is-active');
        sceneUse.classList.add('is-active');
        bar.tag.textContent = '∴ Refine anytime';
        bar.statk.textContent = 'Signals';
        bar.statv.textContent = 'saved 0';
      });

      // type the preference signal
      var sigStart = s2 + 800;
      tl.at(sigStart - 150, function () { sigInput.classList.add('is-typing'); });
      var sigEnd = typeInto(sigTyped, 'I love watching sunsets. Find me a shrine where I can watch the sunset from.', 17, tl, sigStart, function () {
        sigInput.classList.remove('is-typing');
      });

      // send → saving → saved
      tl.at(sigEnd + 250, function () { sigSend.classList.add('pulse'); });
      tl.at(sigEnd + 350, function () { sigStatus.classList.add('in'); });
      tl.at(sigEnd + 1100, function () {
        sigStatus.classList.remove('in');
        sigSaved.classList.add('in');
        bar.statv.textContent = 'saved 1';
      });
      // new learned chip
      tl.at(sigEnd + 1500, function () { newChip.classList.add('in'); });
      // card updates for the signal
      tl.at(sigEnd + 1900, function () { whyEl.style.opacity = '0'; });
      tl.at(sigEnd + 2180, function () { whyEl.textContent = WHY_NEW; whyEl.style.opacity = '1'; });
      tl.at(sigEnd + 2200, function () { updated.classList.add('in'); });
      tl.at(sigEnd + 2900, function () { if (onDone) onDone(); });
    }

    var onDone = null;
    return { reset: reset, play: play, done: function (cb) { onDone = cb; }, root: root };
  }

  function init() {
    var root = document.querySelector('[data-demo="personalize"]');
    if (!root) return;
    var demo = Profile(root);
    demo.reset();

    var btn = document.querySelector('.chapter__replay[data-replay="personalize"]');
    if (btn) {
      btn.addEventListener('click', function () {
        btn.classList.add('is-playing');
        demo.done(function () { btn.classList.remove('is-playing'); });
        demo.play();
      });
    }

    // Robust scroll-based autoplay: IntersectionObserver thresholds are
    // unreliable when the demo is taller than the viewport, so measure overlap
    // directly and fire once when at least half of it (capped to viewport) shows.
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
