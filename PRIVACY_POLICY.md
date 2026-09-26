# Privacy Policy for UltraWide Video Fill Pro

**Effective Date:** September 27, 2026  
**Last Updated:** September 27, 2026

UltraWide Video Fill Pro ("the Extension", "we", "our") is committed to protecting your privacy. This Privacy Policy explains our practices regarding user information and data security.

---

### 1. Zero Data Collection & Storage
- **No Personal Information:** UltraWide Video Fill Pro does **NOT** collect, transmit, store, or sell any personal information, browsing history, user credentials, IP addresses, or device identifiers.
- **No Analytics or Telemetry:** The Extension contains **NO** third-party trackers, analytics scripts (such as Google Analytics or Mixpanel), advertising SDKs, or background telemetry.

---

### 2. Local Device Processing Only
- **Client-Side Video Transformations:** All video aspect ratio adjustments, CSS scaling, GPU-accelerated sharpening, HDR boost filters, and brightness adjustments are executed **100% locally on your device's browser and GPU**.
- **No Video Interception or Streaming:** Video frames and playback data never leave your computer and are never transmitted to any external server or cloud service.

---

### 3. Local Storage Usage
The Extension utilizes the browser's native `chrome.storage.local` API strictly to save your local viewing preferences:
- Selected aspect ratio presets (e.g., 21:9, 32:9, 16:9)
- Custom zoom/crop percentages
- Global brightness preference
- GPU enhancement toggles (Sharpness & HDR Boost)
- Optional per-site auto-fill toggles

These settings remain entirely within your local browser profile and are never synced to any remote servers.

---

### 4. Permissions & Justification
UltraWide Video Fill Pro requests the following browser permissions solely to fulfill its intended core functionality:
- **`host_permissions: ["<all_urls>"]`**: Necessary to detect and scale HTML5 video elements across any website you choose to visit (e.g., streaming services, video sharing platforms, educational websites). The extension never reads your page content or private data.
- **`storage`**: Used exclusively to store your preferred video zoom, brightness, and GPU filter levels locally on your device.
- **`activeTab` & `scripting`**: Used to apply styling and video transformations to the active video player when you trigger the extension popup or keyboard shortcuts.

---

### 5. Third-Party Services & DRM Content
- The Extension respects Digital Rights Management (DRM). On protected platforms (e.g., Netflix, Prime Video, Disney+ Hotstar), the Extension operates in a hardware-safe mode that applies non-intrusive CSS transforms and bypasses direct canvas capturing to safeguard content playback.
- No third-party APIs or external web services are contacted at any time.

---

### 6. Updates & Inquiries
We may update this Privacy Policy from time to time. Any changes will be reflected directly in this document and on our repository.

If you have questions regarding this policy or the extension's privacy practices, please contact us or open an issue on our project support page:
- **GitHub Repository:** https://github.com/pratyushkk/ultrawide-video-fill-pro
- **Support / Issues:** https://github.com/pratyushkk/ultrawide-video-fill-pro/issues
