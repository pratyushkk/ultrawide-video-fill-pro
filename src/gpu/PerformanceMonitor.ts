import type { GPUDiagnostics, GPUBackendType } from './types';

export class PerformanceMonitor {
  private lastFrameTimestamp = 0;
  private frameCount = 0;
  private lastFpsCalcTime = 0;
  private currentFps = 0;
  private lastFrameDurationMs = 0;
  private avgFrameDurationMs = 0;
  private droppedFrames = 0;
  private expectedIntervalMs = 1000 / 30; // default 30fps video
  private backendType: GPUBackendType = 'bypassed';
  private resolution = '0x0';
  private activePasses = 0;

  constructor() {
    this.reset();
  }

  public reset(): void {
    this.lastFrameTimestamp = 0;
    this.frameCount = 0;
    this.lastFpsCalcTime = performance.now();
    this.currentFps = 0;
    this.lastFrameDurationMs = 0;
    this.avgFrameDurationMs = 0;
    this.droppedFrames = 0;
    this.activePasses = 0;
  }

  public setBackend(backend: GPUBackendType): void {
    this.backendType = backend;
  }

  public setResolution(width: number, height: number): void {
    this.resolution = `${width}x${height}`;
  }

  public setExpectedFps(fps: number): void {
    if (fps > 10 && fps <= 120) {
      this.expectedIntervalMs = 1000 / fps;
    }
  }

  public setActivePasses(passes: number): void {
    this.activePasses = passes;
  }

  public recordFrameStart(): number {
    return performance.now();
  }

  public recordFrameEnd(startTime: number): void {
    const now = performance.now();
    this.lastFrameDurationMs = Math.max(0, now - startTime);

    // Exponential moving average for processing time
    if (this.avgFrameDurationMs === 0) {
      this.avgFrameDurationMs = this.lastFrameDurationMs;
    } else {
      this.avgFrameDurationMs = this.avgFrameDurationMs * 0.9 + this.lastFrameDurationMs * 0.1;
    }

    // Frame interval check for dropped frames
    if (this.lastFrameTimestamp > 0) {
      const delta = now - this.lastFrameTimestamp;
      if (delta > this.expectedIntervalMs * 1.85) {
        const missed = Math.floor(delta / this.expectedIntervalMs) - 1;
        this.droppedFrames += Math.max(1, missed);
      }
    }
    this.lastFrameTimestamp = now;

    // FPS calculation every 500ms
    this.frameCount++;
    const elapsed = now - this.lastFpsCalcTime;
    if (elapsed >= 500) {
      this.currentFps = Math.round((this.frameCount * 1000) / elapsed);
      this.frameCount = 0;
      this.lastFpsCalcTime = now;
    }
  }

  public getDiagnostics(isSupported: boolean): GPUDiagnostics {
    return {
      backend: this.backendType,
      isSupported,
      fps: this.currentFps,
      frameTimeMs: Math.round(this.avgFrameDurationMs * 100) / 100,
      droppedFrames: this.droppedFrames,
      resolution: this.resolution,
      activePasses: this.activePasses
    };
  }

  public getSuggestedQuality(): number {
    // If frame processing time takes > 14ms (approaching 60fps limit), suggest lower quality
    if (this.avgFrameDurationMs > 14) {
      return 0; // performance
    }
    if (this.avgFrameDurationMs > 7) {
      return 1; // balanced
    }
    return 2; // quality
  }
}
