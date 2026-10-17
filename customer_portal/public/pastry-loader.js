/*!
 * Pastry Project - cake loader
 * Shows a cake that gets eaten while the page loads (on every full load/refresh,
 * and stays up as long as the page is still loading). Self-contained: injects its own CSS + HTML.
 *
 * Usage: include this script early in <head> of index.html.
 *
 * Optional (SPA / waiting for API data):
 *   window.PASTRY_LOADER_MANUAL = true;   // set BEFORE the script tag, disables auto-hide on window "load"
 *   PastryLoader.hide();                  // call when your data/app is ready
 *   PastryLoader.show();                  // call to show it again (e.g. slow route change)
 */
(function () {
  if (window.PastryLoader) return;

  var CFG = { minMs: 1600, maxMs: 20000, auto: !window.PASTRY_LOADER_MANUAL };
  var NS = 'http://www.w3.org/2000/svg';
  var L = 60, W = 280;
  var STEPS = [
    [0, 'Slicing the first piece…'],
    [25, 'Mmm, so good…'],
    [50, 'Halfway there…'],
    [78, 'Just a few crumbs left…'],
    [100, 'All gone! Your page is ready.']
  ];

  var css = [
    '#pl-root{position:fixed;inset:0;z-index:2147483000;background:#fdf9f4;display:flex;align-items:center;justify-content:center;',
    'opacity:1;transition:opacity .45s ease;font-family:"DM Sans",system-ui,sans-serif;color:#1f1a17;',
    'padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px);box-sizing:border-box}',
    '#pl-root.pl-out{opacity:0;pointer-events:none}',
    '#pl-root .pl-box{width:100%;max-width:440px;padding:24px;text-align:center;box-sizing:border-box}',
    '#pl-root .pl-brand{font-family:"Playfair Display",Georgia,serif;font-style:italic;font-weight:700;font-size:clamp(34px,9vw,44px);line-height:1;margin:0}',
    '#pl-root .pl-brand span{color:#c4a032}',
    '#pl-root .pl-tag{font-size:11px;letter-spacing:.32em;color:#8d857e;margin:8px 0 18px;text-transform:uppercase}',
    '#pl-root svg{width:100%;height:auto;display:block;overflow:visible}',
    '#pl-root .pl-pct{font-family:"Playfair Display",Georgia,serif;font-weight:700;font-size:clamp(44px,12vw,60px);line-height:1;margin:6px 0 8px;font-variant-numeric:tabular-nums}',
    '#pl-root .pl-msg{color:#8d857e;font-size:16px;min-height:1.6em;margin:0}',
    '#pl-root .pl-crumb{animation:pl-fall .8s ease-in forwards}',
    '@keyframes pl-fall{to{transform:translateY(70px);opacity:0}}',
    '@media (prefers-reduced-motion:reduce){#pl-root .pl-crumb{display:none}#pl-root{transition:none}}'
  ].join('');

  var style = document.createElement('style');
  style.textContent = css;
  (document.head || document.documentElement).appendChild(style);

  var font = document.createElement('link');
  font.rel = 'stylesheet';
  font.href = 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Playfair+Display:ital,wght@0,700;1,700&display=swap';
  (document.head || document.documentElement).appendChild(font);

  var root = document.createElement('div');
  root.id = 'pl-root';
  root.setAttribute('role', 'status');
  root.setAttribute('aria-label', 'Loading');
  root.innerHTML =
    '<div class="pl-box">' +
    '<p class="pl-brand">Pastry <span>Project</span></p>' +
    '<p class="pl-tag">Baked fresh daily</p>' +
    '<svg viewBox="0 0 400 290" aria-hidden="true">' +
    '<defs>' +
    '<clipPath id="pl-shape"><rect x="60" y="120" width="280" height="120" rx="16"/></clipPath>' +
    '<mask id="pl-eat" maskUnits="userSpaceOnUse" x="0" y="0" width="400" height="290">' +
    '<rect width="400" height="290" fill="#fff"/>' +
    '<g id="pl-bites" fill="#000"><rect id="pl-bx" x="0" y="0" width="60" height="290"/></g>' +
    '</mask></defs>' +
    '<ellipse cx="200" cy="250" rx="175" ry="26" fill="#ecdfd1"/>' +
    '<ellipse cx="200" cy="244" rx="170" ry="24" fill="#fff" stroke="#efe3d6"/>' +
    '<ellipse cx="200" cy="241" rx="130" ry="15" fill="none" stroke="#efe3d6" stroke-width="2"/>' +
    '<g mask="url(#pl-eat)">' +
    '<g clip-path="url(#pl-shape)">' +
    '<rect x="60" y="120" width="280" height="120" fill="#8a5a36"/>' +
    '<rect x="60" y="178" width="280" height="12" fill="#fff3da"/>' +
    '<rect x="60" y="208" width="280" height="10" fill="#fff3da"/>' +
    '<rect x="60" y="120" width="280" height="30" fill="#3f2415"/>' +
    '<path d="M60 150h280v6c-14 0-14 20-28 20s-14-20-28-20-14 26-28 26-14-26-28-26-14 18-28 18-14-18-28-18-14 26-28 26-14-26-28-26-14 20-28 20z" fill="#3f2415"/>' +
    '<g fill="#c4a032"><circle cx="96" cy="168" r="3"/><circle cx="152" cy="176" r="3"/><circle cx="208" cy="164" r="3"/><circle cx="264" cy="176" r="3"/><circle cx="312" cy="168" r="3"/></g>' +
    '<g fill="#6f4526" opacity=".6"><circle cx="90" cy="198" r="3"/><circle cx="160" cy="228" r="3"/><circle cx="230" cy="198" r="3"/><circle cx="300" cy="228" r="3"/></g>' +
    '</g>' +
    '<g fill="#3f2415"><circle cx="100" cy="114" r="15"/><circle cx="150" cy="108" r="17"/><circle cx="200" cy="105" r="18"/><circle cx="250" cy="108" r="17"/><circle cx="300" cy="114" r="15"/></g>' +
    '<g fill="#c4a032"><circle cx="95" cy="109" r="3"/><circle cx="144" cy="102" r="3.5"/><circle cx="194" cy="99" r="3.5"/><circle cx="244" cy="102" r="3.5"/><circle cx="295" cy="109" r="3"/></g>' +
    '</g>' +
    '<g id="pl-crumbs"></g>' +
    '</svg>' +
    '<div class="pl-pct">0%</div>' +
    '<p class="pl-msg">' + STEPS[0][1] + '</p>' +
    '</div>';
  document.documentElement.appendChild(root);

  var bites = root.querySelector('#pl-bites');
  var bx = root.querySelector('#pl-bx');
  var crumbs = root.querySelector('#pl-crumbs');
  var pctEl = root.querySelector('.pl-pct');
  var msgEl = root.querySelector('.pl-msg');
  var circles = [];
  for (var i = 0; i < 12; i++) {
    var c = document.createElementNS(NS, 'circle');
    c.setAttribute('cy', 84 + i * 13);
    c.setAttribute('r', i % 2 ? 15 : 19);
    bites.appendChild(c);
    circles.push(c);
  }

  var p = 0, t0 = 0, last = 0, raf = 0, lastCrumb = 0;
  var ready = false, finishing = false, timers = [];

  function render() {
    var edge = L + (p / 100) * (W + 24);
    bx.setAttribute('width', Math.max(0, edge));
    for (var i = 0; i < circles.length; i++) {
      circles[i].setAttribute('cx', edge + (i % 2 ? -3 : 5));
    }
    var r = Math.round(p);
    pctEl.textContent = r + '%';
    var t = STEPS[0][1];
    for (var j = 0; j < STEPS.length; j++) if (r >= STEPS[j][0]) t = STEPS[j][1];
    if (msgEl.textContent !== t) msgEl.textContent = t;
  }

  function crumb(edge) {
    var c = document.createElementNS(NS, 'circle');
    c.setAttribute('class', 'pl-crumb');
    c.setAttribute('cx', edge + Math.random() * 14 - 4);
    c.setAttribute('cy', 170 + Math.random() * 60);
    c.setAttribute('r', 2 + Math.random() * 2);
    c.setAttribute('fill', Math.random() > 0.5 ? '#8a5a36' : '#c4a032');
    crumbs.appendChild(c);
    setTimeout(function () { if (c.parentNode) c.parentNode.removeChild(c); }, 850);
  }

  function finish() {
    timers.push(setTimeout(function () {
      root.classList.add('pl-out');
      document.documentElement.style.overflow = '';
      timers.push(setTimeout(function () { root.style.display = 'none'; }, 500));
    }, 450));
  }

  function frame(ts) {
    if (!t0) { t0 = ts; last = ts; }
    var dt = Math.min(0.1, (ts - last) / 1000);
    last = ts;
    var el = ts - t0;
    if (!finishing) {
      // Creeps forward while loading; never reaches 100 until the page is really ready.
      var goal = 70 * (1 - Math.exp(-el / 900)) + 22 * (1 - Math.exp(-el / 12000));
      if (goal > p) p = goal;
      if ((ready && el >= CFG.minMs) || el >= CFG.maxMs) finishing = true;
    } else {
      p = Math.min(100, p + dt * 130);
    }
    render();
    if (p < 100 && ts - lastCrumb > 140) {
      lastCrumb = ts;
      crumb(L + (p / 100) * (W + 24));
    }
    if (p >= 100) { finish(); return; }
    raf = requestAnimationFrame(frame);
  }

  function show() {
    for (var i = 0; i < timers.length; i++) clearTimeout(timers[i]);
    timers = [];
    cancelAnimationFrame(raf);
    p = 0; t0 = 0; last = 0; ready = false; finishing = false;
    crumbs.innerHTML = '';
    root.style.display = '';
    root.classList.remove('pl-out');
    document.documentElement.style.overflow = 'hidden';
    render();
    raf = requestAnimationFrame(frame);
  }

  function hide() { ready = true; }

  window.PastryLoader = { show: show, hide: hide };

  // Back/forward cache: the page is already loaded, don't show the loader again.
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) {
      cancelAnimationFrame(raf);
      root.style.display = 'none';
      document.documentElement.style.overflow = '';
    }
  });

  if (CFG.auto) {
    if (document.readyState === 'complete') hide();
    else window.addEventListener('load', hide);
  }

  show();
})();
