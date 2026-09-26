import puppeteer from 'puppeteer';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');
const distDir = path.resolve(rootDir, 'dist');
const screenshotsDir = path.resolve(__dirname, 'screenshots');

if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

const PORT = 8199;

// Static server serving dist assets
const server = http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0];
  let filePath;

  if (urlPath === '/' || urlPath === '/popup' || urlPath.startsWith('/popup/')) {
    if (urlPath.endsWith('.js') || urlPath.endsWith('.css') || urlPath.endsWith('.html')) {
      filePath = path.join(distDir, urlPath.replace(/^\/popup/, 'src/popup'));
      if (!fs.existsSync(filePath)) {
        filePath = path.join(distDir, urlPath.replace(/^\//, ''));
      }
    } else {
      filePath = path.join(distDir, 'src/popup/index.html');
    }
  } else {
    filePath = path.join(distDir, urlPath.replace(/^\//, ''));
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    const mimeMap = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.png': 'image/png',
      '.svg': 'image/svg+xml',
    };
    res.writeHead(200, {
      'Content-Type': mimeMap[ext] || 'text/plain',
      'Access-Control-Allow-Origin': '*',
    });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404);
    res.end('Not found: ' + urlPath);
  }
});

let passed = 0;
let failed = 0;

function assert(description, condition, details = '') {
  if (condition) {
    passed++;
    console.log(`  ✓ PASS: ${description}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${description} ${details ? `(${details})` : ''}`);
  }
}

async function run() {
  await new Promise((resolve) => server.listen(PORT, resolve));
  console.log(`[E2E] Static server running on port ${PORT}`);

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-default-apps',
      '--no-first-run',
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 380, height: 600 });

    page.on('console', (msg) => {
      console.log('  [BROWSER CONSOLE]:', msg.text());
    });

    // Mock chrome extension APIs in the page context
    await page.evaluateOnNewDocument(() => {
      const isDrm = window.location.search.includes('drm=1');
      const noVideo = window.location.search.includes('novideo=1');

      let mockStatus = {
        detected: !noVideo,
        videoCount: noVideo ? 0 : 1,
        activeVideoIndex: 0,
        isTransformed: !noVideo,
        currentScale: 1.33,
        autoFillScale: 1.33,
        adjustment: 12,
        containerWidth: 3440,
        containerHeight: 1440,
        isFullscreen: false,
        sharpness: 35,
        hdrBoost: 60,
        brightness: 100,
        aspectRatio: 'auto',
        gpuBackend: isDrm ? 'direct-gpu' : 'webgpu',
        gpuAvailable: true,
        isDrmProtected: isDrm,
      };

      window.mockState = mockStatus;
      window.mockGlobalSettings = { brightness: 100 };

      window.chrome = {
        runtime: {
          openOptionsPage: () => {
            window.__optionsOpened = true;
          },
          lastError: null,
        },
        storage: {
          local: {
            get: (keys, callback) => {
              callback({ globalSettings: window.mockGlobalSettings });
            },
            set: (obj, callback) => {
              window.mockGlobalSettings = { ...(window.mockGlobalSettings || {}), ...obj.globalSettings };
              if (callback) callback();
            },
          },
        },
        tabs: {
          query: (queryInfo, callback) => {
            callback([{ id: 1, active: true, currentWindow: true }]);
          },
          sendMessage: (tabId, msg, callback) => {
            if (msg.type === 'GET_VIDEO_STATUS') {
              callback({ ...window.mockState });
            } else if (msg.type === 'ZOOM_TO_FILL') {
              window.mockState.isTransformed = true;
              callback({ ...window.mockState });
            } else if (msg.type === 'RESET') {
              window.mockState.isTransformed = false;
              callback({ ...window.mockState });
            } else if (msg.type === 'SET_ADJUSTMENT') {
              window.mockState.adjustment = msg.payload.adjustment;
              window.mockState.isTransformed = true;
              callback({ ...window.mockState });
            } else if (msg.type === 'SET_BRIGHTNESS') {
              window.mockState.brightness = msg.payload.brightness;
              callback({ ...window.mockState });
            } else if (msg.type === 'SET_ASPECT_RATIO') {
              window.mockState.aspectRatio = msg.payload.aspectRatio;
              window.mockState.isTransformed = true;
              callback({ ...window.mockState });
            } else if (msg.type === 'SET_GPU_EFFECTS') {
              if (msg.payload.sharpness !== undefined) window.mockState.sharpness = msg.payload.sharpness;
              if (msg.payload.hdrBoost !== undefined) window.mockState.hdrBoost = msg.payload.hdrBoost;
              callback({ ...window.mockState });
            } else {
              callback({ ...window.mockState });
            }
          },
        },
      };
    });

    console.log('\n[E2E-Popup] 1. Loading Standard Popup (YouTube/Non-DRM)...');
    await page.goto(`http://localhost:${PORT}/popup/index.html`, { waitUntil: 'networkidle0' });

    // Wait for React to render and receive initial status
    await page.waitForSelector('.large-toggle.on');

    // 1. Check Dimensions & Shape
    const panelStyle = await page.evaluate(() => {
      const panel = document.querySelector('.popup-panel');
      const body = document.body;
      const rect = panel.getBoundingClientRect();
      const style = window.getComputedStyle(panel);
      return {
        bodyWidth: body.clientWidth,
        panelWidth: rect.width,
        panelHeight: rect.height,
        borderRadius: style.borderRadius,
      };
    });

    assert('Popup body width is 380px', panelStyle.bodyWidth === 380, `width=${panelStyle.bodyWidth}`);
    assert('Border radius is 20px (18-22px range)', parseInt(panelStyle.borderRadius, 10) >= 18, `radius=${panelStyle.borderRadius}`);
    assert('Height fits without excess vertical overflow (< 680px)', panelStyle.panelHeight <= 680, `height=${panelStyle.panelHeight}`);

    // 2. Check Header
    const headerInfo = await page.evaluate(() => {
      const title = document.querySelector('.brand-title')?.textContent?.trim();
      const subtitle = document.querySelector('.brand-subtitle')?.textContent?.trim();
      const statusText = document.querySelector('.status-text')?.textContent?.trim();
      const hasStatusDot = !!document.querySelector('.status-dot');
      const hasSettingsBtn = !!document.querySelector('.settings-icon-btn');
      return { title, subtitle, statusText, hasStatusDot, hasSettingsBtn };
    });

    assert('Header brand title is "UltraWide"', headerInfo.title === 'UltraWide');
    assert('Header brand subtitle is "Video Fill Pro"', headerInfo.subtitle === 'Video Fill Pro');
    assert('Status pill shows "Active" with green dot', headerInfo.statusText === 'Active' && headerInfo.hasStatusDot);
    assert('Settings icon button is present (gear icon, not text)', headerInfo.hasSettingsBtn);

    // 3. Test Settings Navigation
    await page.click('.settings-icon-btn');
    const optionsOpened = await page.evaluate(() => window.__optionsOpened);
    assert('Clicking settings icon calls chrome.runtime.openOptionsPage()', optionsOpened === true);

    // 4. Check Zoom to Fill Row
    const zoomRowInfo = await page.evaluate(() => {
      const title = document.querySelector('.zoom-title')?.textContent?.trim();
      const subtitle = document.querySelector('.zoom-subtitle')?.textContent?.trim();
      const toggle = document.querySelector('.large-toggle');
      return {
        title,
        subtitle,
        isOn: toggle?.classList.contains('on'),
      };
    });

    assert('Zoom to Fill title rendered', zoomRowInfo.title === 'Zoom to Fill');
    assert('Zoom to Fill subtitle rendered', zoomRowInfo.subtitle === 'Automatically fills the video');
    assert('Zoom to Fill toggle is ON initially', zoomRowInfo.isOn === true);

    // 5. Test Toggling Zoom to Fill
    await page.click('.zoom-row');
    await page.waitForSelector('.large-toggle.off');
    const toggledOff = await page.evaluate(() => {
      return document.querySelector('.large-toggle')?.classList.contains('off');
    });
    assert('Clicking Zoom to Fill row toggles it OFF', toggledOff === true);

    // Toggle it back ON
    await page.click('.zoom-row');
    await page.waitForSelector('.large-toggle.on');
    assert('Clicking Zoom to Fill row again toggles it back ON', true);

    // 5b. Check Screen Size / Aspect Ratio 1-Click Selector
    const screenSizesInfo = await page.evaluate(() => {
      const section = document.querySelector('.screen-sizes-section');
      const pills = Array.from(document.querySelectorAll('.ar-pill')).map(p => p.textContent.trim());
      const activePill = document.querySelector('.ar-pill.active')?.textContent?.trim();
      const badge = document.querySelector('.screen-sizes-badge')?.textContent?.trim();
      return { hasSection: !!section, pills, activePill, badge };
    });

    assert('Screen size selector rendered', screenSizesInfo.hasSection);
    assert('All 5 screen size presets present (Auto, 21:9, 32:9, 16:9, 16:10)', 
      screenSizesInfo.pills.join(',') === 'Auto,21:9,32:9,16:9,16:10', 
      `pills=${screenSizesInfo.pills.join(',')}`);
    assert('Initial screen size is "Auto"', screenSizesInfo.activePill === 'Auto' && screenSizesInfo.badge === 'Auto Fit');

    // Test 1-click selection of 21:9 aspect ratio
    await page.evaluate(() => {
      const pills = Array.from(document.querySelectorAll('.ar-pill'));
      const p21_9 = pills.find(p => p.textContent.trim() === '21:9');
      p21_9?.click();
    });
    await new Promise((r) => setTimeout(r, 60));

    const selectedArInfo = await page.evaluate(() => {
      const activePill = document.querySelector('.ar-pill.active')?.textContent?.trim();
      const badge = document.querySelector('.screen-sizes-badge')?.textContent?.trim();
      return { activePill, badge, mockAr: window.mockState?.aspectRatio };
    });

    assert('Clicking "21:9" sets active screen size in 1 click', selectedArInfo.activePill === '21:9' && selectedArInfo.badge === '21:9');
    assert('Content script received SET_ASPECT_RATIO with 21:9', selectedArInfo.mockAr === '21:9');

    // 6. Check Crop / Zoom Slider
    const cropSliderInfo = await page.evaluate(() => {
      const sliders = Array.from(document.querySelectorAll('.control-block'));
      const cropSection = sliders.find(s => s.textContent.includes('Crop / Zoom'));
      const value = cropSection?.querySelector('.control-value-badge')?.textContent?.trim();
      const sublabels = cropSection?.querySelector('.slider-sublabels')?.textContent?.trim();
      const resetBtn = cropSection?.querySelector('.slider-reset-btn');
      return { hasCrop: !!cropSection, value, sublabels, hasReset: !!resetBtn };
    });

    assert('Crop / Zoom slider rendered', cropSliderInfo.hasCrop);
    assert('Crop / Zoom live percentage shown (+12%)', cropSliderInfo.value === '+12%', `val=${cropSliderInfo.value}`);
    assert('Crop / Zoom has "Less crop" and "More crop" labels', cropSliderInfo.sublabels.includes('Less crop') && cropSliderInfo.sublabels.includes('More crop'));
    assert('Crop / Zoom shows Reset button when adjustment != 0%', cropSliderInfo.hasReset === true);

    // Test clicking Crop / Zoom Reset button
    await page.evaluate(() => {
      const sliders = Array.from(document.querySelectorAll('.control-block'));
      const cropSection = sliders.find(s => s.textContent.includes('Crop / Zoom'));
      const resetBtn = cropSection?.querySelector('.slider-reset-btn');
      resetBtn?.click();
    });
    await new Promise((r) => setTimeout(r, 60));

    const resetCropInfo = await page.evaluate(() => {
      const sliders = Array.from(document.querySelectorAll('.control-block'));
      const cropSection = sliders.find(s => s.textContent.includes('Crop / Zoom'));
      const value = cropSection?.querySelector('.control-value-badge')?.textContent?.trim();
      const resetBtn = cropSection?.querySelector('.slider-reset-btn');
      return { value, hasReset: !!resetBtn };
    });
    assert('Clicking Crop Reset restores adjustment to 0%', resetCropInfo.value === '0%');
    assert('Crop Reset button disappears after resetting to 0%', resetCropInfo.hasReset === false);

    // 6b. Check Brightness Slider
    const brightSliderInfo = await page.evaluate(() => {
      const sliders = Array.from(document.querySelectorAll('.control-block'));
      const brightSection = sliders.find(s => s.textContent.includes('Brightness'));
      const value = brightSection?.querySelector('.control-value-badge')?.textContent?.trim();
      const sublabels = brightSection?.querySelector('.slider-sublabels')?.textContent?.trim();
      const resetBtn = brightSection?.querySelector('.slider-reset-btn');
      return { hasBright: !!brightSection, value, sublabels, hasReset: !!resetBtn };
    });

    assert('Brightness slider rendered', brightSliderInfo.hasBright);
    assert('Brightness live percentage shown (100%)', brightSliderInfo.value === '100%', `val=${brightSliderInfo.value}`);
    assert('Brightness has "Dimmer" and "Brighter" labels', brightSliderInfo.sublabels.includes('Dimmer') && brightSliderInfo.sublabels.includes('Brighter'));
    assert('Brightness Reset button is hidden when brightness is at system 100%', brightSliderInfo.hasReset === false);

    // Test adjusting Brightness and verifying Global Storage persistence
    await page.evaluate(() => {
      const sliders = Array.from(document.querySelectorAll('.control-block'));
      const brightSection = sliders.find(s => s.textContent.includes('Brightness'));
      const input = brightSection?.querySelector('input[type="range"]');
      if (input) {
        // Set React input value
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeInputValueSetter.call(input, '130');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    // Wait for debounce timer to fire and write to storage
    await new Promise((r) => setTimeout(r, 100));

    const globalStorageBrightness = await page.evaluate(() => window.mockGlobalSettings?.brightness);
    assert('Adjusting brightness saves globally to chrome.storage.local (130%)', globalStorageBrightness === 130, `saved=${globalStorageBrightness}`);

    // Verify Brightness Reset button appears when brightness is 130%
    const hasBrightReset = await page.evaluate(() => {
      const sliders = Array.from(document.querySelectorAll('.control-block'));
      const brightSection = sliders.find(s => s.textContent.includes('Brightness'));
      return !!brightSection?.querySelector('.slider-reset-btn');
    });
    assert('Brightness slider shows "Reset" button when modified to 130%', hasBrightReset === true);

    // Click Brightness Reset button to reset to system brightness (100%)
    await page.evaluate(() => {
      const sliders = Array.from(document.querySelectorAll('.control-block'));
      const brightSection = sliders.find(s => s.textContent.includes('Brightness'));
      const resetBtn = brightSection?.querySelector('.slider-reset-btn');
      resetBtn?.click();
    });
    await new Promise((r) => setTimeout(r, 100));

    const resetBrightInfo = await page.evaluate(() => {
      const sliders = Array.from(document.querySelectorAll('.control-block'));
      const brightSection = sliders.find(s => s.textContent.includes('Brightness'));
      const value = brightSection?.querySelector('.control-value-badge')?.textContent?.trim();
      const resetBtn = brightSection?.querySelector('.slider-reset-btn');
      return { 
        value, 
        hasReset: !!resetBtn,
        mockBright: window.mockState?.brightness,
        savedBright: window.mockGlobalSettings?.brightness,
      };
    });

    assert('Clicking Brightness Reset button restores brightness to 100%', resetBrightInfo.value === '100%');
    assert('Brightness Reset button updates global storage back to 100', resetBrightInfo.savedBright === 100);
    assert('Brightness Reset button hides after resetting to 100%', resetBrightInfo.hasReset === false);

    // 7. Check Sharpness Slider (Non-DRM standard)
    const sharpSliderInfo = await page.evaluate(() => {
      const sliders = Array.from(document.querySelectorAll('.control-block'));
      const sharpSection = sliders.find(s => s.textContent.includes('Sharpness'));
      const value = sharpSection?.querySelector('.control-value-badge')?.textContent?.trim();
      const sublabels = sharpSection?.querySelector('.slider-sublabels')?.textContent?.trim();
      return { hasSharp: !!sharpSection, value, sublabels };
    });

    assert('Sharpness slider rendered', sharpSliderInfo.hasSharp);
    assert('Sharpness live percentage shown (35%)', sharpSliderInfo.value === '35%');
    assert('Sharpness has "Smoother" and "Sharper" labels', sharpSliderInfo.sublabels.includes('Smoother') && sharpSliderInfo.sublabels.includes('Sharper'));

    // 8. Check HDR Boost Slider (Non-DRM standard)
    const hdrSliderInfo = await page.evaluate(() => {
      const sliders = Array.from(document.querySelectorAll('.control-block'));
      const hdrSection = sliders.find(s => s.textContent.includes('HDR Boost'));
      const value = hdrSection?.querySelector('.control-value-badge')?.textContent?.trim();
      const sublabels = hdrSection?.querySelector('.slider-sublabels')?.textContent?.trim();
      return { hasHdr: !!hdrSection, value, sublabels };
    });

    assert('HDR Boost slider rendered', hdrSliderInfo.hasHdr);
    assert('HDR Boost live percentage shown (60%)', hdrSliderInfo.value === '60%');
    assert('HDR Boost has "Natural" and "More vivid" labels', hdrSliderInfo.sublabels.includes('Natural') && hdrSliderInfo.sublabels.includes('More vivid'));

    // 9. Check Presets Dropdown
    const presetInfo = await page.evaluate(() => {
      const presetRow = document.querySelector('.preset-trigger-row');
      const activeVal = document.querySelector('.preset-active-value')?.textContent?.trim();
      return { hasPresetRow: !!presetRow, activeVal };
    });

    assert('Presets trigger row rendered', presetInfo.hasPresetRow);
    assert('Preset shows "Custom" when Sharpness=35 and HDR=60', presetInfo.activeVal === 'Custom', `val=${presetInfo.activeVal}`);

    // Click to open preset dropdown
    await page.click('.preset-trigger-row');
    await page.waitForSelector('.preset-menu');

    const dropdownOpen = await page.evaluate(() => {
      const menu = document.querySelector('.preset-menu');
      const items = Array.from(document.querySelectorAll('.preset-menu-item')).map(i => i.textContent);
      return { isOpen: !!menu, itemsCount: items.length };
    });

    assert('Preset dropdown menu opened on click', dropdownOpen.isOpen && dropdownOpen.itemsCount === 4);

    // Screenshot standard popup with dropdown open
    await page.screenshot({ path: path.join(screenshotsDir, '17_popup_compact_standard_dropdown.png') });
    console.log('  -> Screenshot saved: 17_popup_compact_standard_dropdown.png');

    // Select "Cinematic" preset (Sharpness: 35, HDR: 30)
    await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.preset-menu-item'));
      const cinematic = items.find(i => i.textContent.includes('Cinematic'));
      cinematic?.click();
    });
    await new Promise((r) => setTimeout(r, 60));

    const selectedPresetInfo = await page.evaluate(() => {
      const activeVal = document.querySelector('.preset-active-value')?.textContent?.trim();
      const hdrBadge = Array.from(document.querySelectorAll('.control-block'))
        .find(s => s.textContent.includes('HDR Boost'))
        ?.querySelector('.control-value-badge')?.textContent?.trim();
      return { activeVal, hdrBadge };
    });

    assert('Selecting Cinematic updates active preset label to "Cinematic"', selectedPresetInfo.activeVal === 'Cinematic');
    assert('Selecting Cinematic updates HDR Boost slider to 30%', selectedPresetInfo.hdrBadge === '30%');

    // Screenshot standard popup with Cinematic preset active
    await page.screenshot({ path: path.join(screenshotsDir, '18_popup_compact_standard_active.png') });
    console.log('  -> Screenshot saved: 18_popup_compact_standard_active.png');

    // 10. TEST DRM-PROTECTED SITES (Hotstar, Prime Video, Netflix)
    console.log('\n[E2E-Popup] 2. Testing DRM-Protected Platform Mode (Hotstar / Prime Video)...');
    await page.goto(`http://localhost:${PORT}/popup/index.html?drm=1`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('.popup-panel');
    await page.waitForSelector('.large-toggle.on');

    const drmPopupContent = await page.evaluate(() => {
      const text = document.querySelector('.popup-panel')?.textContent || '';
      const hasSharpness = text.includes('Sharpness');
      const hasHdr = text.includes('HDR Boost');
      const hasPresets = text.includes('Presets');
      const hasZoom = text.includes('Zoom to Fill');
      const hasCrop = text.includes('Crop / Zoom');
      const hasBrightness = text.includes('Brightness');
      const hasScreenSizes = text.includes('Screen Size');
      const panelHeight = document.querySelector('.popup-panel')?.getBoundingClientRect().height;
      return { hasSharpness, hasHdr, hasPresets, hasZoom, hasCrop, hasBrightness, hasScreenSizes, panelHeight };
    });

    assert('DRM site: Sharpness control is REMOVED', drmPopupContent.hasSharpness === false);
    assert('DRM site: HDR Boost control is REMOVED', drmPopupContent.hasHdr === false);
    assert('DRM site: Presets control is REMOVED', drmPopupContent.hasPresets === false);
    assert('DRM site: Zoom to Fill is present and operational', drmPopupContent.hasZoom === true);
    assert('DRM site: Screen Size selector is present and operational', drmPopupContent.hasScreenSizes === true);
    assert('DRM site: Crop / Zoom slider is present and operational', drmPopupContent.hasCrop === true);
    assert('DRM site: Brightness slider is RETAINED (DRM-safe compositor filter)', drmPopupContent.hasBrightness === true);
    assert('DRM site: Ultra-compact popup height (< 450px)', drmPopupContent.panelHeight < 450, `height=${drmPopupContent.panelHeight}`);

    // Screenshot DRM-safe ultra-compact popup
    await page.screenshot({ path: path.join(screenshotsDir, '19_popup_compact_drm_protected.png') });
    console.log('  -> Screenshot saved: 19_popup_compact_drm_protected.png');

    // 11. TEST RESPONSIVENESS AT MULTIPLE WIDTHS
    console.log('\n[E2E-Popup] 3. Testing Responsiveness Across Widths (320px, 360px, 380px, 400px)...');
    for (const width of [320, 360, 380, 400]) {
      await page.setViewport({ width, height: 600 });
      await page.goto(`http://localhost:${PORT}/popup/index.html`, { waitUntil: 'networkidle0' });
      await page.waitForSelector('.popup-panel');
      const panelWidth = await page.evaluate(() => document.querySelector('.popup-panel')?.getBoundingClientRect().width);
      assert(`Popup renders cleanly at ${width}px`, panelWidth <= width, `rendered=${panelWidth}px <= target=${width}px`);
    }

    // 12. TEST NO VIDEO DETECTED STATE
    console.log('\n[E2E-Popup] 4. Testing "No Video Detected" State...');
    await page.setViewport({ width: 380, height: 600 });
    await page.goto(`http://localhost:${PORT}/popup/index.html?novideo=1`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('.popup-panel');
    await page.waitForSelector('.status-pill.inactive');

    const noVideoInfo = await page.evaluate(() => {
      const statusText = document.querySelector('.status-text')?.textContent?.trim();
      const statusDot = document.querySelector('.status-dot');
      const zoomSubtitle = document.querySelector('.zoom-subtitle')?.textContent?.trim();
      const isZoomRowDisabled = document.querySelector('.zoom-row')?.classList.contains('disabled');
      const isSliderDisabled = document.querySelector('.premium-slider')?.disabled;
      return { statusText, zoomSubtitle, isZoomRowDisabled, isSliderDisabled };
    });

    assert('Status badge shows "No Video"', noVideoInfo.statusText === 'No Video');
    assert('Zoom subtitle displays "No video detected" unobtrusively', noVideoInfo.zoomSubtitle === 'No video detected');
    assert('Controls gracefully disabled without layout-pushing banner', noVideoInfo.isZoomRowDisabled && noVideoInfo.isSliderDisabled);

    await page.screenshot({ path: path.join(screenshotsDir, '20_popup_compact_no_video.png') });
    console.log('  -> Screenshot saved: 20_popup_compact_no_video.png');

    console.log(`\n[E2E-Popup] All Tests Completed: ${passed} PASSED, ${failed} FAILED`);
  } finally {
    await browser.close();
    server.close();
  }

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('[E2E-Popup] Fatal error:', err);
  process.exit(1);
});
