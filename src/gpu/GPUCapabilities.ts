import type { GPUCapabilitiesResult, GPUBackendType } from './types';

let cachedCapabilities: GPUCapabilitiesResult | null = null;

export class GPUCapabilities {
  /**
   * Detect system GPU and display capabilities.
   * Caches result to avoid redundant canvas/device creation.
   */
  static async detect(forceRefresh = false): Promise<GPUCapabilitiesResult> {
    if (cachedCapabilities && !forceRefresh) {
      return cachedCapabilities;
    }

    let webgpuSupported = false;
    let webgl2Supported = false;
    let hdrDisplaySupported = false;

    // 1. Check WebGPU
    try {
      if (typeof navigator !== 'undefined' && 'gpu' in navigator && (navigator as any).gpu) {
        const adapter = await (navigator as any).gpu.requestAdapter({
          powerPreference: 'high-performance'
        });
        if (adapter) {
          // Verify device creation
          const device = await adapter.requestDevice();
          if (device) {
            webgpuSupported = true;
            // Clean up test device
            if (typeof device.destroy === 'function') {
              device.destroy();
            }
          }
        }
      }
    } catch (e) {
      console.warn('[UWVF-GPU] WebGPU detection failed or not supported:', e);
      webgpuSupported = false;
    }

    // 2. Check WebGL2
    try {
      if (typeof document !== 'undefined') {
        const testCanvas = document.createElement('canvas');
        testCanvas.width = 1;
        testCanvas.height = 1;
        const gl = testCanvas.getContext('webgl2', {
          powerPreference: 'high-performance',
          failIfMajorPerformanceCaveat: false
        });
        if (gl) {
          webgl2Supported = true;
          // Clean up context if loseContext extension is supported
          const loseContext = gl.getExtension('WEBGL_lose_context');
          if (loseContext) {
            loseContext.loseContext();
          }
        }
      }
    } catch (e) {
      console.warn('[UWVF-GPU] WebGL2 detection failed:', e);
      webgl2Supported = false;
    }

    // 3. Check HDR Display Support
    try {
      if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
        const highDynamicRange = window.matchMedia('(dynamic-range: high)').matches;
        const wideGamutP3 = window.matchMedia('(color-gamut: p3)').matches;
        hdrDisplaySupported = highDynamicRange || wideGamutP3;
      }
    } catch (e) {
      console.warn('[UWVF-GPU] HDR display query failed:', e);
      hdrDisplaySupported = false;
    }

    let preferredBackend: GPUBackendType = 'unavailable';
    if (webgpuSupported) {
      preferredBackend = 'webgpu';
    } else if (webgl2Supported) {
      preferredBackend = 'webgl2';
    }

    cachedCapabilities = {
      webgpuSupported,
      webgl2Supported,
      hdrDisplaySupported,
      preferredBackend
    };

    return cachedCapabilities;
  }

  /**
   * Synchronous quick check based on cached or basic API presence.
   */
  static isAnyGPUSupported(): boolean {
    if (cachedCapabilities) {
      return cachedCapabilities.webgpuSupported || cachedCapabilities.webgl2Supported;
    }
    return (
      (typeof navigator !== 'undefined' && 'gpu' in navigator) ||
      (typeof WebGL2RenderingContext !== 'undefined')
    );
  }
}
