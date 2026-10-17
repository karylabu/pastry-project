const fs = require('fs');
const path = require('path');

const loaderSource = fs.readFileSync(
  path.resolve(__dirname, '../public/pastry-loader.js'),
  'utf8'
);

describe('PastryLoader', () => {
  let originalReadyState;
  let originalRequestAnimationFrame;
  let originalCancelAnimationFrame;

  beforeEach(() => {
    originalReadyState = Object.getOwnPropertyDescriptor(document, 'readyState');
    originalRequestAnimationFrame = window.requestAnimationFrame;
    originalCancelAnimationFrame = window.cancelAnimationFrame;
    Object.defineProperty(document, 'readyState', { configurable: true, value: 'complete' });
  });

  afterEach(() => {
    document.getElementById('pl-root')?.remove();
    document.querySelectorAll('style').forEach((style) => {
      if (style.textContent.includes('#pl-root')) style.remove();
    });
    delete window.PastryLoader;
    delete window.PASTRY_LOADER_CONFIG;
    if (originalReadyState) Object.defineProperty(document, 'readyState', originalReadyState);
    window.requestAnimationFrame = originalRequestAnimationFrame;
    window.cancelAnimationFrame = originalCancelAnimationFrame;
    document.documentElement.style.overflow = '';
    window.history.pushState({}, '', '/');
  });

  function startLoader(pathname) {
    let nextFrame;
    window.history.pushState({}, '', pathname);
    window.requestAnimationFrame = jest.fn((callback) => {
      nextFrame = callback;
      return 1;
    });
    window.cancelAnimationFrame = jest.fn();
    window.eval(loaderSource);
    window.PastryLoader.appReady();
    return () => nextFrame;
  }

  it('shows the logo loader on admin pages even when the app is ready immediately', () => {
    const getNextFrame = startLoader('/admin/login');

    getNextFrame()(1000);

    expect(document.getElementById('pl-root')).toHaveClass('pl-go');
    expect(document.getElementById('pl-root')).not.toHaveStyle({ display: 'none' });
  });

  it('keeps the fast-load shortcut on customer pages', () => {
    const getNextFrame = startLoader('/customer/');

    getNextFrame()(1000);
    getNextFrame()(1400);

    expect(document.getElementById('pl-root')).toHaveStyle({ display: 'none' });
  });
});
