import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const releaseDir = path.resolve(rootDir, 'release');
const storeAssetsDir = path.resolve(releaseDir, 'store-assets');

if (!fs.existsSync(storeAssetsDir)) {
  fs.mkdirSync(storeAssetsDir, { recursive: true });
}

console.log('[Store-Packager] 1. Rebuilding extension in production mode...');
execSync('npm.cmd run build', { cwd: rootDir, stdio: 'inherit' });

console.log('[Store-Packager] 2. Packaging extension into ZIP for Microsoft Partner Center...');
const zipPath = path.resolve(releaseDir, 'ultrawide-video-fill-pro-v1.0.0.zip');
if (fs.existsSync(zipPath)) {
  fs.unlinkSync(zipPath);
}

// Create ZIP using PowerShell Compress-Archive with root structure
execSync(
  `powershell -Command "Compress-Archive -Path 'dist\\*' -DestinationPath '${zipPath}' -Force"`,
  { cwd: rootDir, stdio: 'inherit' }
);
console.log(`✓ Extension ZIP generated: ${zipPath}`);

console.log('[Store-Packager] 3. Launching Puppeteer to generate high-res store assets...');
const browser = await puppeteer.launch({
  headless: 'new',
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

try {
  const page = await browser.newPage();

  // Read base64 of the logo and screenshots
  const logoBase64 = fs.readFileSync(path.resolve(rootDir, 'public/icons/logo.png')).toString('base64');
  const popupActiveBase64 = fs.readFileSync(path.resolve(rootDir, 'tests/e2e/screenshots/18_popup_compact_standard_active.png')).toString('base64');
  const popupDrmBase64 = fs.readFileSync(path.resolve(rootDir, 'tests/e2e/screenshots/19_popup_compact_drm_protected.png')).toString('base64');
  const popupDropdownBase64 = fs.readFileSync(path.resolve(rootDir, 'tests/e2e/screenshots/17_popup_compact_standard_dropdown.png')).toString('base64');

  // ─── 3.1 Store Logo (300 x 300 px) ───
  console.log('  -> Generating Store Logo (300x300)...');
  await page.setViewport({ width: 300, height: 300, deviceScaleFactor: 1 });
  await page.setContent(`
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            width: 300px;
            height: 300px;
            background: #07101d;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
          }
          .logo-frame {
            width: 270px;
            height: 270px;
            border-radius: 54px;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 12px 36px rgba(0, 0, 0, 0.6), 0 0 24px rgba(56, 189, 248, 0.4);
            border: 2px solid rgba(56, 189, 248, 0.4);
          }
          img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
        </style>
      </head>
      <body>
        <div class="logo-frame">
          <img src="data:image/png;base64,${logoBase64}" />
        </div>
      </body>
    </html>
  `, { waitUntil: 'load' });

  const storeLogoPath = path.resolve(storeAssetsDir, 'store_logo_300x300.png');
  await page.screenshot({ path: storeLogoPath });
  console.log(`    ✓ Saved: ${storeLogoPath}`);

  // ─── Helper function for promo banner screenshots ───
  async function generatePromoScreenshot(filename, width, height, htmlContent) {
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await page.setContent(htmlContent, { waitUntil: 'load' });
    const outPath = path.resolve(storeAssetsDir, filename);
    await page.screenshot({ path: outPath });
    console.log(`    ✓ Saved: ${outPath}`);
  }

  // ─── 3.2 Screenshot 1: Overview & 1-Click Screen Sizes (1280 x 800) ───
  console.log('  -> Generating Screenshot 1 (1280x800): Overview & 1-Click Sizing...');
  await generatePromoScreenshot(
    'screenshot1_1click_screen_sizes_1280x800.png',
    1280,
    800,
    `
    <!DOCTYPE html>
    <html>
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            width: 1280px;
            height: 800px;
            background: radial-gradient(circle at 20% 30%, #0d1e38 0%, #07101d 70%, #040912 100%);
            font-family: 'Inter', sans-serif;
            color: #f8fafc;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 60px 80px;
            overflow: hidden;
            position: relative;
          }
          .glow-orb {
            position: absolute;
            width: 500px;
            height: 500px;
            border-radius: 50%;
            background: radial-gradient(circle, rgba(56, 189, 248, 0.15) 0%, transparent 70%);
            top: 10%;
            left: 55%;
            filter: blur(40px);
            pointer-events: none;
          }
          .content-left {
            max-width: 580px;
            z-index: 2;
          }
          .badge {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 6px 14px;
            border-radius: 20px;
            background: rgba(56, 189, 248, 0.12);
            border: 1px solid rgba(56, 189, 248, 0.3);
            color: #38bdf8;
            font-size: 13px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-bottom: 24px;
          }
          h1 {
            font-size: 46px;
            font-weight: 800;
            line-height: 1.15;
            margin-bottom: 20px;
            letter-spacing: -0.02em;
          }
          h1 span {
            background: linear-gradient(90deg, #38bdf8, #818cf8);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
          }
          p {
            font-size: 18px;
            line-height: 1.6;
            color: #94a3b8;
            margin-bottom: 32px;
          }
          .features-list {
            display: flex;
            flex-direction: column;
            gap: 14px;
          }
          .feature-item {
            display: flex;
            align-items: center;
            gap: 12px;
            font-size: 16px;
            font-weight: 600;
            color: #e2e8f0;
          }
          .check-icon {
            width: 22px;
            height: 22px;
            border-radius: 50%;
            background: rgba(16, 185, 129, 0.2);
            border: 1px solid #10b981;
            color: #10b981;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 13px;
            flex-shrink: 0;
          }
          .popup-wrapper {
            z-index: 2;
            filter: drop-shadow(0 25px 50px rgba(0,0,0,0.85));
            border-radius: 20px;
            border: 1px solid rgba(255, 255, 255, 0.12);
            overflow: hidden;
            width: 380px;
          }
          .popup-wrapper img {
            width: 100%;
            display: block;
          }
        </style>
      </head>
      <body>
        <div class="glow-orb"></div>
        <div class="content-left">
          <div class="badge">Ultrawide Video Enhancement</div>
          <h1>Fill Your Ultrawide Monitor <span>In 1 Click</span></h1>
          <p>Instantly remove black bars and letterboxing from YouTube, Netflix, Prime Video, Hotstar, and any video site. Native GPU acceleration with zero latency.</p>
          <div class="features-list">
            <div class="feature-item">
              <span class="check-icon">✓</span>
              <span>1-Click Screen Sizes: Auto, 21:9, 32:9, 16:9, 16:10</span>
            </div>
            <div class="feature-item">
              <span class="check-icon">✓</span>
              <span>Adjustable Crop / Zoom with Instant Reset Button</span>
            </div>
            <div class="feature-item">
              <span class="check-icon">✓</span>
              <span>Ultra-compact dropdown panel designed for speed</span>
            </div>
          </div>
        </div>
        <div class="popup-wrapper">
          <img src="data:image/png;base64,${popupActiveBase64}" />
        </div>
      </body>
    </html>
    `
  );

  // ─── 3.3 Screenshot 2: GPU Sharpness & HDR Boost (1280 x 800) ───
  console.log('  -> Generating Screenshot 2 (1280x800): GPU Sharpness & HDR Boost...');
  await generatePromoScreenshot(
    'screenshot2_gpu_sharpness_hdr_1280x800.png',
    1280,
    800,
    `
    <!DOCTYPE html>
    <html>
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            width: 1280px;
            height: 800px;
            background: radial-gradient(circle at 75% 35%, #181236 0%, #07101d 70%, #030710 100%);
            font-family: 'Inter', sans-serif;
            color: #f8fafc;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 60px 80px;
            overflow: hidden;
            position: relative;
          }
          .glow-orb {
            position: absolute;
            width: 550px;
            height: 550px;
            border-radius: 50%;
            background: radial-gradient(circle, rgba(139, 92, 246, 0.18) 0%, transparent 70%);
            top: 15%;
            left: 55%;
            filter: blur(40px);
            pointer-events: none;
          }
          .content-left {
            max-width: 580px;
            z-index: 2;
          }
          .badge {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 6px 14px;
            border-radius: 20px;
            background: rgba(139, 92, 246, 0.15);
            border: 1px solid rgba(139, 92, 246, 0.35);
            color: #a78bfa;
            font-size: 13px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-bottom: 24px;
          }
          h1 {
            font-size: 44px;
            font-weight: 800;
            line-height: 1.15;
            margin-bottom: 20px;
            letter-spacing: -0.02em;
          }
          h1 span {
            background: linear-gradient(90deg, #a78bfa, #f472b6, #fb923c);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
          }
          p {
            font-size: 18px;
            line-height: 1.6;
            color: #94a3b8;
            margin-bottom: 32px;
          }
          .features-list {
            display: flex;
            flex-direction: column;
            gap: 14px;
          }
          .feature-item {
            display: flex;
            align-items: center;
            gap: 12px;
            font-size: 16px;
            font-weight: 600;
            color: #e2e8f0;
          }
          .check-icon {
            width: 22px;
            height: 22px;
            border-radius: 50%;
            background: rgba(167, 139, 250, 0.2);
            border: 1px solid #a78bfa;
            color: #a78bfa;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 13px;
            flex-shrink: 0;
          }
          .popup-wrapper {
            z-index: 2;
            filter: drop-shadow(0 25px 50px rgba(0,0,0,0.85));
            border-radius: 20px;
            border: 1px solid rgba(255, 255, 255, 0.12);
            overflow: hidden;
            width: 380px;
          }
          .popup-wrapper img {
            width: 100%;
            display: block;
          }
        </style>
      </head>
      <body>
        <div class="glow-orb"></div>
        <div class="content-left">
          <div class="badge">WebGPU & WebGL Shaders</div>
          <h1>Real-Time <span>GPU Sharpness & HDR Boost</span></h1>
          <p>Enhance lower bitrate streaming video with adaptive unsharp masking and highlight dynamic range expansion. Crisp text, vivid colors, zero halo artifacts.</p>
          <div class="features-list">
            <div class="feature-item">
              <span class="check-icon">✓</span>
              <span>Hardware-Accelerated WebGPU Pipeline (WebGL2 Fallback)</span>
            </div>
            <div class="feature-item">
              <span class="check-icon">✓</span>
              <span>Reinhard Tone-Mapping & Per-Pixel Luminance Protection</span>
            </div>
            <div class="feature-item">
              <span class="check-icon">✓</span>
              <span>Curated Presets: Original, Cinematic, Crisp, HDR Vivid</span>
            </div>
          </div>
        </div>
        <div class="popup-wrapper">
          <img src="data:image/png;base64,${popupDropdownBase64}" />
        </div>
      </body>
    </html>
    `
  );

  // ─── 3.4 Screenshot 3: Global Brightness & DRM Protection (1280 x 800) ───
  console.log('  -> Generating Screenshot 3 (1280x800): Global Brightness & DRM Protection...');
  await generatePromoScreenshot(
    'screenshot3_global_brightness_drm_1280x800.png',
    1280,
    800,
    `
    <!DOCTYPE html>
    <html>
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            width: 1280px;
            height: 800px;
            background: radial-gradient(circle at 30% 70%, #1e190d 0%, #07101d 70%, #030710 100%);
            font-family: 'Inter', sans-serif;
            color: #f8fafc;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 60px 80px;
            overflow: hidden;
            position: relative;
          }
          .glow-orb {
            position: absolute;
            width: 500px;
            height: 500px;
            border-radius: 50%;
            background: radial-gradient(circle, rgba(245, 158, 11, 0.15) 0%, transparent 70%);
            top: 20%;
            left: 55%;
            filter: blur(40px);
            pointer-events: none;
          }
          .content-left {
            max-width: 580px;
            z-index: 2;
          }
          .badge {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 6px 14px;
            border-radius: 20px;
            background: rgba(245, 158, 11, 0.15);
            border: 1px solid rgba(245, 158, 11, 0.35);
            color: #fbbf24;
            font-size: 13px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-bottom: 24px;
          }
          h1 {
            font-size: 44px;
            font-weight: 800;
            line-height: 1.15;
            margin-bottom: 20px;
            letter-spacing: -0.02em;
          }
          h1 span {
            background: linear-gradient(90deg, #fbbf24, #f59e0b, #f97316);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
          }
          p {
            font-size: 18px;
            line-height: 1.6;
            color: #94a3b8;
            margin-bottom: 32px;
          }
          .features-list {
            display: flex;
            flex-direction: column;
            gap: 14px;
          }
          .feature-item {
            display: flex;
            align-items: center;
            gap: 12px;
            font-size: 16px;
            font-weight: 600;
            color: #e2e8f0;
          }
          .check-icon {
            width: 22px;
            height: 22px;
            border-radius: 50%;
            background: rgba(245, 158, 11, 0.2);
            border: 1px solid #f59e0b;
            color: #f59e0b;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 13px;
            flex-shrink: 0;
          }
          .popup-wrapper {
            z-index: 2;
            filter: drop-shadow(0 25px 50px rgba(0,0,0,0.85));
            border-radius: 20px;
            border: 1px solid rgba(255, 255, 255, 0.12);
            overflow: hidden;
            width: 380px;
          }
          .popup-wrapper img {
            width: 100%;
            display: block;
          }
        </style>
      </head>
      <body>
        <div class="glow-orb"></div>
        <div class="content-left">
          <div class="badge">DRM & Streaming Protection</div>
          <h1>Global Brightness <span>& DRM Stream Safe</span></h1>
          <p>Zero blackouts on protected platforms. Universal brightness control with instant system reset and live cross-tab synchronization.</p>
          <div class="features-list">
            <div class="feature-item">
              <span class="check-icon">✓</span>
              <span>100% DRM-Safe: Works on Netflix, Hotstar, Prime Video</span>
            </div>
            <div class="feature-item">
              <span class="check-icon">✓</span>
              <span>0%–200% Global Brightness Slider with Reset to 100%</span>
            </div>
            <div class="feature-item">
              <span class="check-icon">✓</span>
              <span>Live Cross-Tab Sync via Chrome Storage</span>
            </div>
          </div>
        </div>
        <div class="popup-wrapper">
          <img src="data:image/png;base64,${popupDrmBase64}" />
        </div>
      </body>
    </html>
    `
  );

  // ─── 3.5 Small Promo Tile (440 x 280 px) ───
  console.log('  -> Generating Small Promo Tile (440x280)...');
  await generatePromoScreenshot(
    'promo_tile_small_440x280.png',
    440,
    280,
    `
    <!DOCTYPE html>
    <html>
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@600;700;800&display=swap" rel="stylesheet">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            width: 440px;
            height: 280px;
            background: radial-gradient(circle at 30% 30%, #0f2442 0%, #07101d 80%);
            font-family: 'Inter', sans-serif;
            color: #f8fafc;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 30px;
            text-align: center;
            overflow: hidden;
            position: relative;
          }
          .logo-img {
            width: 64px;
            height: 64px;
            border-radius: 16px;
            margin-bottom: 14px;
            box-shadow: 0 0 20px rgba(56, 189, 248, 0.4);
            border: 1.5px solid rgba(56, 189, 248, 0.4);
          }
          h1 {
            font-size: 22px;
            font-weight: 800;
            margin-bottom: 6px;
            letter-spacing: -0.01em;
          }
          h1 span {
            background: linear-gradient(90deg, #38bdf8, #818cf8);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
          }
          p {
            font-size: 13px;
            color: #94a3b8;
            font-weight: 500;
          }
          .tag {
            margin-top: 14px;
            padding: 3px 10px;
            border-radius: 12px;
            background: rgba(56, 189, 248, 0.12);
            color: #38bdf8;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
          }
        </style>
      </head>
      <body>
        <img class="logo-img" src="data:image/png;base64,${logoBase64}" />
        <h1>UltraWide <span>Video Fill Pro</span></h1>
        <p>1-Click Aspect Ratios • GPU HDR • Global Brightness</p>
        <span class="tag">Microsoft Edge Add-on</span>
      </body>
    </html>
    `
  );

  // ─── 3.6 Large Promo Tile (1400 x 560 px) ───
  console.log('  -> Generating Large Promo Tile (1400x560)...');
  await generatePromoScreenshot(
    'promo_tile_large_1400x560.png',
    1400,
    560,
    `
    <!DOCTYPE html>
    <html>
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            width: 1400px;
            height: 560px;
            background: radial-gradient(circle at 25% 40%, #0d223e 0%, #07101d 60%, #030710 100%);
            font-family: 'Inter', sans-serif;
            color: #f8fafc;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 50px 100px;
            overflow: hidden;
            position: relative;
          }
          .glow-orb {
            position: absolute;
            width: 600px;
            height: 600px;
            border-radius: 50%;
            background: radial-gradient(circle, rgba(56, 189, 248, 0.15) 0%, transparent 70%);
            top: 0;
            left: 50%;
            filter: blur(50px);
          }
          .content {
            max-width: 680px;
            z-index: 2;
          }
          .badge {
            display: inline-block;
            padding: 6px 14px;
            border-radius: 16px;
            background: rgba(56, 189, 248, 0.12);
            border: 1px solid rgba(56, 189, 248, 0.3);
            color: #38bdf8;
            font-size: 13px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-bottom: 20px;
          }
          h1 {
            font-size: 48px;
            font-weight: 800;
            line-height: 1.15;
            margin-bottom: 16px;
            letter-spacing: -0.02em;
          }
          h1 span {
            background: linear-gradient(90deg, #38bdf8, #818cf8, #c084fc);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
          }
          p {
            font-size: 18px;
            line-height: 1.6;
            color: #94a3b8;
            margin-bottom: 28px;
          }
          .pill-group {
            display: flex;
            gap: 12px;
          }
          .pill {
            padding: 8px 16px;
            border-radius: 8px;
            background: rgba(255, 255, 255, 0.06);
            border: 1px solid rgba(255, 255, 255, 0.12);
            font-size: 14px;
            font-weight: 600;
            color: #e2e8f0;
          }
          .pill.active {
            background: #38bdf8;
            color: #07101d;
            border-color: #38bdf8;
          }
          .popup-wrapper {
            z-index: 2;
            filter: drop-shadow(0 20px 40px rgba(0,0,0,0.85));
            border-radius: 18px;
            border: 1px solid rgba(255, 255, 255, 0.12);
            overflow: hidden;
            width: 320px;
          }
          .popup-wrapper img {
            width: 100%;
            display: block;
          }
        </style>
      </head>
      <body>
        <div class="glow-orb"></div>
        <div class="content">
          <div class="badge">Official Microsoft Edge Add-on</div>
          <h1>UltraWide <span>Video Fill Pro</span></h1>
          <p>Fill your ultrawide screen with zero black bars. One-click screen size presets (21:9, 32:9, 16:9, 16:10), GPU-accelerated sharpness & HDR dynamic range expansion, and global video brightness control.</p>
          <div class="pill-group">
            <span class="pill active">Auto Fit</span>
            <span class="pill">21:9 Ultrawide</span>
            <span class="pill">32:9 Super Ultrawide</span>
            <span class="pill">GPU HDR Boost</span>
          </div>
        </div>
        <div class="popup-wrapper">
          <img src="data:image/png;base64,${popupActiveBase64}" />
        </div>
      </body>
    </html>
    `
  );

} finally {
  await browser.close();
}

console.log('\n[Store-Packager] ✓ All Microsoft Edge Store assets and ZIP package successfully created in:');
console.log(releaseDir);
