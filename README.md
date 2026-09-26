# UltraWide Video Fill Pro 🎬🖥️

[![Manifest V3](https://img.shields.io/badge/Manifest-V3-brightgreen.svg)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![GPU-Accelerated](https://img.shields.io/badge/GPU-WebGPU%20%7C%20WebGL2-orange.svg)](#)

> **UltraWide Video Fill Pro** eliminates black bars (pillarboxing and letterboxing) on 21:9 and 32:9 ultrawide monitors with one click. Features GPU-accelerated video sharpening, dynamic HDR Boost, global brightness control, and DRM-safe playback protection.

---

## ✨ Features

- **⚡ 1-Click Screen Sizes:** Instant presets for `16:9`, `18:9 (2:1)`, `21:9` (Ultrawide), and `32:9` (Super Ultrawide / Dual QHD).
- **🎯 Precise Crop / Zoom:** Fine-tuned scaling from 50% to 200% with intuitive AUTO center marker.
- **💎 GPU-Accelerated Sharpness:** WebGPU & WebGL2 adaptive edge-enhancement pipeline for crystal-clear playback on scaled video.
- **🌈 Real-Time HDR Boost:** Dynamic range expansion and color vibrancy enhancement with zero perceptible latency.
- **☀️ Global Brightness Control & Reset:** Adjust video luminance seamlessly across all tabs with an instant 1-click reset to default (100%).
- **🔒 DRM Hardware-Safe Mode:** Intelligent detection for protected streaming platforms (Netflix, Prime Video, Disney+ Hotstar) preventing black screens.
- **🎛️ Compact Premium UI:** Clean, distraction-free dropdown control panel.
- **⌨️ Keyboard Shortcuts:**
  - `Alt + Shift + F`: Zoom to Fill / Toggle
  - `Alt + Shift + R`: Reset video transformation

---

## 🚀 Installation & Development

### 1. Prerequisites
- Node.js (v18+ recommended)
- npm

### 2. Clone & Install Dependencies
```bash
git clone https://github.com/<your-username>/ultrawide-video-fill-pro.git
cd ultrawide-video-fill-pro
npm install
```

### 3. Build the Extension
```bash
npm run build
```
This builds the production extension bundle into the `dist/` directory.

### 4. Load into Browser (Chrome / Edge / Brave / Opera)
1. Open your browser and navigate to `chrome://extensions/` or `edge://extensions/`.
2. Enable **Developer mode** (toggle in the top-right or sidebar).
3. Click **"Load unpacked"**.
4. Select the `dist/` folder from this project directory.

---

## 📦 Store Packaging
To generate the production `.zip` package and graphical assets for Chrome Web Store & Microsoft Edge Add-ons:
```bash
node scripts/prepare-store-package.mjs
```
The output package and high-resolution store banners/screenshots are created inside `release/`.

---

## 🔒 Privacy Policy
UltraWide Video Fill Pro respects your privacy:
- **Zero data collection or telemetry**
- **100% local client-side GPU and CSS processing**
- All settings are saved only in your local browser profile (`chrome.storage.local`).

See [PRIVACY_POLICY.md](PRIVACY_POLICY.md) for full details.

---

## 📄 License
This project is open-source under the [MIT License](LICENSE).
