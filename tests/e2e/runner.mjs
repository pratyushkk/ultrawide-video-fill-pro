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

// 1. Start simple static HTTP server
const PORT = 8089;
const server = http.createServer((req, res) => {
  const filePath = path.join(__dirname, 'test-page.html');
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(data);
  });
});

await new Promise((resolve) => server.listen(PORT, resolve));
console.log(`[E2E] Test server listening on http://localhost:${PORT}`);

const results = [];
function assert(name, condition, details = '') {
  if (condition) {
    console.log(`  ✓ PASS: ${name} ${details}`);
    results.push({ name, pass: true, details });
  } else {
    console.error(`  ✗ FAIL: ${name} ${details}`);
    results.push({ name, pass: false, details });
  }
}

let browser = null;

try {
  console.log('[E2E] Launching Chrome with extension...');
  const extPath = 'C:\\Users\\PRATYUSH\\AppData\\Local\\Temp\\uwvf-dist';
  browser = await puppeteer.launch({
    headless: false,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    userDataDir: 'C:\\Users\\PRATYUSH\\AppData\\Local\\Temp\\uwvf-test-user-profile',
    ignoreDefaultArgs: ['--disable-extensions'],
    args: [
      `--disable-extensions-except=${extPath}`,
      `--load-extension=${extPath}`,
      '--no-first-run',
      '--disable-default-apps',
      '--window-size=1280,800',
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  page.on('console', (msg) => console.log(`[BROWSER CONSOLE] ${msg.type()}: ${msg.text()}`));
  page.on('pageerror', (err) => console.error('[BROWSER ERROR]', err));

  // Give extension background service worker time to initialize
  await new Promise((r) => setTimeout(r, 2000));

  // Find the extension ID from targets
  let extensionId = null;
  const targets = await browser.targets();
  for (const t of targets) {
    console.log(`[E2E Target] ${t.type()}: ${t.url()}`);
    if (t.url().startsWith('chrome-extension://')) {
      extensionId = t.url().split('/')[2];
      break;
    }
  }

  console.log(`[E2E] Extension ID detected: ${extensionId || 'unknown'}`);

  // Navigate to test page
  console.log('[E2E] Step 1: Navigating to test page...');
  await page.goto(`http://localhost:${PORT}/watch?v=initial_video`, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 1000));

  await page.screenshot({ path: path.join(screenshotsDir, '01_initial_detected.png') });
  console.log('  -> Screenshot saved: 01_initial_detected.png');

// Helper function to send messages to the content script via the test bridge
async function sendTestMessage(page, type, payload) {
  return page.evaluate((msgType, msgPayload) => {
    return new Promise((resolve, reject) => {
      const id = Math.random().toString(36).substring(7);
      const timeout = setTimeout(() => {
        window.removeEventListener('message', listener);
        reject(new Error(`Timeout waiting for response to ${msgType}`));
      }, 4000);

      function listener(event) {
        if (event.data && event.data.__uwvf_test_res && event.data.id === id) {
          clearTimeout(timeout);
          window.removeEventListener('message', listener);
          resolve(event.data.result);
        }
      }
      window.addEventListener('message', listener);
      window.postMessage({ __uwvf_test_req: true, id, type: msgType, payload: msgPayload }, '*');
    });
  }, type, payload);
}

  // Verify content script injection & video detection
  console.log('[E2E] Step 2: Testing Video Detection via content script...');
  const initialStatus = await sendTestMessage(page, 'GET_VIDEO_STATUS');

  assert('Video element detected', initialStatus?.detected === true, `detected: ${initialStatus?.detected}`);
  assert('Video count is 1', initialStatus?.videoCount === 1, `count: ${initialStatus?.videoCount}`);
  assert('Initial scale is 1', initialStatus?.currentScale === 1, `currentScale: ${initialStatus?.currentScale}`);
  assert('Not transformed initially', initialStatus?.isTransformed === false);

  // Step 3: Zoom to Fill
  console.log('[E2E] Step 3: Triggering ZOOM TO FILL...');
  const zoomStatus = await sendTestMessage(page, 'ZOOM_TO_FILL');

  await new Promise((r) => setTimeout(r, 500));
  await page.screenshot({ path: path.join(screenshotsDir, '02_zoomed_to_fill.png') });
  console.log('  -> Screenshot saved: 02_zoomed_to_fill.png');

  assert('Video marked as transformed', zoomStatus?.isTransformed === true);
  assert('Scale calculated greater than 1 (zoom in to fill pillarboxes)', zoomStatus?.currentScale > 1, `scale: ${zoomStatus?.currentScale}`);
  
  // Verify DOM transform applied on video element
  const videoTransform = await page.evaluate(() => {
    const v = document.getElementById('test-video');
    return {
      transform: v?.style.transform,
      className: v?.className,
      containerOverflow: document.getElementById('main-player')?.style.overflow,
    };
  });

  assert('Video has uwvf-active class', videoTransform.className?.includes('uwvf-active'));
  assert('Video style has CSS scale transform', videoTransform.transform?.includes('scale('), `transform: ${videoTransform.transform}`);
  assert('Container has overflow hidden', videoTransform.containerOverflow === 'hidden');

  // Step 4: Slider Adjustment - Move Left (Reduce Crop)
  console.log('[E2E] Step 4: Testing Slider Adjustment (Move Left: -15%)...');
  const sliderLessStatus = await sendTestMessage(page, 'SET_ADJUSTMENT', { adjustment: -15 });

  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: path.join(screenshotsDir, '03_slider_less_crop.png') });
  console.log('  -> Screenshot saved: 03_slider_less_crop.png');

  assert('Scale decreased after negative adjustment', sliderLessStatus?.currentScale < zoomStatus?.currentScale, `now: ${sliderLessStatus?.currentScale} < was: ${zoomStatus?.currentScale}`);
  assert('Adjustment stored as -15', sliderLessStatus?.adjustment === -15);

  // Step 5: Slider Adjustment - Move Right (Increase Crop)
  console.log('[E2E] Step 5: Testing Slider Adjustment (Move Right: +25%)...');
  const sliderMoreStatus = await sendTestMessage(page, 'SET_ADJUSTMENT', { adjustment: 25 });

  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: path.join(screenshotsDir, '04_slider_more_crop.png') });
  console.log('  -> Screenshot saved: 04_slider_more_crop.png');

  assert('Scale increased after positive adjustment', sliderMoreStatus?.currentScale > zoomStatus?.currentScale, `now: ${sliderMoreStatus?.currentScale} > was: ${zoomStatus?.currentScale}`);
  assert('Adjustment stored as 25', sliderMoreStatus?.adjustment === 25);

  // Step 6: Reset
  console.log('[E2E] Step 6: Testing RESET...');
  const resetStatus = await sendTestMessage(page, 'RESET');

  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: path.join(screenshotsDir, '05_reset_restored.png') });
  console.log('  -> Screenshot saved: 05_reset_restored.png');

  assert('Transformed is false after reset', resetStatus?.isTransformed === false);
  assert('Scale reset to 1', resetStatus?.currentScale === 1);

  const resetTransform = await page.evaluate(() => {
    const v = document.getElementById('test-video');
    return {
      transform: v?.style.transform,
      hasActiveClass: v?.classList.contains('uwvf-active'),
    };
  });
  assert('CSS transform cleared', resetTransform.transform === '');
  assert('uwvf-active class removed', resetTransform.hasActiveClass === false);

  // Step 7: Cinema Crop
  console.log('[E2E] Step 7: Testing Cinema Crop...');
  // Zoom first
  await sendTestMessage(page, 'ZOOM_TO_FILL');
  const cinemaStatus = await sendTestMessage(page, 'SET_ADVANCED', { cinemaCrop: 'high' });
  assert('Cinema crop applied higher scale', cinemaStatus?.currentScale > zoomStatus?.currentScale, `cinema scale: ${cinemaStatus?.currentScale}`);

  // Reset advanced
  await sendTestMessage(page, 'SET_ADVANCED', { cinemaCrop: 'off' });
  await sendTestMessage(page, 'RESET');

  // Step 8: Multiple Videos Detection & Selection
  console.log('[E2E] Step 8: Testing Multiple Videos Detection...');
  await page.click('#btn-toggle-second');
  await new Promise((r) => setTimeout(r, 600));

  const multiStatus = await sendTestMessage(page, 'GET_VIDEO_STATUS');

  await page.screenshot({ path: path.join(screenshotsDir, '06_multiple_videos.png') });
  console.log('  -> Screenshot saved: 06_multiple_videos.png');

  assert('Both videos detected', multiStatus?.videoCount === 2, `count: ${multiStatus?.videoCount}`);

  // Test selecting video index 1
  const selectStatus = await sendTestMessage(page, 'SELECT_VIDEO', { index: 1 });
  assert('Active video changed to index 1', selectStatus?.activeVideoIndex === 1, `index: ${selectStatus?.activeVideoIndex}`);

  // Step 9: SPA Navigation Simulation
  console.log('[E2E] Step 9: Testing SPA Navigation (yt-navigate-finish)...');
  await page.click('#btn-simulate-spa');
  await new Promise((r) => setTimeout(r, 600));

  const spaStatus = await sendTestMessage(page, 'GET_VIDEO_STATUS');
  assert('Videos still detected after SPA navigation', spaStatus?.detected === true);

  // Step 10: Video Element Replacement (DOM Recreation)
  console.log('[E2E] Step 10: Testing Video Element Replacement...');
  await page.click('#btn-replace-video');
  await new Promise((r) => setTimeout(r, 600));

  const replacedStatus = await sendTestMessage(page, 'GET_VIDEO_STATUS');
  assert('New video detected after DOM replacement', replacedStatus?.detected === true);

  // Step 11: Site Settings Persistence
  console.log('[E2E] Step 11: Testing Site Settings Persistence...');
  const siteSaveStatus = await sendTestMessage(page, 'SAVE_SITE_SETTINGS');
  assert('Site settings saved successfully', siteSaveStatus?.success === true);

  // Step 12: Testing Extension Popup UI
  if (extensionId) {
    console.log('[E2E] Step 12: Testing Extension Popup Page UI...');
    const popupPage = await browser.newPage();
    await popupPage.setViewport({ width: 380, height: 600 });
    await popupPage.goto(`chrome-extension://${extensionId}/popup/index.html`, { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 600));

    await popupPage.screenshot({ path: path.join(screenshotsDir, '07_popup_ui.png') });
    console.log('  -> Screenshot saved: 07_popup_ui.png');

    // Check popup elements
    const popupContent = await popupPage.evaluate(() => {
      return {
        title: document.querySelector('.header h1')?.textContent,
        zoomBtn: document.querySelector('.zoom-btn')?.textContent?.trim(),
        hasSlider: !!document.querySelector('.range-slider'),
        hasAutoMarker: !!document.querySelector('.auto-marker'),
        hasMinMax: !!document.querySelector('.slider-minmax-labels'),
        percentageDisplay: document.querySelector('.percentage-display')?.textContent?.trim(),
        hasResetBtn: !!document.querySelector('.reset-btn'),
        hasAutoFillToggle: !!document.querySelector('.toggle'),
        hasAdvancedToggle: !!document.querySelector('.advanced-toggle'),
      };
    });

    assert('Popup header renders title', popupContent.title === 'UltraWide Video Fill', `title: ${popupContent.title}`);
    assert('ZOOM TO FILL button exists in popup', popupContent.zoomBtn === 'ZOOM TO FILL');
    assert('Crop / Zoom slider rendered', popupContent.hasSlider === true);
    assert('AUTO marker rendered below slider', popupContent.hasAutoMarker === true);
    assert('MIN/MAX labels rendered', popupContent.hasMinMax === true);
    assert('Percentage value displayed', !!popupContent.percentageDisplay, `value: ${popupContent.percentageDisplay}`);
    assert('Reset button exists', popupContent.hasResetBtn === true);
    assert('Auto Fill toggle exists', popupContent.hasAutoFillToggle === true);
    assert('Advanced toggle button exists', popupContent.hasAdvancedToggle === true);

    // Expand Advanced section
    console.log('[E2E] Step 13: Expanding Advanced settings in Popup...');
    await popupPage.click('.advanced-toggle');
    await new Promise((r) => setTimeout(r, 400));
    await popupPage.screenshot({ path: path.join(screenshotsDir, '08_popup_advanced.png') });
    console.log('  -> Screenshot saved: 08_popup_advanced.png');

    const advancedContent = await popupPage.evaluate(() => {
      const adv = document.querySelector('.advanced-content');
      return {
        exists: !!adv,
        hasPosX: adv?.textContent?.includes('Position X'),
        hasPosY: adv?.textContent?.includes('Position Y'),
        hasRotation: adv?.textContent?.includes('Rotation'),
        hasMirror: adv?.textContent?.includes('Mirror H'),
        hasCinemaCrop: adv?.textContent?.includes('Cinema Crop'),
      };
    });

    assert('Advanced panel opened', advancedContent.exists === true);
    assert('Position X/Y controls exist', advancedContent.hasPosX && advancedContent.hasPosY);
    assert('Rotation control exists', advancedContent.hasRotation === true);
    assert('Mirror controls exist', advancedContent.hasMirror === true);
    assert('Cinema Crop selector exists', advancedContent.hasCinemaCrop === true);

    await popupPage.close();

    // Step 14: Testing Options Page UI
    console.log('[E2E] Step 14: Testing Options Page UI...');
    const optionsPage = await browser.newPage();
    await optionsPage.setViewport({ width: 800, height: 700 });
    await optionsPage.goto(`chrome-extension://${extensionId}/options/index.html`, { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 600));

    await optionsPage.screenshot({ path: path.join(screenshotsDir, '09_options_page.png') });
    console.log('  -> Screenshot saved: 09_options_page.png');

    const optionsContent = await optionsPage.evaluate(() => {
      return {
        title: document.querySelector('h1')?.textContent,
        sections: Array.from(document.querySelectorAll('section h2')).map((h) => h.textContent),
        hasShortcuts: document.body.textContent.includes('Alt + Shift + F'),
        hasDangerZone: !!document.querySelector('.danger-zone'),
      };
    });

    assert('Options title renders', optionsContent.title === 'UltraWide Video Fill');
    assert('Options sections present', optionsContent.sections.includes('General') && optionsContent.sections.includes('Keyboard Shortcuts'));
    assert('Shortcuts documented (Alt + Shift + F)', optionsContent.hasShortcuts === true);
    assert('Danger zone reset button present', optionsContent.hasDangerZone === true);

    await optionsPage.close();
  }

  // Summary
  console.log('\n========================================');
  console.log('            E2E TEST SUMMARY            ');
  console.log('========================================');
  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  console.log(`Total tests:  ${results.length}`);
  console.log(`Passed:       ${passed}`);
  console.log(`Failed:       ${failed}`);
  console.log('========================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('🎉 ALL CHROME EXTENSION E2E TESTS PASSED SUCCESSFULLY!');
  }
} catch (err) {
  console.error('[E2E] Error during test execution:', err);
  process.exit(1);
} finally {
  if (browser) await browser.close();
  server.close();
}
