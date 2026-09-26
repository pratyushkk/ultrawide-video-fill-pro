import puppeteer from 'puppeteer';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');
const distDir = path.resolve(rootDir, 'dist');
const screenshotsDir = path.resolve(__dirname, 'screenshots');

if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

const PORT = 8098;
const server = http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0];

  let filePath;
  if (urlPath === '/' || urlPath.startsWith('/watch')) {
    filePath = path.join(__dirname, 'test-page.html');
  } else {
    filePath = path.join(distDir, urlPath);
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    let contentType = 'text/plain';
    if (ext === '.html') contentType = 'text/html';
    else if (ext === '.js') contentType = 'application/javascript';
    else if (ext === '.css') contentType = 'text/css';
    else if (ext === '.png') contentType = 'image/png';
    else if (ext === '.json') contentType = 'application/json';

    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

await new Promise((resolve) => server.listen(PORT, resolve));
console.log(`[E2E-GPU] Server running at http://localhost:${PORT}`);

const results = [];
function assert(name, condition, details = '') {
  if (condition) {
    console.log(`  ✓ PASS: ${name} ${details ? `(${details})` : ''}`);
    results.push({ name, pass: true, details });
  } else {
    console.error(`  ✗ FAIL: ${name} ${details ? `(${details})` : ''}`);
    results.push({ name, pass: false, details });
  }
}

let browser = null;

try {
  console.log('[E2E-GPU] Launching Chrome with GPU flags...');
  browser = await puppeteer.launch({
    headless: false,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: [
      '--window-size=1280,820',
      '--no-first-run',
      '--disable-default-apps',
      '--enable-unsafe-webgpu',
      '--use-gl=angle',
      '--use-angle=d3d11',
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  page.on('console', (msg) => {
    const text = msg.text();
    if (text.includes('[UWVF]') || text.includes('[UWVF-GPU]')) {
      console.log(`    [LOG]: ${text}`);
    }
  });

  // 1. Navigate to test page
  console.log('\n[E2E-GPU] 1. Navigating to Ultrawide Video Test Lab...');
  await page.goto(`http://localhost:${PORT}/watch?v=test_ultrawide_16_9`, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 600));

  // 2. Inject content script
  console.log('[E2E-GPU] 2. Injecting compiled content script with GPU pipeline...');
  const contentScriptCode = fs.readFileSync(path.join(distDir, 'content.js'), 'utf-8');
  await page.evaluate((code) => {
    if (!window.chrome) window.chrome = {};
    if (!window.chrome.runtime) {
      window.chrome.runtime = {
        onMessage: { addListener: () => {} },
        sendMessage: () => {},
      };
    }
    if (!window.chrome.storage) {
      window.chrome.storage = {
        local: {
          get: (keys, cb) => cb({}),
          set: (obj, cb) => cb && cb(),
        },
      };
    }
    const script = document.createElement('script');
    script.textContent = code;
    document.documentElement.appendChild(script);
  }, contentScriptCode);

  await new Promise((r) => setTimeout(r, 500));

  // Helper function to send messages to content script via test bridge
  const sendTestMessage = async (type, payload = {}) => {
    return await page.evaluate(
      ({ type, payload }) => {
        return new Promise((resolve) => {
          const id = Math.random().toString(36).substring(7);
          const handler = (event) => {
            if (event.data && event.data.__uwvf_test_res && event.data.id === id) {
              window.removeEventListener('message', handler);
              resolve(event.data.result);
            }
          };
          window.addEventListener('message', handler);
          window.postMessage({ __uwvf_test_req: true, id, type, payload }, '*');
        });
      },
      { type, payload }
    );
  };

  // 3. Test Initial Status (Zero GPU overhead / Bypassed)
  console.log('\n[E2E-GPU] 3. Testing Initial Status & Zero-Overhead Bypass...');
  const initialStatus = await sendTestMessage('GET_VIDEO_STATUS');
  assert('Video detected', initialStatus?.detected === true);
  assert('Initial Sharpness is 0', initialStatus?.sharpness === 0, `sharpness=${initialStatus?.sharpness}`);
  assert('Initial HDR Boost is 0', initialStatus?.hdrBoost === 0, `hdrBoost=${initialStatus?.hdrBoost}`);
  assert('GPU backend initially bypassed', initialStatus?.gpuBackend === 'bypassed', `backend=${initialStatus?.gpuBackend}`);

  const canvasInitialState = await page.evaluate(() => {
    const canvas = document.querySelector('.uwvf-gpu-canvas');
    const video = document.querySelector('video');
    return {
      canvasExists: !!canvas,
      canvasDisplay: canvas ? window.getComputedStyle(canvas).display : null,
      videoOpacity: video ? window.getComputedStyle(video).opacity : null,
    };
  });
  assert('Canvas initially hidden or display none', canvasInitialState.canvasDisplay === 'none' || !canvasInitialState.canvasExists);
  assert('Video opacity normal when bypassed', canvasInitialState.videoOpacity === '1' || canvasInitialState.videoOpacity === '');

  // 4. Test Activating Sharpness (>0)
  console.log('\n[E2E-GPU] 4. Testing Sharpness Activation (Sharpness = 60)...');
  const sharpStatus = await sendTestMessage('SET_GPU_EFFECTS', { sharpness: 60, hdrBoost: 0 });
  await new Promise((r) => setTimeout(r, 300));

  assert('Sharpness updated to 60', sharpStatus?.sharpness === 60);
  assert('GPU backend active', sharpStatus?.gpuBackend === 'webgpu' || sharpStatus?.gpuBackend === 'webgl2', `backend=${sharpStatus?.gpuBackend}`);

  const canvasSharpState = await page.evaluate(() => {
    const canvas = document.querySelector('.uwvf-gpu-canvas');
    const video = document.querySelector('video');
    return {
      canvasExists: !!canvas,
      canvasDisplay: canvas ? window.getComputedStyle(canvas).display : null,
      canvasWidth: canvas ? canvas.width : 0,
      canvasHeight: canvas ? canvas.height : 0,
      videoOpacity: video ? window.getComputedStyle(video).opacity : null,
    };
  });
  assert('Video remains visible (opacity not 0) preventing DRM black screens', canvasSharpState.videoOpacity !== '0');

  await page.screenshot({ path: path.join(screenshotsDir, '10_gpu_sharpness_active.png') });

  // 5. Test Activating HDR Boost (>0)
  console.log('\n[E2E-GPU] 5. Testing HDR Boost Activation (HDR Boost = 70)...');
  const hdrStatus = await sendTestMessage('SET_GPU_EFFECTS', { sharpness: 60, hdrBoost: 70 });
  await new Promise((r) => setTimeout(r, 300));

  assert('HDR Boost updated to 70', hdrStatus?.hdrBoost === 70);
  assert('Both effects active in status', hdrStatus?.sharpness === 60 && hdrStatus?.hdrBoost === 70);

  // Check GPU diagnostics
  const diagnostics = await sendTestMessage('GET_GPU_DIAGNOSTICS');
  assert('Diagnostics returned valid object', !!diagnostics);
  assert('Diagnostics active passes equals 2', diagnostics?.activePasses === 2, `activePasses=${diagnostics?.activePasses}`);

  await page.screenshot({ path: path.join(screenshotsDir, '11_gpu_hdr_boost_active.png') });

  // 6. Test Zoom to Fill with GPU Canvas
  console.log('\n[E2E-GPU] 6. Testing Zoom to Fill with GPU Active...');
  const zoomStatus = await sendTestMessage('ZOOM_TO_FILL');
  await new Promise((r) => setTimeout(r, 400));

  assert('Video transformed with Zoom to Fill', zoomStatus?.isTransformed === true);
  assert('Current scale greater than 1.0', zoomStatus?.currentScale > 1.0, `scale=${zoomStatus?.currentScale}`);

  const transformSync = await page.evaluate(() => {
    const canvas = document.querySelector('.uwvf-gpu-canvas');
    const video = document.querySelector('video');
    return {
      canvasTransform: canvas?.style.transform,
      videoTransform: video?.style.transform,
      canvasWidth: canvas?.style.width,
      videoWidth: video?.clientWidth + 'px',
    };
  });
  assert('GPU canvas transform mirrors video transform', transformSync.canvasTransform === transformSync.videoTransform, `canvas=${transformSync.canvasTransform}`);
  await page.screenshot({ path: path.join(screenshotsDir, '12_gpu_zoomed_to_fill.png') });

  // 7. Test Bypass Restoration (Sharpness = 0, HDR = 0)
  console.log('\n[E2E-GPU] 7. Testing Resetting Effects back to 0 (Complete Bypass)...');
  const bypassStatus = await sendTestMessage('SET_GPU_EFFECTS', { sharpness: 0, hdrBoost: 0 });
  await new Promise((r) => setTimeout(r, 200));

  assert('Effects reset to 0 in status', bypassStatus?.sharpness === 0 && bypassStatus?.hdrBoost === 0);
  assert('GPU backend reports bypassed', bypassStatus?.gpuBackend === 'bypassed');

  const canvasBypassedState = await page.evaluate(() => {
    const canvas = document.querySelector('.uwvf-gpu-canvas');
    const video = document.querySelector('video');
    return {
      canvasDisplay: canvas ? window.getComputedStyle(canvas).display : null,
      videoOpacity: video ? window.getComputedStyle(video).opacity : null,
    };
  });
  assert('Canvas is hidden (display: none) when bypassed', canvasBypassedState.canvasDisplay === 'none');
  assert('Video opacity restored to normal', canvasBypassedState.videoOpacity === '1' || canvasBypassedState.videoOpacity === '');
  await page.screenshot({ path: path.join(screenshotsDir, '13_gpu_bypassed_restored.png') });

  // 8. Test Popup UI
  console.log('\n[E2E-GPU] 8. Testing Popup UI with GPU Enhancements...');
  const popupPage = await browser.newPage();
  await popupPage.setViewport({ width: 380, height: 600 });
  await popupPage.evaluateOnNewDocument(() => {
    window.chrome = {
      runtime: {
        openOptionsPage: () => {},
        lastError: null,
      },
      tabs: {
        query: (opts, cb) => cb([{ id: 1, url: 'https://www.youtube.com/watch?v=demo' }]),
        sendMessage: (tabId, msg, cb) => {
          if (cb) {
            cb({
              detected: true,
              videoCount: 1,
              activeVideoIndex: 0,
              isTransformed: false,
              currentScale: 1.0,
              autoFillScale: 1.34,
              adjustment: 0,
              containerWidth: 840,
              containerHeight: 360,
              isFullscreen: false,
              autoFillEnabled: false,
              sharpness: 25,
              hdrBoost: 40,
              gpuBackend: 'webgpu',
              gpuAvailable: true,
              gpuFps: 60,
              gpuFrameTimeMs: 1.45,
              gpuDroppedFrames: 0,
              gpuResolution: '1920x1080',
            });
          }
        },
      },
      storage: {
        local: {
          get: (keys, cb) => cb({ globalSettings: {}, siteSettings: {} }),
          set: (data, cb) => cb && cb(),
        },
      },
    };
  });

  await popupPage.goto(`http://localhost:${PORT}/popup/index.html`, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 600));

  const popupElements = await popupPage.evaluate(() => {
    const text = document.body.innerText;
    return {
      hasHeader: text.includes('UltraWide'),
      hasZoomRow: text.includes('Zoom to Fill'),
      hasCropZoom: text.includes('Crop / Zoom'),
      hasSharpness: text.includes('Sharpness'),
      hasHdrBoost: text.includes('HDR Boost'),
      hasPresets: text.includes('Presets'),
    };
  });

  assert('Popup contains UltraWide header', popupElements.hasHeader);
  assert('Popup contains Zoom to Fill row', popupElements.hasZoomRow);
  assert('Popup contains Crop / Zoom control', popupElements.hasCropZoom);
  assert('Popup contains Sharpness slider', popupElements.hasSharpness);
  assert('Popup contains HDR Boost slider', popupElements.hasHdrBoost);
  assert('Popup contains Presets dropdown', popupElements.hasPresets);

  await popupPage.screenshot({ path: path.join(screenshotsDir, '14_popup_gpu_ui.png') });
  await popupPage.close();

  // 9. Test Options UI
  console.log('\n[E2E-GPU] 9. Testing Options Page with GPU settings...');
  const optionsPage = await browser.newPage();
  await optionsPage.setViewport({ width: 800, height: 800 });
  await optionsPage.evaluateOnNewDocument(() => {
    window.chrome = {
      storage: {
        local: {
          get: (keys, cb) => cb({
            globalSettings: {
              autoFillDefault: false,
              defaultCinemaCrop: 'off',
              showAdvanced: false,
              keyboardShortcutsEnabled: true,
              smoothTransitions: true,
              transitionDuration: 200,
              defaultSharpness: 30,
              defaultHdrBoost: 50,
              gpuQualityPreference: 'balanced',
            },
            siteSettings: {}
          }),
          set: (data, cb) => cb && cb(),
          clear: (cb) => cb && cb(),
        },
      },
    };
  });

  await optionsPage.goto(`http://localhost:${PORT}/options/index.html`, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 600));

  const optionsElements = await optionsPage.evaluate(() => {
    const text = document.body.innerText;
    return {
      hasHeader: text.includes('UltraWide Video Fill'),
      hasGPUSection: text.includes('GPU Video Enhancement'),
      hasDefaultSharpness: text.includes('Default Sharpness'),
      hasDefaultHdrBoost: text.includes('Default HDR Boost'),
      hasQualityPref: text.includes('GPU Quality Preference'),
    };
  });

  assert('Options page contains GPU Video Enhancement section', optionsElements.hasGPUSection);
  assert('Options page contains Default Sharpness setting', optionsElements.hasDefaultSharpness);
  assert('Options page contains Default HDR Boost setting', optionsElements.hasDefaultHdrBoost);
  assert('Options page contains GPU Quality Preference dropdown', optionsElements.hasQualityPref);

  await optionsPage.screenshot({ path: path.join(screenshotsDir, '15_options_gpu_settings.png') });
  await optionsPage.close();

  // 10. Test DRM Streaming Platform Safe Mode (Hotstar / Prime Video)
  console.log('\n[E2E-GPU] 10. Testing DRM Streaming Platform Protection (Hotstar / Prime Video simulation)...');
  await page.evaluate(() => {
    const video = document.querySelector('video');
    // Simulate DRM mediaKeys presence as found on Hotstar / Prime Video / Netflix
    Object.defineProperty(video, 'mediaKeys', { value: {}, configurable: true });
  });

  const drmStatus = await sendTestMessage('SET_GPU_EFFECTS', { sharpness: 65, hdrBoost: 75 });
  await new Promise((r) => setTimeout(r, 400));

  const drmTestResult = await page.evaluate(() => {
    const video = document.querySelector('video');
    const canvas = document.querySelector('.uwvf-gpu-canvas');
    const filter = window.getComputedStyle(video).filter;
    const opacity = window.getComputedStyle(video).opacity;

    return {
      canvasDisplay: canvas ? window.getComputedStyle(canvas).display : null,
      videoFilter: filter,
      videoOpacity: opacity,
      hasSharpnessFilter: filter.includes('uwvf-sharpness-filter') || filter.includes('url'),
      hasContrast: filter.includes('contrast'),
      hasBrightness: filter.includes('brightness'),
      hasSaturate: filter.includes('saturate')
    };
  });
  console.log('  -> drmStatus:', drmStatus);
  console.log('  -> drmTestResult:', drmTestResult);

  assert('DRM video keeps canvas hidden (no black box overlay)', drmTestResult.canvasDisplay === 'none');
  assert('DRM video remains 100% visible (opacity normal, never 0)', drmTestResult.videoOpacity === '1' || drmTestResult.videoOpacity === '');
  assert('DRM video has hardware sharpness filter applied', drmTestResult.hasSharpnessFilter);
  assert('DRM video has HDR dynamic range contrast boost applied', drmTestResult.hasContrast);
  assert('DRM video has HDR dynamic range saturation boost applied', drmTestResult.hasSaturate);

  await page.screenshot({ path: path.join(screenshotsDir, '16_drm_safe_video_enhanced.png') });

  console.log('\n=======================================================');
  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  console.log(`[E2E-GPU] Test Suite Completed: ${passed} PASSED, ${failed} FAILED`);
  console.log('=======================================================\n');
} catch (err) {
  console.error('[E2E-GPU] Test error:', err);
} finally {
  if (browser) await browser.close();
  server.close();
}
