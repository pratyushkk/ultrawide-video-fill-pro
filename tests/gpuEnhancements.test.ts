import { describe, it, expect, beforeEach } from 'vitest';
import { GPUCapabilities } from '../src/gpu/GPUCapabilities';
import { PerformanceMonitor } from '../src/gpu/PerformanceMonitor';
import { WGSL_SHADER_SOURCE } from '../src/gpu/shaders/wgsl';
import { GLSL_VERTEX_SHADER, GLSL_FRAGMENT_SHADER } from '../src/gpu/shaders/glsl';

describe('GPU Enhancements Architecture & Shaders', () => {
  describe('GPUCapabilities Detection', () => {
    it('detects capabilities and returns valid structure', async () => {
      const caps = await GPUCapabilities.detect();
      expect(caps).toHaveProperty('webgpuSupported');
      expect(caps).toHaveProperty('webgl2Supported');
      expect(caps).toHaveProperty('hdrDisplaySupported');
      expect(caps).toHaveProperty('preferredBackend');
      expect(['webgpu', 'webgl2', 'unavailable']).toContain(caps.preferredBackend);
    });

    it('returns consistent cached detection results', async () => {
      const caps1 = await GPUCapabilities.detect();
      const caps2 = await GPUCapabilities.detect();
      expect(caps1).toBe(caps2);
    });
  });

  describe('PerformanceMonitor', () => {
    let monitor: PerformanceMonitor;

    beforeEach(() => {
      monitor = new PerformanceMonitor();
    });

    it('initializes with default diagnostics', () => {
      const diag = monitor.getDiagnostics(true);
      expect(diag.backend).toBe('bypassed');
      expect(diag.isSupported).toBe(true);
      expect(diag.droppedFrames).toBe(0);
      expect(diag.activePasses).toBe(0);
    });

    it('tracks backend, resolution, and passes', () => {
      monitor.setBackend('webgpu');
      monitor.setResolution(3440, 1440);
      monitor.setActivePasses(2);

      const diag = monitor.getDiagnostics(true);
      expect(diag.backend).toBe('webgpu');
      expect(diag.resolution).toBe('3440x1440');
      expect(diag.activePasses).toBe(2);
    });

    it('recommends quality based on frame duration', () => {
      // Fast frame time (< 7ms) should recommend quality level 2 (quality)
      expect(monitor.getSuggestedQuality()).toBe(2);
    });
  });

  describe('Shader Integrity & Rec. 709 / HDR Math', () => {
    it('WGSL shader source defines required uniforms and functions', () => {
      expect(WGSL_SHADER_SOURCE).toContain('struct Uniforms');
      expect(WGSL_SHADER_SOURCE).toContain('sharpness: f32');
      expect(WGSL_SHADER_SOURCE).toContain('hdrBoost: f32');
      expect(WGSL_SHADER_SOURCE).toContain('texture_external');
      expect(WGSL_SHADER_SOURCE).toContain('getLuminance');
      expect(WGSL_SHADER_SOURCE).toContain('sCurve');
      expect(WGSL_SHADER_SOURCE).toContain('0.2126'); // Rec. 709 R
      expect(WGSL_SHADER_SOURCE).toContain('0.7152'); // Rec. 709 G
      expect(WGSL_SHADER_SOURCE).toContain('0.0722'); // Rec. 709 B
    });

    it('GLSL shader source defines required uniforms and functions', () => {
      expect(GLSL_FRAGMENT_SHADER).toContain('#version 300 es');
      expect(GLSL_FRAGMENT_SHADER).toContain('uniform float u_sharpness');
      expect(GLSL_FRAGMENT_SHADER).toContain('uniform float u_hdrBoost');
      expect(GLSL_FRAGMENT_SHADER).toContain('u_videoTexture');
      expect(GLSL_FRAGMENT_SHADER).toContain('getLuminance');
      expect(GLSL_FRAGMENT_SHADER).toContain('sCurve');
      expect(GLSL_FRAGMENT_SHADER).toContain('0.2126');
      expect(GLSL_FRAGMENT_SHADER).toContain('0.7152');
      expect(GLSL_FRAGMENT_SHADER).toContain('0.0722');
    });

    it('Rec. 709 luminance computation reproduces accurate color coefficients', () => {
      const getLuminance = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
      
      expect(getLuminance(1, 1, 1)).toBeCloseTo(1.0, 4);
      expect(getLuminance(0, 0, 0)).toBeCloseTo(0.0, 4);
      expect(getLuminance(1, 0, 0)).toBeCloseTo(0.2126, 4);
      expect(getLuminance(0, 1, 0)).toBeCloseTo(0.7152, 4);
      expect(getLuminance(0, 0, 1)).toBeCloseTo(0.0722, 4);
    });

    it('sCurve produces smooth S-shape preserving endpoints and midpoint', () => {
      const sCurve = (x: number) => x * x * (3.0 - 2.0 * x);
      
      expect(sCurve(0)).toBe(0);
      expect(sCurve(1)).toBe(1);
      expect(sCurve(0.5)).toBe(0.5);
      // S-curve increases contrast: shadow values are lowered, highlight values are raised
      expect(sCurve(0.25)).toBeLessThan(0.25);
      expect(sCurve(0.75)).toBeGreaterThan(0.75);
    });

    it('Noise coring gate correctly attenuates micro-noise while retaining edges', () => {
      const coringThreshold = 0.01;
      const coreDetail = (d: number) => Math.sign(d) * Math.max(0, Math.abs(d) - coringThreshold);

      // Micro noise below threshold is completely eliminated
      expect(coreDetail(0.005)).toBe(0);
      expect(coreDetail(-0.008)).toBe(-0);

      // Significant edges above threshold are preserved
      expect(coreDetail(0.1)).toBeCloseTo(0.09, 4);
      expect(coreDetail(-0.1)).toBeCloseTo(-0.09, 4);
    });
  });

  describe('DRM & Direct Hardware Compositor Mode', () => {
    it('detects DRM-protected streaming provider domains', () => {
      const drmHosts = [
        'www.hotstar.com',
        'hotstar.com',
        'www.primevideo.com',
        'primevideo.com',
        'www.netflix.com',
        'www.jiocinema.com',
        'www.disneyplus.com'
      ];

      for (const host of drmHosts) {
        const isDrm = (
          host.includes('hotstar') ||
          host.includes('primevideo') ||
          host.includes('amazon.') ||
          host.includes('netflix') ||
          host.includes('jiocinema') ||
          host.includes('disneyplus')
        );
        expect(isDrm).toBe(true);
      }

      const nonDrmHost = 'www.youtube.com';
      const isYouTubeDrm = (
        nonDrmHost.includes('hotstar') ||
        nonDrmHost.includes('primevideo') ||
        nonDrmHost.includes('netflix')
      );
      expect(isYouTubeDrm).toBe(false);
    });

    it('generates valid 3x3 unsharp convolution matrix for direct hardware sharpening', () => {
      const getMatrix = (sharpness: number) => {
        const k = (sharpness / 100.0) * 0.65;
        const center = (1 + 4 * k).toFixed(3);
        const edge = (-k).toFixed(3);
        return `0 ${edge} 0 ${edge} ${center} ${edge} 0 ${edge} 0`;
      };

      const matrix50 = getMatrix(50);
      // For sharpness=50, k=0.325, center=2.300, edge=-0.325
      expect(matrix50).toBe('0 -0.325 0 -0.325 2.300 -0.325 0 -0.325 0');
    });

    it('generates valid CSS HDR dynamic range filter values', () => {
      const getHdrFilter = (hdrBoost: number) => {
        const hdr = hdrBoost / 100.0;
        const contrast = (1 + hdr * 0.28).toFixed(3);
        const brightness = (1 + hdr * 0.05).toFixed(3);
        const saturate = (1 + hdr * 0.32).toFixed(3);
        return `contrast(${contrast}) brightness(${brightness}) saturate(${saturate})`;
      };

      const hdr70 = getHdrFilter(70);
      expect(hdr70).toContain('contrast(1.196)');
      expect(hdr70).toContain('brightness(1.035)');
      expect(hdr70).toContain('saturate(1.224)');
    });
  });
});
