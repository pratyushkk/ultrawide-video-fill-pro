import type { GPURendererBackend, GPUBackendType, UniformData, GPUDiagnostics } from './types';
import { GPUCapabilities } from './GPUCapabilities';
import { PerformanceMonitor } from './PerformanceMonitor';
import { WebGPUBackend } from './WebGPUBackend';
import { WebGL2Backend } from './WebGL2Backend';

export class VideoGPUProcessor {
  private video: HTMLVideoElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private backend: GPURendererBackend | null = null;
  private monitor: PerformanceMonitor = new PerformanceMonitor();

  private sharpness = 0; // 0 to 100
  private hdrBoost = 0;  // 0 to 100
  private brightness = 100; // 0 to 200, 100 is normal
  private qualityPreference = 1; // 0: low, 1: balanced, 2: quality
  private abMode = 0; // 0: normal, 1: split-screen

  private isRunning = false;
  private isBypassed = true;
  private useDirectCompositor = false;
  private rVfcId: number | null = null;
  private rafId: number | null = null;
  private isSupported = false;
  private activeBackendType: GPUBackendType = 'bypassed';

  private boundOnVideoFrame: (now: DOMHighResTimeStamp, metadata?: any) => void;
  private boundOnPlay: () => void;
  private boundOnPause: () => void;
  private boundOnVisibilityChange: () => void;

  constructor() {
    this.boundOnVideoFrame = this.onFrame.bind(this);
    this.boundOnPlay = () => this.startLoop();
    this.boundOnPause = () => this.stopLoop();
    this.boundOnVisibilityChange = () => {
      if (document.hidden) {
        this.stopLoop();
      } else if (!this.isBypassed && !this.useDirectCompositor && this.video && !this.video.paused) {
        this.startLoop();
      }
    };

    document.addEventListener('visibilitychange', this.boundOnVisibilityChange);
  }

  /**
   * Detects if the current video stream uses Encrypted Media Extensions (Widevine DRM)
   * or is playing on a known DRM streaming service (JioCinema, Hotstar, Prime Video, Netflix, etc.)
   */
  public isDRMProtected(): boolean {
    if (!this.video) return false;

    // 1. Direct EME MediaKeys presence
    if (this.video.mediaKeys || (this.video as any).webkitMediaKeys) {
      return true;
    }

    // 2. Known DRM-protected streaming provider domains
    if (typeof window !== 'undefined' && window.location) {
      const host = window.location.hostname.toLowerCase();
      if (
        host.includes('hotstar') ||
        host.includes('primevideo') ||
        host.includes('amazon.') ||
        host.includes('netflix') ||
        host.includes('jiocinema') ||
        host.includes('disneyplus') ||
        host.includes('hulu') ||
        host.includes('hbomax') ||
        host.includes('max.com') ||
        host.includes('peacocktv') ||
        host.includes('paramountplus') ||
        host.includes('appletv') ||
        host.includes('sonyliv') ||
        host.includes('zee5')
      ) {
        return true;
      }
    }

    return false;
  }

  public async attach(video: HTMLVideoElement): Promise<boolean> {
    if (this.video === video && this.canvas) {
      return true;
    }

    this.detach();
    this.video = video;

    // Check DRM status
    this.useDirectCompositor = this.isDRMProtected();

    // Create GPU canvas for non-DRM sites (like YouTube)
    const canvas = document.createElement('canvas');
    canvas.className = 'uwvf-gpu-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.position = 'absolute';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '1';
    canvas.style.display = 'none'; // Initially bypassed
    canvas.style.transformOrigin = 'center center';

    // Insert canvas into video's parent container
    if (video.parentElement) {
      video.parentElement.appendChild(canvas);
    } else {
      document.body.appendChild(canvas);
    }
    this.canvas = canvas;

    // Listen to video lifecycle
    video.addEventListener('play', this.boundOnPlay);
    video.addEventListener('playing', this.boundOnPlay);
    video.addEventListener('pause', this.boundOnPause);
    video.addEventListener('ended', this.boundOnPause);

    // If DRM is detected upfront, run in Direct GPU Compositor Mode
    if (this.useDirectCompositor) {
      this.isSupported = true;
      this.activeBackendType = 'direct-gpu';
      this.monitor.setBackend('direct-gpu');
      this.applyDirectFilters();
      return true;
    }

    // Otherwise, initialize WebGPU / WebGL2 canvas backend
    const success = await this.initBackend();
    this.syncCanvasLayout();

    if (!this.isBypassed && !video.paused) {
      this.startLoop();
    }

    return success;
  }

  private async initBackend(): Promise<boolean> {
    if (!this.canvas) return false;

    const caps = await GPUCapabilities.detect();
    this.isSupported = caps.webgpuSupported || caps.webgl2Supported;

    if (!this.isSupported) {
      this.activeBackendType = 'unavailable';
      this.monitor.setBackend('unavailable');
      return false;
    }

    // Try WebGPU first
    if (caps.webgpuSupported) {
      const webgpu = new WebGPUBackend(() => this.handleDeviceLost());
      const ok = await webgpu.initialize(this.canvas);
      if (ok) {
        this.backend = webgpu;
        this.activeBackendType = 'webgpu';
        this.monitor.setBackend('webgpu');
        return true;
      }
    }

    // Fallback to WebGL2
    if (caps.webgl2Supported) {
      const webgl2 = new WebGL2Backend();
      const ok = await webgl2.initialize(this.canvas);
      if (ok) {
        this.backend = webgl2;
        this.activeBackendType = 'webgl2';
        this.monitor.setBackend('webgl2');
        return true;
      }
    }

    // Fallback to Direct GPU Compositor
    this.useDirectCompositor = true;
    this.activeBackendType = 'direct-gpu';
    this.monitor.setBackend('direct-gpu');
    return true;
  }

  private async handleDeviceLost(): Promise<void> {
    console.warn('[UWVF-GPU] Device lost, attempting fallback recovery...');
    if (this.backend) {
      this.backend.destroy();
      this.backend = null;
    }

    // Fallback to WebGL2 on device loss
    if (this.canvas) {
      const webgl2 = new WebGL2Backend();
      const ok = await webgl2.initialize(this.canvas);
      if (ok) {
        this.backend = webgl2;
        this.activeBackendType = 'webgl2';
        this.monitor.setBackend('webgl2');
        return;
      }
    }

    // Safe fallback to Direct GPU Compositor
    this.useDirectCompositor = true;
    this.activeBackendType = 'direct-gpu';
    this.applyDirectFilters();
  }

  public setEffects(sharpness: number, hdrBoost: number, brightness?: number): void {
    this.sharpness = Math.max(0, Math.min(100, sharpness));
    this.hdrBoost = Math.max(0, Math.min(100, hdrBoost));
    if (brightness !== undefined) {
      this.brightness = Math.max(0, Math.min(200, brightness));
    }

    // Dynamically check if video became DRM-protected (e.g. MediaKeys attached after page load)
    if (this.isDRMProtected() && !this.useDirectCompositor) {
      this.useDirectCompositor = true;
      this.stopLoop();
      if (this.canvas) {
        this.canvas.style.display = 'none';
      }
      this.activeBackendType = 'direct-gpu';
      this.monitor.setBackend('direct-gpu');
    }

    const shouldBypass = this.sharpness === 0 && this.hdrBoost === 0 && this.brightness === 100;
    this.setBypassed(shouldBypass);

    this.applyCurrentFilters();
  }

  public setBrightness(brightness: number): void {
    this.brightness = Math.max(0, Math.min(200, brightness));
    const shouldBypass = this.sharpness === 0 && this.hdrBoost === 0 && this.brightness === 100;
    this.setBypassed(shouldBypass);
    this.applyCurrentFilters();
  }

  public getBrightness(): number {
    return this.brightness;
  }

  private applyCurrentFilters(): void {
    if (this.useDirectCompositor) {
      this.applyDirectFilters();
    } else {
      const userBright = (this.brightness / 100.0).toFixed(3);
      const filterStr = this.brightness !== 100 ? `brightness(${userBright})` : '';

      if (this.canvas) {
        this.canvas.style.filter = filterStr;
      }
      if (this.video) {
        this.video.style.filter = filterStr;
      }
      this.updateUniforms();
    }
  }

  public setQuality(quality: number): void {
    this.qualityPreference = Math.max(0, Math.min(2, quality));
    if (!this.useDirectCompositor) {
      this.updateUniforms();
    }
  }

  public setSplitScreen(enabled: boolean): void {
    this.abMode = enabled ? 1 : 0;
    if (!this.useDirectCompositor) {
      this.updateUniforms();
    }
  }

  private setBypassed(bypass: boolean): void {
    if (this.isBypassed === bypass) return;
    this.isBypassed = bypass;

    if (bypass) {
      // Complete bypass: stop loop, hide canvas, clear video filter
      this.stopLoop();
      if (this.canvas) {
        this.canvas.style.display = 'none';
        this.canvas.style.filter = '';
      }
      if (this.video) {
        this.video.style.filter = '';
      }
      this.monitor.setBackend('bypassed');
    } else {
      // Active mode
      if (this.useDirectCompositor) {
        if (this.canvas) {
          this.canvas.style.display = 'none';
        }
        this.applyDirectFilters();
        this.monitor.setBackend('direct-gpu');
      } else {
        const needsShader = this.sharpness > 0 || this.hdrBoost > 0;
        if (this.canvas) {
          this.canvas.style.display = needsShader ? 'block' : 'none';
        }
        this.monitor.setBackend(needsShader ? (this.backend ? this.backend.type : 'unavailable') : 'direct-gpu');
        if (needsShader && this.video && !this.video.paused) {
          this.startLoop();
        } else {
          this.stopLoop();
        }
      }
    }
  }

  /**
   * Ensures the dynamic SVG unsharp convolution filter definition is present in the DOM.
   */
  private ensureSvgFilter(): void {
    if (document.getElementById('uwvf-svg-filters')) return;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'uwvf-svg-filters';
    svg.setAttribute('style', 'position: absolute; width: 0; height: 0; pointer-events: none; overflow: hidden;');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = `
      <defs>
        <filter id="uwvf-sharpness-filter" x="-10%" y="-10%" width="120%" height="120%">
          <feConvolveMatrix id="uwvf-sharpness-matrix" order="3" preserveAlpha="true" kernelMatrix="0 0 0 0 1 0 0 0 0" />
        </filter>
      </defs>
    `;
    (document.body || document.documentElement).appendChild(svg);
  }

  /**
   * Applies GPU hardware-accelerated filters directly to the <video> element.
   * Works on 100% of websites including DRM-protected EME videos (Hotstar, Prime Video, Netflix)
   * with zero black screens and zero security errors.
   */
  private applyDirectFilters(): void {
    if (!this.video) return;

    if (this.sharpness === 0 && this.hdrBoost === 0 && this.brightness === 100) {
      this.video.style.filter = '';
      return;
    }

    this.ensureSvgFilter();
    const filters: string[] = [];

    // 1. Sharpness via SVG 3x3 unsharp convolution matrix
    if (this.sharpness > 0) {
      const k = (this.sharpness / 100.0) * 0.65;
      const center = (1 + 4 * k).toFixed(3);
      const edge = (-k).toFixed(3);
      const matrix = `0 ${edge} 0 ${edge} ${center} ${edge} 0 ${edge} 0`;
      
      const matrixEl = document.getElementById('uwvf-sharpness-matrix');
      if (matrixEl) {
        matrixEl.setAttribute('kernelMatrix', matrix);
      }
      filters.push('url("#uwvf-sharpness-filter")');
    }

    // 2. HDR Dynamic Range Boost + User Brightness via hardware compositor filters
    const userBright = this.brightness / 100.0;
    if (this.hdrBoost > 0) {
      const hdr = this.hdrBoost / 100.0;
      const contrast = (1 + hdr * 0.28).toFixed(3);
      const b = (userBright * (1 + hdr * 0.05)).toFixed(3);
      const saturate = (1 + hdr * 0.32).toFixed(3);
      filters.push(`contrast(${contrast}) brightness(${b}) saturate(${saturate})`);
    } else if (this.brightness !== 100) {
      filters.push(`brightness(${userBright.toFixed(3)})`);
    }

    this.video.style.filter = filters.join(' ');
  }

  public syncCanvasLayout(): void {
    if (this.useDirectCompositor || !this.video || !this.canvas) return;

    const vWidth = this.video.videoWidth || this.video.clientWidth || 1920;
    const vHeight = this.video.videoHeight || this.video.clientHeight || 1080;

    // Set internal canvas resolution to video's natural resolution
    if (this.canvas.width !== vWidth || this.canvas.height !== vHeight) {
      this.canvas.width = vWidth;
      this.canvas.height = vHeight;
      if (this.backend) {
        this.backend.resize(vWidth, vHeight);
      }
      this.monitor.setResolution(vWidth, vHeight);
    }

    // Mirror video position and CSS transforms onto canvas
    const rect = this.video.getBoundingClientRect();
    const parentRect = this.video.parentElement?.getBoundingClientRect() || { left: 0, top: 0 };

    this.canvas.style.left = `${this.video.offsetLeft || (rect.left - parentRect.left)}px`;
    this.canvas.style.top = `${this.video.offsetTop || (rect.top - parentRect.top)}px`;
    this.canvas.style.width = `${this.video.clientWidth || rect.width}px`;
    this.canvas.style.height = `${this.video.clientHeight || rect.height}px`;

    // Mirror Zoom to Fill transforms
    this.canvas.style.transform = this.video.style.transform || '';
    this.canvas.style.transformOrigin = this.video.style.transformOrigin || 'center center';
    this.canvas.style.transition = this.video.style.transition || '';
  }

  private startLoop(): void {
    if (this.isRunning || this.isBypassed || this.useDirectCompositor || !this.video || !this.backend) {
      return;
    }
    this.isRunning = true;
    this.scheduleNextFrame();
  }

  private stopLoop(): void {
    this.isRunning = false;
    if (this.rVfcId !== null && this.video && 'cancelVideoFrameCallback' in this.video) {
      (this.video as any).cancelVideoFrameCallback(this.rVfcId);
      this.rVfcId = null;
    }
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private scheduleNextFrame(): void {
    if (!this.isRunning || !this.video) return;

    if ('requestVideoFrameCallback' in this.video) {
      this.rVfcId = (this.video as any).requestVideoFrameCallback(this.boundOnVideoFrame);
    } else {
      this.rafId = requestAnimationFrame(this.boundOnVideoFrame);
    }
  }

  private onFrame(now: DOMHighResTimeStamp): void {
    if (!this.isRunning || this.isBypassed || this.useDirectCompositor || !this.video || !this.backend) {
      return;
    }

    // Keep layout synced if video resized
    this.syncCanvasLayout();

    const startTime = this.monitor.recordFrameStart();
    const uniforms = this.getUniformData();

    try {
      // Render GPU frame
      this.backend.render(this.video, uniforms);
    } catch (e) {
      // If DRM or cross-origin security error occurs during render, switch instantly to Direct GPU Compositor Mode
      console.warn('[UWVF-GPU] Canvas render failed (DRM or security constraint). Switching to Direct GPU mode:', e);
      this.useDirectCompositor = true;
      this.stopLoop();
      if (this.canvas) {
        this.canvas.style.display = 'none';
      }
      this.activeBackendType = 'direct-gpu';
      this.monitor.setBackend('direct-gpu');
      this.applyDirectFilters();
      return;
    }

    this.monitor.recordFrameEnd(startTime);
    this.scheduleNextFrame();
  }

  private getUniformData(): UniformData {
    const vWidth = this.video?.videoWidth || 1920;
    const vHeight = this.video?.videoHeight || 1080;

    let activePasses = 0;
    if (this.sharpness > 0) activePasses++;
    if (this.hdrBoost > 0) activePasses++;
    this.monitor.setActivePasses(activePasses);

    return {
      sharpness: this.sharpness / 100.0,
      hdrBoost: this.hdrBoost / 100.0,
      texWidth: vWidth,
      texHeight: vHeight,
      quality: this.qualityPreference,
      abMode: this.abMode
    };
  }

  private updateUniforms(): void {
    if (this.backend) {
      this.backend.updateUniforms(this.getUniformData());
    }
  }

  public getDiagnostics(): GPUDiagnostics {
    return this.monitor.getDiagnostics(this.isSupported);
  }

  public getActiveBackend(): GPUBackendType {
    if (this.isBypassed) return 'bypassed';
    return this.activeBackendType;
  }

  public getSharpness(): number {
    return this.sharpness;
  }

  public getHdrBoost(): number {
    return this.hdrBoost;
  }

  public detach(): void {
    this.stopLoop();
    this.setBypassed(true);

    if (this.video) {
      this.video.removeEventListener('play', this.boundOnPlay);
      this.video.removeEventListener('playing', this.boundOnPlay);
      this.video.removeEventListener('pause', this.boundOnPause);
      this.video.removeEventListener('ended', this.boundOnPause);
      this.video.style.filter = '';
      this.video = null;
    }

    if (this.canvas) {
      this.canvas.remove();
      this.canvas = null;
    }

    if (this.backend) {
      this.backend.destroy();
      this.backend = null;
    }

    this.monitor.reset();
  }

  public destroy(): void {
    document.removeEventListener('visibilitychange', this.boundOnVisibilityChange);
    this.detach();
  }
}
