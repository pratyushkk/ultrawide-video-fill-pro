# Microsoft Edge Add-ons Store Submission Guide
## UltraWide Video Fill Pro

This document provides step-by-step instructions, pre-filled metadata, and exact text to submit **UltraWide Video Fill Pro** to the **Microsoft Edge Add-ons Store** via the Microsoft Partner Center.

---

## 1. Quick File Reference

All submission files are already compiled, packaged, and ready inside your workspace:

| Asset | Location | Requirements Met |
|---|---|---|
| **Extension Package** | [`release/ultrawide-video-fill-pro-v1.0.0.zip`](file:///c:/Users/PRATYUSH/OneDrive/Desktop/Ultrawide%20video%20extension/release/ultrawide-video-fill-pro-v1.0.0.zip) | Manifest V3, root structure (`manifest.json` at root), production-minified |
| **Store Logo** | [`release/store-assets/store_logo_300x300.png`](file:///c:/Users/PRATYUSH/OneDrive/Desktop/Ultrawide%20video%20extension/release/store-assets/store_logo_300x300.png) | Exactly 300 x 300 PNG |
| **Screenshot 1** | [`release/store-assets/screenshot1_1click_screen_sizes_1280x800.png`](file:///c:/Users/PRATYUSH/OneDrive/Desktop/Ultrawide%20video%20extension/release/store-assets/screenshot1_1click_screen_sizes_1280x800.png) | 1280 x 800 PNG (1-Click Presets & Compact UI) |
| **Screenshot 2** | [`release/store-assets/screenshot2_gpu_sharpness_hdr_1280x800.png`](file:///c:/Users/PRATYUSH/OneDrive/Desktop/Ultrawide%20video%20extension/release/store-assets/screenshot2_gpu_sharpness_hdr_1280x800.png) | 1280 x 800 PNG (GPU Sharpness & HDR Boost) |
| **Screenshot 3** | [`release/store-assets/screenshot3_global_brightness_drm_1280x800.png`](file:///c:/Users/PRATYUSH/OneDrive/Desktop/Ultrawide%20video%20extension/release/store-assets/screenshot3_global_brightness_drm_1280x800.png) | 1280 x 800 PNG (Global Brightness & DRM Safe) |
| **Small Promo Tile** | [`release/store-assets/promo_tile_small_440x280.png`](file:///c:/Users/PRATYUSH/OneDrive/Desktop/Ultrawide%20video%20extension/release/store-assets/promo_tile_small_440x280.png) | 440 x 280 PNG |
| **Large Promo Tile** | [`release/store-assets/promo_tile_large_1400x560.png`](file:///c:/Users/PRATYUSH/OneDrive/Desktop/Ultrawide%20video%20extension/release/store-assets/promo_tile_large_1400x560.png) | 1400 x 560 PNG |
| **Privacy Policy** | [`PRIVACY_POLICY.md`](file:///c:/Users/PRATYUSH/OneDrive/Desktop/Ultrawide%20video%20extension/PRIVACY_POLICY.md) / [`PRIVACY_POLICY.html`](file:///c:/Users/PRATYUSH/OneDrive/Desktop/Ultrawide%20video%20extension/PRIVACY_POLICY.html) | Zero-telemetry, local processing only |

---

## 2. Step-by-Step Submission Process

### Step 1: Open Microsoft Partner Center
1. Navigate to: **[Microsoft Partner Center Developer Dashboard](https://partner.microsoft.com/dashboard/microsoftedge)**
2. Sign in with your Microsoft developer account (create one if you haven't already; registration for Edge Add-ons is free).
3. On the dashboard home, click **"Create new extension"**.

---

### Step 2: Upload the Extension Package (.zip)
1. Drag and drop or browse to select:
   `c:\Users\PRATYUSH\OneDrive\Desktop\Ultrawide video extension\release\ultrawide-video-fill-pro-v1.0.0.zip`
2. The Microsoft portal will validate the package.
3. Verification checks:
   - Manifest V3: **Passed**
   - Root `manifest.json`: **Passed**
   - Icon resolutions (16, 32, 48, 128): **Passed**
4. Click **Continue**.

---

### Step 3: Fill in "Properties"
- **Category:** `Photos & video` (Secondary alternative: `Entertainment`)
- **Support Contact / URL:** `https://github.com/pratyushkk/ultrawide-video-fill-pro/issues`
- **Privacy Policy URL:** `https://github.com/pratyushkk/ultrawide-video-fill-pro/blob/main/PRIVACY_POLICY.md`
- **Website URL (Optional):** `https://github.com/pratyushkk/ultrawide-video-fill-pro`
- **Content Rating:** Everyone / General Audience
- **Adult content:** No

---

### Step 4: Fill in "Store Listing" (English)

Copy and paste the exact fields below:

#### Extension Name:
```text
UltraWide Video Fill Pro
```

#### Short Description / Summary (115 characters):
```text
Eliminate black bars on ultrawide monitors. 1-click aspect ratio presets, GPU sharpness, HDR boost & brightness.
```

#### Detailed Description:
```markdown
Transform your video watching experience on ultrawide and super ultrawide monitors!

UltraWide Video Fill Pro eliminates annoying black bars (pillarboxing and letterboxing) across all your favorite streaming platforms and video websites. Designed with a sleek, compact dropdown control panel, it gives you instant, 1-click control over aspect ratios, zoom, brightness, and GPU-powered visual enhancements.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ KEY FEATURES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚡ 1-Click Screen Aspect Ratio Presets
Instantly snap video to match your monitor without tedious manual adjustments:
• 16:9 Standard widescreen
• 18:9 (2:1) Modern mobile / cinematic ratio
• 21:9 Ultrawide monitors (2560x1080, 3440x1440)
• 32:9 Super ultrawide / dual QHD displays (5120x1440)

🎯 Precision Crop & Zoom Slider
Fine-tune scaling from 50% to 200% with real-time feedback and an automatic AUTO center marker.

💎 GPU-Accelerated Sharpness
Restore crisp edge fidelity and clarity on scaled or lower-bitrate streams using real-time WebGPU / WebGL2 edge-contrast enhancement. Zero perceptible latency.

🌈 Real-Time HDR Boost
Dynamically enhance dynamic range, contrast, and color vibrancy for a deeper, more immersive picture on HDR and high-contrast monitors.

☀️ Global Brightness Slider & 1-Click Reset
Control video luminance effortlessly across all tabs. Includes a dedicated Reset button that instantly restores default monitor brightness (100%).

🔒 DRM Hardware-Safe Protection
Engineered with intelligent fallback logic for protected platforms (Netflix, Prime Video, Disney+ Hotstar). Automatically prevents black screens while maintaining flawless scaling and brightness controls.

⚡ Lightweight & Battery-Friendly
Built with efficiency first:
• Zero background polling
• Hardware-accelerated CSS & shader pipelines
• Minimal CPU, RAM, and GPU footprint

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⌨️ DEFAULT KEYBOARD SHORTCUTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Alt + Shift + F : Zoom to Fill / Toggle
• Alt + Shift + R : Reset to Original

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔒 PRIVACY & ZERO DATA COLLECTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
UltraWide Video Fill Pro respects your privacy.
• Zero telemetry, trackers, or analytics.
• 100% local client-side processing.
• Preferences are saved only in your local browser storage.
```

#### Search Terms / Keywords (up to 20 terms):
```text
ultrawide, video fill, 21:9, 32:9, aspect ratio, zoom to fill, crop, black bars, hdr, sharpness, brightness, video enhancer, youtube ultrawide, netflix ultrawide, cinema crop
```

---

### Step 5: Upload Graphical Assets

In the **Store Listing Visuals** section, upload the generated files:

1. **Store Logo (300 x 300 PNG):**
   - Browse: `release/store-assets/store_logo_300x300.png`
2. **Screenshots (1280 x 800 PNG):**
   - Screenshot 1: `release/store-assets/screenshot1_1click_screen_sizes_1280x800.png` (Title: 1-Click Screen Sizes & Compact Panel)
   - Screenshot 2: `release/store-assets/screenshot2_gpu_sharpness_hdr_1280x800.png` (Title: GPU-Accelerated Sharpness & HDR Boost)
   - Screenshot 3: `release/store-assets/screenshot3_global_brightness_drm_1280x800.png` (Title: Global Brightness Control & DRM Safe)
3. **Promotional Tiles (Optional but strongly recommended for store featuring):**
   - Small promo tile (440 x 280): `release/store-assets/promo_tile_small_440x280.png`
   - Large promo tile (1400 x 560): `release/store-assets/promo_tile_large_1400x560.png`

---

### Step 6: Notes for Certification (Reviewer Instructions)

Microsoft reviewers require explicit justifications for permissions. Copy and paste the following into the **Notes for Certification** text box:

```text
Dear Microsoft Edge Review Team,

UltraWide Video Fill Pro is an accessibility and display utility that scales HTML5 video playback to fit 21:9 and 32:9 ultrawide monitors and provides local GPU video enhancements.

PERMISSION JUSTIFICATIONS:
1. host_permissions: ["<all_urls>"]
The extension is designed to scale HTML5 <video> elements on any user-visited site where video playback occurs (e.g., YouTube, Vimeo, educational portals, video sharing sites). It only manipulates the video DOM container and does not access, read, or transmit any user browsing data, cookies, or page contents.

2. permissions: ["storage"]
Used strictly via chrome.storage.local to persist the user's local display preferences (such as global brightness percentage, preferred aspect ratio preset, and GPU enhancement toggles) on their local machine.

3. permissions: ["activeTab", "scripting"]
Used to query video dimensions and apply styling transforms to the video element when the user opens the popup or triggers a keyboard shortcut.

DRM & GPU COMPLIANCE:
On DRM-protected sites (e.g. Netflix, Prime Video), the extension automatically detects protected media and disables canvas-based shader operations, applying non-destructive CSS hardware transforms to prevent any black-screen playback interruption.

HOW TO TEST:
1. Open YouTube or any public video website and start playing any 16:9 video.
2. Click the UltraWide Video Fill Pro extension icon in the toolbar.
3. Click the "21:9" or "32:9" preset button: the video will smoothly zoom to fill the container without black bars.
4. Adjust the "Brightness" slider: observe the luminance adjust smoothly; click the reset button next to it to return to 100%.
5. Click "Sharpness" or "HDR Boost" toggles: observe the real-time GPU enhancement.
6. Press Alt+Shift+R or click "Reset" to return the video to default playback.

Thank you for your review!
```

---

### Step 7: Submit for Review
1. Review all sections to ensure checkmarks appear on all tabs (**Package**, **Properties**, **Store listings**, **Availability**).
2. Click **Submit**.
3. Typical review turnaround time for Microsoft Edge Add-ons is **1 to 3 business days**.
