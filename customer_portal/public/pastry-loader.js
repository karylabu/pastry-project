/*!
 * Pastry Project - logo intro loader v3
 * Progress includes document readiness and API requests registered with PastryLoader.task().
 */
(function () {
  if (window.PastryLoader) return;

  var CFG = Object.assign({ delay: 300, minVisible: 2400, slowMs: 8000, maxMs: 20000 }, window.PASTRY_LOADER_CONFIG || {});

  var css = `
#pl-root{position:fixed;inset:0;z-index:2147483000;background:#fdf9f4;display:flex;align-items:center;justify-content:center;opacity:1;transition:opacity .6s ease;font-family:"DM Sans",system-ui,sans-serif;color:#1f1a17;padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px);box-sizing:border-box}
#pl-root.pl-hold{visibility:hidden;opacity:0;transition:none}
#pl-root.pl-out{opacity:0;pointer-events:none}
#pl-root .pl-box{text-align:center;padding:24px;transition:transform .6s ease}
#pl-root.pl-out .pl-box{transform:scale(1.05)}
#pl-root .pl-logo-wrap{position:relative;width:120px;height:130px;margin:0 auto 10px}
#pl-root img.pl-logo{display:block;width:100%;height:100%;object-fit:contain;opacity:0;transform:scale(.82)}
#pl-root.pl-go img.pl-logo{animation:pl-logo-in .8s cubic-bezier(.2,.8,.2,1) .15s forwards}
@keyframes pl-logo-in{to{opacity:1;transform:scale(1)}}
#pl-root .pl-sparkle{position:absolute;width:12px;height:12px;color:#c4a032;opacity:0;transform:scale(0)}
#pl-root .pl-sparkle::before,#pl-root .pl-sparkle::after{content:"";position:absolute;left:50%;top:50%;background:currentColor;border-radius:2px;transform:translate(-50%,-50%)}
#pl-root .pl-sparkle::before{width:2px;height:100%}
#pl-root .pl-sparkle::after{width:100%;height:2px}
#pl-root .pl-sparkle:nth-child(2){left:8px;top:27px;--twinkle:0s}
#pl-root .pl-sparkle:nth-child(3){right:7px;top:16px;width:10px;height:10px;--twinkle:.55s}
#pl-root .pl-sparkle:nth-child(4){right:3px;top:79px;width:8px;height:8px;--twinkle:1.1s}
#pl-root.pl-go .pl-sparkle{animation:pl-twinkle 1.8s ease-out var(--twinkle) infinite}
@keyframes pl-twinkle{0%,100%{opacity:0;transform:scale(0) rotate(0)}22%{opacity:1;transform:scale(1) rotate(45deg)}55%{opacity:0;transform:scale(1.55) rotate(90deg)}}
#pl-root .pl-name{font-family:"Playfair Display",Georgia,serif;font-style:italic;font-weight:700;font-size:clamp(34px,10vw,46px);line-height:1.1;white-space:nowrap}
#pl-root .pl-name .pj{color:#c4a032}
#pl-root .pl-name .gap{display:inline-block;width:.28em}
#pl-root .ch{display:inline-block;opacity:0;transform:translateY(16px)}
#pl-root.pl-go .ch{animation:pl-rise .5s ease forwards;animation-delay:calc(.9s + var(--i)*40ms)}
@keyframes pl-rise{to{opacity:1;transform:none}}
#pl-root .pl-tag{opacity:0;font-size:11px;letter-spacing:.32em;color:#8d857e;margin:8px 0 18px;text-transform:uppercase}
#pl-root.pl-go .pl-tag{animation:pl-fade .6s ease 1.6s forwards}
@keyframes pl-fade{to{opacity:1}}
#pl-root.pl-go .pl-logo-wrap{animation:pl-float 3s ease-in-out 1.6s infinite}
@keyframes pl-float{50%{transform:translateY(-5px)}}
#pl-root .pl-track{width:160px;height:2px;background:#efe3d6;margin:0 auto;border-radius:2px;overflow:hidden}
#pl-root .pl-bar{height:100%;width:0;background:#c4a032}
#pl-root .pl-msg{color:#8d857e;font-size:15px;min-height:1.6em;margin:14px 0 0}
#pl-root .pl-retry{display:none;margin-top:14px;font:inherit;font-size:12px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#1f1a17;background:#fcf1c6;border:1px solid #c4a032;border-radius:999px;padding:11px 28px;cursor:pointer}
#pl-root.pl-fail .pl-retry{display:inline-block}
#pl-root .pl-retry:focus-visible{outline:3px solid #1f1a17;outline-offset:3px}
@media (prefers-reduced-motion:reduce){#pl-root *{animation:none!important}#pl-root,#pl-root .pl-box{transition:none}#pl-root .pl-logo{opacity:1;transform:none}#pl-root .pl-sparkle{display:none}#pl-root .ch,#pl-root .pl-tag{opacity:1;transform:none}}
`;

  var style = document.createElement('style');
  style.textContent = css;
  (document.head || document.documentElement).appendChild(style);

  var root = document.createElement('div');
  root.id = 'pl-root';
  root.className = 'pl-hold';
  root.setAttribute('role', 'status');
  root.setAttribute('aria-label', 'Loading');
  root.innerHTML = `
<div class="pl-box">
<div class="pl-logo-wrap">
<img class="pl-logo" src="/uploads/logo.png?v=logo-v2" alt="Pastry Project" />
<span class="pl-sparkle" aria-hidden="true"></span>
<span class="pl-sparkle" aria-hidden="true"></span>
<span class="pl-sparkle" aria-hidden="true"></span>
</div>
<div class="pl-name"><span class="a"></span><span class="gap"></span><span class="pj"></span></div>
<div class="pl-tag">Baked fresh daily</div>
<div class="pl-track"><div class="pl-bar"></div></div>
<p class="pl-msg"></p>
<button class="pl-retry" type="button">Try again</button>
</div>`;
  document.documentElement.appendChild(root);

  function letters(el, text, offset) {
    for (var i = 0; i < text.length; i++) {
      var span = document.createElement('span');
      span.className = 'ch';
      span.style.setProperty('--i', i + offset);
      span.textContent = text.charAt(i);
      el.appendChild(span);
    }
  }
  letters(root.querySelector('.a'), 'Pastry', 0);
  letters(root.querySelector('.pj'), 'Project', 7);

  var barEl = root.querySelector('.pl-bar');
  var msgEl = root.querySelector('.pl-msg');
  var retryEl = root.querySelector('.pl-retry');
  var st = { dcl: false, fonts: false, load: false, app: false };

  if (document.readyState !== 'loading') st.dcl = true;
  else document.addEventListener('DOMContentLoaded', function () { st.dcl = true; });
  if (document.readyState === 'complete') st.load = true;
  else window.addEventListener('load', function () { st.load = true; });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { st.fonts = true; });
  else st.fonts = true;

  var run = CFG;
  var p = 0, t0 = 0, last = 0, raf = 0, shownAt = 0, startedAt = 0;
  var active = false, finishing = false, forced = false, failed = false;
  var total = 0, done = 0, pending = 0, timers = [];
  var API = {};

  function isReady() {
    return forced || (st.dcl && st.fonts && st.load && st.app && pending === 0);
  }

  function targetPct() {
    var milestones = (st.dcl ? 25 : 0) + (st.fonts ? 15 : 0) + (st.load ? 20 : 0);
    var requests = total ? 40 * done / total : 0;
    return Math.min(96, milestones + requests);
  }

  function render(elapsed) {
    barEl.style.width = p + '%';
    if (!failed) msgEl.textContent = elapsed >= run.slowMs ? 'Still baking, thanks for waiting…' : '';
  }

  function end(silent) {
    active = false;
    if (silent) {
      root.style.display = 'none';
      document.documentElement.style.overflow = '';
      return;
    }
    timers.push(setTimeout(function () {
      root.classList.add('pl-out');
      document.documentElement.style.overflow = '';
      timers.push(setTimeout(function () { root.style.display = 'none'; }, 650));
    }, 300));
  }

  function reveal(timestamp) {
    shownAt = timestamp || performance.now();
    root.classList.remove('pl-hold');
    root.classList.add('pl-go');
    document.documentElement.style.overflow = 'hidden';
  }

  function frame(timestamp) {
    if (!active || failed) return;
    if (!t0) { t0 = timestamp; last = timestamp; }
    var delta = Math.min(0.1, (timestamp - last) / 1000);
    last = timestamp;
    var elapsed = timestamp - t0;

    var ready = isReady();
    if (!shownAt && elapsed >= run.delay) {
      if (ready) { end(true); return; }
      reveal(timestamp);
    }
    if (!finishing && (ready || elapsed >= run.maxMs)) {
      if (!shownAt) { end(true); return; }
      if (timestamp - shownAt >= run.minVisible) finishing = true;
    }
    if (finishing) {
      p = Math.min(100, p + delta * 130);
    } else {
      var target = targetPct();
      if (ready && shownAt) target = Math.max(target, 96 * Math.min(1, (timestamp - shownAt) / run.minVisible));
      if (target > p) p += (target - p) * (1 - Math.exp(-delta * 4));
    }
    render(elapsed);
    if (p >= 100) { end(false); return; }
    raf = requestAnimationFrame(frame);
  }

  API.show = function (options) {
    for (var i = 0; i < timers.length; i++) clearTimeout(timers[i]);
    timers = [];
    cancelAnimationFrame(raf);
    run = Object.assign({}, CFG, options || {});
    p = 0; t0 = 0; last = 0; shownAt = 0; startedAt = performance.now();
    total = 0; done = 0; pending = 0;
    active = true; finishing = false; forced = false; failed = false;
    root.classList.remove('pl-out', 'pl-fail', 'pl-go');
    root.classList.add('pl-hold');
    root.style.display = '';
    barEl.style.width = '0%';
    msgEl.textContent = '';
    raf = requestAnimationFrame(frame);
  };

  API.task = function () {
    if (!active || finishing) return function () {};
    total++; pending++;
    var settled = false;
    return function () {
      if (settled) return;
      settled = true; pending--; done++;
    };
  };

  API.appReady = function () { st.app = true; };

  API.hide = function () { forced = true; };

  API.fail = function (text) {
    if (!active || failed) return;
    cancelAnimationFrame(raf);
    for (var i = 0; i < timers.length; i++) clearTimeout(timers[i]);
    timers = [];
    failed = true;
    if (!shownAt) reveal();
    root.classList.add('pl-fail');
    msgEl.textContent = text || 'The oven’s cold. We couldn’t load the menu.';
    timers.push(setTimeout(function () {
      if (active && failed) end(false);
    }, Math.max(0, run.maxMs - (performance.now() - startedAt))));
  };

  retryEl.addEventListener('click', function () {
    if (typeof API.onRetry === 'function') API.onRetry();
    else location.reload();
  });

  window.addEventListener('pageshow', function (event) {
    if (event.persisted) {
      cancelAnimationFrame(raf);
      active = false;
      root.style.display = 'none';
      document.documentElement.style.overflow = '';
    }
  });

  window.PastryLoader = API;
  API.show();
})();
