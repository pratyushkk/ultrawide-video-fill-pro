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

// 1. Static HTTP Server serving test lab, popup, options, and dist assets
const PORT = 8099;
const server = http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0];

  let filePath;
  if (urlPath === '/' || urlPath.startsWith('/watch')) {
    filePath = path.join(__dirname, 'test-page.html');
  } else if (urlPath.startsWith('/popup/')) {
    filePath = path.join(distDir, urlPath);
  } else if (urlPath.startsWith('/options/')) {
    filePath = path.join(distDir, urlPath);
  } else if (urlPath.startsWith('/assets/')) {
    filePath = path.join(distDir, urlPath);
  } else if (urlPath.startsWith('/icons/')) {
    filePath = path.join(distDir, urlPath);
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
console.log(`[E2E] Server running at http://localhost:${PORT}`);

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
  console.log('[E2E] Launching Chrome...');
  browser = await puppeteer.launch({
    headless: false,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--window-size=1280,820', '--no-first-run', '--disable-default-apps'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  page.on('console', (msg) => {
    const text = msg.text();
    if (text.includes('[UWVF]')) {
      console.log(`    [EXT LOG]: ${text}`);
    }
  });

  // =========================================================================
  // STEP 1: Navigate to Test Lab
  // =========================================================================
  console.log('\n[E2E] Step 1: Navigating to Ultrawide Video Test Lab...');
  await page.goto(`http://localhost:${PORT}/watch?v=test_ultrawide_16_9`, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 800));

  // Inject content script directly into the page
  const contentScriptCode = fs.readFileSync(path.join(distDir, 'content.js'), 'utf-8');
  await page.evaluate((code) => {
    // Mock chrome extension storage & runtime API if running in standalone test page
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
          get: (keys, cb) => cb({ globalSettings: {}, siteSettings: {} }),
          set: (obj, cb) => cb && cb(),
        },
      };
    }

    const script = document.createElement('script');
    script.textContent = code;
    document.head.appendChild(script);
  }, contentScriptCode);

  await new Promise((r) => setTimeout(r, 600));

  await page.screenshot({ path: path.join(screenshotsDir, '01_initial_detected.png') });
  console.log('  -> Screenshot saved: 01_initial_detected.png');

  // Helper for test bridge
  async function sendMsg(type, payload) {
    return page.evaluate((msgType, msgPayload) => {
      return new Promise((resolve, reject) => {
        const id = Math.random().toString(36).substring(7);
        const timer = setTimeout(() => {
          window.removeEventListener('message', onMsg);
          reject(new Error(`Timeout waiting for ${msgType}`));
        }, 3000);

        function onMsg(e) {
          if (e.data && e.data.__uwvf_test_res && e.data.id === id) {
            clearTimeout(timer);
            window.removeEventListener('message', onMsg);
            resolve(e.data.result);
          }
        }
        window.addEventListener('message', onMsg);
        window.postMessage({ __uwvf_test_req: true, id, type: msgType, payload: msgPayload }, '*');
      });
    }, type, payload);
  }

  // =========================================================================
  // STEP 2: Verify Video Detection
  // =========================================================================
  console.log('\n[E2E] Step 2: Testing Video Detection...');
  const initStatus = await sendMsg('GET_VIDEO_STATUS');
  assert('Video element detected', initStatus.detected === true, `detected: ${initStatus.detected}`);
  assert('Video count is 1', initStatus.videoCount === 1, `count: ${initStatus.videoCount}`);
  assert('Initial scale is 1.0 (untransformed)', initStatus.currentScale === 1, `currentScale: ${initStatus.currentScale}`);
  assert('isTransformed is false initially', initStatus.isTransformed === false);
  assert('Target container width identified', initStatus.containerWidth >= 840, `containerWidth: ${initStatus.containerWidth}`);

  // =========================================================================
  // STEP 3: ZOOM TO FILL
  // =========================================================================
  console.log('\n[E2E] Step 3: Triggering ZOOM TO FILL...');
  const zoomStatus = await sendMsg('ZOOM_TO_FILL');

  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: path.join(screenshotsDir, '02_zoomed_to_fill.png') });
  console.log('  -> Screenshot saved: 02_zoomed_to_fill.png');

  assert('Video marked as transformed', zoomStatus.isTransformed === true);
  assert('Calculated scale > 1.0 to fill 21:9 container', zoomStatus.currentScale > 1.0, `scale: ${zoomStatus.currentScale.toFixed(4)}x`);
  assert('autoFillScale matches expected ratio (840/640 = 1.3125)', Math.abs(zoomStatus.autoFillScale - 1.3125) < 0.05, `autoFillScale: ${zoomStatus.autoFillScale.toFixed(4)}`);

  // Verify CSS transform on DOM
  const domStyles = await page.evaluate(() => {
    const v = document.getElementById('test-video');
    const container = document.getElementById('main-player');
    return {
      videoTransform: v?.style.transform,
      videoClass: v?.className,
      containerOverflow: container?.style.overflow,
      containerClass: container?.className,
    };
  });

  assert('Video element has uwvf-active class', domStyles.videoClass.includes('uwvf-active'));
  assert('Video element has CSS scale transform applied', domStyles.videoTransform.includes('scale('), `transform: ${domStyles.videoTransform}`);
  assert('Container has uwvf-container class', domStyles.containerClass.includes('uwvf-container'));
  assert('Container has overflow: hidden to clip black bars', domStyles.containerOverflow === 'hidden');

  // =========================================================================
  // STEP 4: Slider Adjustment (Move Left: Less Crop)
  // =========================================================================
  console.log('\n[E2E] Step 4: Testing Slider Adjustment (Move Left: -15%)...');
  const sliderLessStatus = await sendMsg('SET_ADJUSTMENT', { adjustment: -15 });

  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: path.join(screenshotsDir, '03_slider_less_crop.png') });
  console.log('  -> Screenshot saved: 03_slider_less_crop.png');

  assert('Scale decreased after negative adjustment', sliderLessStatus.currentScale < zoomStatus.currentScale, `now: ${sliderLessStatus.currentScale.toFixed(4)} < was: ${zoomStatus.currentScale.toFixed(4)}`);
  assert('Adjustment stored as -15', sliderLessStatus.adjustment === -15);

  // =========================================================================
  // STEP 5: Slider Adjustment (Move Right: More Crop)
  // =========================================================================
  console.log('\n[E2E] Step 5: Testing Slider Adjustment (Move Right: +20%)...');
  const sliderMoreStatus = await sendMsg('SET_ADJUSTMENT', { adjustment: 20 });

  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: path.join(screenshotsDir, '04_slider_more_crop.png') });
  console.log('  -> Screenshot saved: 04_slider_more_crop.png');

  assert('Scale increased after positive adjustment', sliderMoreStatus.currentScale > zoomStatus.currentScale, `now: ${sliderMoreStatus.currentScale.toFixed(4)} > was: ${zoomStatus.currentScale.toFixed(4)}`);
  assert('Adjustment stored as 20', sliderMoreStatus.adjustment === 20);

  // =========================================================================
  // STEP 6: RESET
  // =========================================================================
  console.log('\n[E2E] Step 6: Testing RESET...');
  const resetStatus = await sendMsg('RESET');

  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: path.join(screenshotsDir, '05_reset_restored.png') });
  console.log('  -> Screenshot saved: 05_reset_restored.png');

  assert('isTransformed is false after reset', resetStatus.isTransformed === false);
  assert('Current scale restored to 1.0', resetStatus.currentScale === 1);

  const resetDom = await page.evaluate(() => {
    const v = document.getElementById('test-video');
    const container = document.getElementById('main-player');
    return {
      videoTransform: v?.style.transform,
      hasClass: v?.classList.contains('uwvf-active'),
      containerClass: container?.classList.contains('uwvf-container'),
    };
  });

  assert('Video transform cleared from inline style', resetDom.videoTransform === '');
  assert('uwvf-active class removed from video', resetDom.hasClass === false);
  assert('uwvf-container class removed from container', resetDom.containerClass === false);

  // =========================================================================
  // STEP 7: Cinema Crop
  // =========================================================================
  console.log('\n[E2E] Step 7: Testing Cinema Crop Feature...');
  await sendMsg('ZOOM_TO_FILL');
  const cinemaStatus = await sendMsg('SET_ADVANCED', { cinemaCrop: 'high' });

  assert('Cinema crop multiplier applied additional zoom', cinemaStatus.currentScale > zoomStatus.currentScale, `scale: ${cinemaStatus.currentScale.toFixed(4)}`);

  // Reset cinema crop & transform
  await sendMsg('SET_ADVANCED', { cinemaCrop: 'off' });
  await sendMsg('RESET');

  // =========================================================================
  // STEP 8: Window Resize / Layout Change Handling
  // =========================================================================
  console.log('\n[E2E] Step 8: Testing Dynamic Resize / Recalculation...');
  await sendMsg('SET_ADJUSTMENT', { adjustment: 0 });
  await sendMsg('ZOOM_TO_FILL');
  const preResizeScale = (await sendMsg('GET_VIDEO_STATUS')).currentScale;

  // Change container size dynamically
  await page.evaluate(() => {
    const player = document.getElementById('main-player');
    player.style.width = '1000px'; // Wider container
    window.dispatchEvent(new Event('resize'));
  });

  // Allow ResizeObserver debounce (150ms) to trigger
  await new Promise((r) => setTimeout(r, 400));

  const postResizeScale = (await sendMsg('GET_VIDEO_STATUS')).currentScale;
  assert('Scale recalculated automatically on container resize', postResizeScale > preResizeScale, `new scale: ${postResizeScale.toFixed(4)} > old scale: ${preResizeScale.toFixed(4)}`);

  // Restore container size
  await page.evaluate(() => {
    const player = document.getElementById('main-player');
    player.style.width = '840px';
  });
  await new Promise((r) => setTimeout(r, 400));

  // =========================================================================
  // STEP 9: Multiple Videos Detection & Video Selection
  // =========================================================================
  console.log('\n[E2E] Step 9: Testing Multiple Videos Detection & Selector...');
  await page.click('#btn-toggle-second');
  await new Promise((r) => setTimeout(r, 600));

  const multiStatus = await sendMsg('GET_VIDEO_STATUS');
  await page.screenshot({ path: path.join(screenshotsDir, '06_multiple_videos.png') });
  console.log('  -> Screenshot saved: 06_multiple_videos.png');

  assert('Both video elements detected in DOM', multiStatus.videoCount === 2, `count: ${multiStatus.videoCount}`);

  // Select video 2 (index 1)
  const selectStatus = await sendMsg('SELECT_VIDEO', { index: 1 });
  assert('Active video changed to index 1', selectStatus.activeVideoIndex === 1, `active index: ${selectStatus.activeVideoIndex}`);

  // Switch back to video 1
  await sendMsg('SELECT_VIDEO', { index: 0 });

  // =========================================================================
  // STEP 10: SPA Navigation Simulation
  // =========================================================================
  console.log('\n[E2E] Step 10: Testing SPA Navigation (yt-navigate-finish)...');
  await page.click('#btn-simulate-spa');
  await new Promise((r) => setTimeout(r, 500));

  const spaStatus = await sendMsg('GET_VIDEO_STATUS');
  assert('Video detection persists across SPA navigation', spaStatus.detected === true);

  // =========================================================================
  // STEP 11: Video Element Replacement (DOM Recreation)
  // =========================================================================
  console.log('\n[E2E] Step 11: Testing Video Element Replacement...');
  await page.click('#btn-replace-video');
  await new Promise((r) => setTimeout(r, 500));

  const replacedStatus = await sendMsg('GET_VIDEO_STATUS');
  assert('New video element detected after DOM replacement', replacedStatus.detected === true);

  // =========================================================================
  // STEP 12: Extension Popup UI Verification
  // =========================================================================
  console.log('\n[E2E] Step 12: Testing Extension Popup Page UI...');
  const popupPage = await browser.newPage();
  await popupPage.setViewport({ width: 380, height: 600 });

  // Provide mock chrome API BEFORE document loads so React mounts flawlessly!
  await popupPage.evaluateOnNewDocument(() => {
    let currentAdj = 0;
    let autoFillVal = true;
    let advSettings = {
      posX: 0,
      posY: 0,
      rotation: 0,
      mirrorH: false,
      mirrorV: false,
      cinemaCrop: 'off',
    };
    let activeIdx = 0;

    window.chrome = {
      runtime: {
        lastError: null,
        openOptionsPage: () => {},
        sendMessage: (msg, cb) => cb && cb({ success: true }),
      },
      tabs: {
        query: (opts, cb) => cb([{ id: 1, url: 'https://www.youtube.com/watch?v=demo' }]),
        sendMessage: (tabId, msg, cb) => {
          if (msg.type === 'SET_ADJUSTMENT') {
            currentAdj = msg.payload?.adjustment ?? currentAdj;
          }
          if (msg.type === 'TOGGLE_AUTO_FILL') {
            autoFillVal = msg.payload?.enabled ?? autoFillVal;
          }
          if (msg.type === 'SET_ADVANCED') {
            advSettings = { ...advSettings, ...msg.payload };
          }
          if (msg.type === 'SELECT_VIDEO') {
            activeIdx = msg.payload?.index ?? activeIdx;
          }
          if (msg.type === 'RESET') {
            currentAdj = 0;
          }

          if (cb) {
            cb({
              detected: true,
              videoCount: 2,
              activeVideoIndex: activeIdx,
              isTransformed: true,
              currentScale: 1.34 * (1 + currentAdj / 100),
              autoFillScale: 1.34,
              adjustment: currentAdj,
              containerWidth: 840,
              containerHeight: 360,
              isFullscreen: false,
              autoFillEnabled: autoFillVal,
              ...advSettings,
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
  await new Promise((r) => setTimeout(r, 800));

  await popupPage.screenshot({ path: path.join(screenshotsDir, '07_popup_ui.png') });
  console.log('  -> Screenshot saved: 07_popup_ui.png');

  const popupActiveControls = await popupPage.evaluate(() => {
    return {
      title: document.querySelector('.brand-title')?.textContent,
      hasGearIcon: !!document.querySelector('.settings-icon-btn'),
      bodyWidth: document.body.clientWidth,
      hasZoomRow: !!document.querySelector('.zoom-row'),
      zoomTitleText: document.querySelector('.zoom-title')?.textContent?.trim(),
      hasSlider: !!document.querySelector('.premium-slider'),
      hasSublabels: !!document.querySelector('.slider-sublabels'),
      hasPresets: !!document.querySelector('.preset-trigger-row'),
      hasToggle: !!document.querySelector('.large-toggle'),
    };
  });

  assert('Popup title renders "UltraWide"', popupActiveControls.title === 'UltraWide');
  assert('Settings gear button exists', popupActiveControls.hasGearIcon === true);
  assert('Popup width is exactly 380px', popupActiveControls.bodyWidth === 380, `width: ${popupActiveControls.bodyWidth}px`);
  assert('Zoom to Fill control row is visible', popupActiveControls.hasZoomRow && popupActiveControls.zoomTitleText === 'Zoom to Fill');
  assert('Crop / Zoom slider is rendered', popupActiveControls.hasSlider === true);
  assert('Slider sublabels rendered', popupActiveControls.hasSublabels === true);
  assert('Zoom to Fill modern toggle switch rendered', popupActiveControls.hasToggle === true);
  assert('Compact Presets dropdown row rendered', popupActiveControls.hasPresets === true);

  // Step 13: Interacting with compact popup controls
  console.log('\n[E2E] Step 13: Verifying Compact Presets in Popup...');
  await popupPage.click('.preset-trigger-row');
  await new Promise((r) => setTimeout(r, 400));

  await popupPage.screenshot({ path: path.join(screenshotsDir, '09_popup_advanced_expanded.png') });
  console.log('  -> Screenshot saved: 09_popup_advanced_expanded.png');

  const presetControls = await popupPage.evaluate(() => {
    const menu = document.querySelector('.preset-menu');
    return {
      hasMenu: !!menu,
      itemCount: menu ? menu.querySelectorAll('.preset-menu-item').length : 0,
    };
  });

  assert('Preset dropdown menu opened smoothly', presetControls.hasMenu === true);
  assert('Preset options rendered (Original, Cinematic, Crisp, HDR)', presetControls.itemCount === 4);

  await popupPage.close();

  // =========================================================================
  // STEP 14: Options Page UI Verification
  // =========================================================================
  console.log('\n[E2E] Step 14: Testing Options Page UI...');
  const optionsPage = await browser.newPage();
  await optionsPage.setViewport({ width: 780, height: 750 });

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
            },
            siteSettings: {
              'youtube.com': {
                hostname: 'youtube.com',
                enabled: true,
                settings: { autoFill: true },
              },
            },
          }),
          set: (data, cb) => cb && cb(),
        },
      },
    };
  });

  await optionsPage.goto(`http://localhost:${PORT}/options/index.html`, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 600));

  await optionsPage.screenshot({ path: path.join(screenshotsDir, '09_options_page.png') });
  console.log('  -> Screenshot saved: 09_options_page.png');

  const optionsData = await optionsPage.evaluate(() => {
    return {
      title: document.querySelector('h1')?.textContent,
      sections: Array.from(document.querySelectorAll('section h2')).map((h) => h.textContent),
      hasShortcuts: document.body.textContent.includes('Alt + Shift + F'),
      hasResetAll: !!document.querySelector('.btn-danger'),
    };
  });

  assert('Options page header renders "UltraWide Video Fill"', optionsData.title === 'UltraWide Video Fill');
  assert('General, Shortcuts, Site Settings, Danger Zone sections present', optionsData.sections.includes('General') && optionsData.sections.includes('Keyboard Shortcuts') && optionsData.sections.includes('Site Settings') && optionsData.sections.includes('Danger Zone'));
  assert('Keyboard shortcuts documented (Alt+Shift+F)', optionsData.hasShortcuts === true);
  assert('Danger zone reset all button present', optionsData.hasResetAll === true);

  await optionsPage.close();

  // =========================================================================
  // TEST SUMMARY
  // =========================================================================
  console.log('\n========================================================');
  console.log('          CHROME EXTENSION E2E TEST SUMMARY             ');
  console.log('========================================================');
  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  console.log(`Total assertions: ${results.length}`);
  console.log(`Passed:           ${passed}`);
  console.log(`Failed:           ${failed}`);
  console.log('Screenshots generated in: tests/e2e/screenshots/');
  console.log('========================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('🎉 ALL 26 END-TO-END VERIFICATION CHECKS PASSED!');
  }
} catch (err) {
  console.error('[E2E] Test run failed with error:', err);
  process.exit(1);
} finally {
  if (browser) await browser.close();
  server.close();
}
