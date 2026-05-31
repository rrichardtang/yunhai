/* YunHai landing — Demo 03 controller: itinerary view + upload/view-files.
 * A faux cursor clicks "Upload Tickets" on the arrival stop; a file uploads;
 * the booking status flips to attached; then "View Files" opens a popover.
 */
(function () {
  'use strict';

  function Timeline() { this.t = []; }
  Timeline.prototype.at = function (ms, fn) { this.t.push(setTimeout(fn, ms)); return this; };
  Timeline.prototype.clear = function () { this.t.forEach(clearTimeout); this.t = []; };

  function Organize(root) {
    var tl = new Timeline();
    var og = root.querySelector('.og');
    var cursor = root.querySelector('.og__cursor');
    var upload = root.querySelector('.og__upload');
    var uploadBar = root.querySelector('.og__upload-bar');
    var files = root.querySelector('.og__files');
    var fileItems = Array.prototype.slice.call(root.querySelectorAll('.ogfile'));
    var statv = root.querySelector('[data-og-files]');
    var tools = Array.prototype.slice.call(root.querySelectorAll('.ogtool'));

    // target stop (arrival/flight)
    var flightStop = root.querySelector('.ogstop.is-flight');
    var ref = flightStop.querySelector('.ogstop__ref');
    var uploadBtn = flightStop.querySelector('[data-action="upload"]');
    var viewBtn = flightStop.querySelector('[data-action="files"]');

    function moveCursorTo(target, cb) {
      var ogRect = og.getBoundingClientRect();
      var r = target.getBoundingClientRect();
      var x = r.left - ogRect.left + r.width / 2 - 4;
      var y = r.top - ogRect.top + r.height / 2 - 2;
      cursor.style.setProperty('--cx', x + 'px');
      cursor.style.setProperty('--cy', y + 'px');
      cursor.style.transform = 'translate(' + x + 'px,' + y + 'px)';
      if (cb) setTimeout(cb, 740);
    }
    function tap(cb) {
      cursor.classList.add('tap');
      setTimeout(function () { cursor.classList.remove('tap'); if (cb) cb(); }, 180);
    }

    function reset() {
      tl.clear();
      cursor.classList.remove('in', 'tap');
      cursor.style.transform = 'translate(40px,40px)';
      upload.classList.remove('in', 'done');
      uploadBar.style.width = '0';
      files.classList.remove('in');
      fileItems.forEach(function (f) { f.classList.remove('in'); });
      tools.forEach(function (t) { t.classList.remove('done'); });
      ref.classList.remove('attached', 'flash');
      ref.innerHTML = 'No booking attached';
      viewBtn.setAttribute('disabled', '');
      viewBtn.innerHTML = viewBtn.getAttribute('data-empty');
      uploadBtn.classList.remove('is-hot');
      if (statv) statv.textContent = '0';
    }

    function play() {
      reset();
      // 1) cursor appears, moves to Upload Tickets
      tl.at(400, function () { cursor.classList.add('in'); moveCursorTo(uploadBtn); });
      // 2) click upload
      tl.at(1300, function () { tap(function () { uploadBtn.classList.add('is-hot'); }); });
      // 3) upload card appears + progress fills
      tl.at(1560, function () { upload.classList.add('in'); });
      tl.at(1720, function () { uploadBar.style.width = '100%'; });
      // 4) upload completes
      tl.at(2950, function () {
        upload.classList.add('done');
        uploadBtn.classList.remove('is-hot');
      });
      // 5) booking status flips to attached, View Files enables
      tl.at(3250, function () {
        ref.classList.add('attached', 'flash');
        ref.innerHTML = 'Boarding pass · <code>haneda-boarding-pass.pdf</code>';
        viewBtn.removeAttribute('disabled');
        viewBtn.innerHTML = viewBtn.getAttribute('data-full');
        if (statv) statv.textContent = '1';
      });
      // 6) hide upload card
      tl.at(3900, function () { upload.classList.remove('in'); });
      // 7) cursor moves to View Files, clicks
      tl.at(4150, function () { moveCursorTo(viewBtn); });
      tl.at(4950, function () { tap(); });
      // 8) files popover opens, file rows stagger in
      tl.at(5200, function () { files.classList.add('in'); });
      fileItems.forEach(function (f, i) {
        tl.at(5450 + i * 220, function () { f.classList.add('in'); });
      });
      // 9) walk the export toolbar — sync, share, download — each confirms
      tl.at(6050, function () { if (tools[0]) moveCursorTo(tools[0]); });
      tl.at(6750, function () { tap(function () { if (tools[0]) tools[0].classList.add('done'); }); });
      tl.at(7050, function () { if (tools[1]) moveCursorTo(tools[1]); });
      tl.at(7700, function () { tap(function () { if (tools[1]) tools[1].classList.add('done'); }); });
      tl.at(8000, function () { if (tools[2]) moveCursorTo(tools[2]); });
      tl.at(8650, function () { tap(function () { if (tools[2]) tools[2].classList.add('done'); }); });
      // 10) park cursor, done
      tl.at(9200, function () { cursor.classList.remove('in'); });
      tl.at(9500, function () { if (onDone) onDone(); });
    }

    var onDone = null;
    return { reset: reset, play: play, done: function (cb) { onDone = cb; }, root: root };
  }

  function init() {
    var root = document.querySelector('[data-demo="organize"]');
    if (!root) return;
    var demo = Organize(root);
    demo.reset();

    var btn = document.querySelector('.chapter__replay[data-replay="organize"]');
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
