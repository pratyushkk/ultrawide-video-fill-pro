import { describe, it, expect } from 'vitest';
import {
  calculateFillTransform,
  calculateAdjustedScale,
  getSliderRange,
  scaleToPercent,
  calculateVisiblePercent,
} from '../src/utils/fillCalculator';

describe('calculateFillTransform', () => {
  it('should return identity transform for zero dimensions', () => {
    const result = calculateFillTransform({
      videoWidth: 0,
      videoHeight: 0,
      containerWidth: 0,
      containerHeight: 0,
    });
    expect(result.scale).toBe(1);
    expect(result.translateX).toBe(0);
    expect(result.translateY).toBe(0);
  });

  it('should return scale 1 when video and container have the same aspect ratio (16:9 → 16:9)', () => {
    const result = calculateFillTransform({
      videoWidth: 1920,
      videoHeight: 1080,
      containerWidth: 2560,
      containerHeight: 1440,
    });
    expect(result.scale).toBeCloseTo(1, 5);
    expect(result.cropLeft).toBeCloseTo(0, 1);
    expect(result.cropRight).toBeCloseTo(0, 1);
    expect(result.cropTop).toBeCloseTo(0, 1);
    expect(result.cropBottom).toBeCloseTo(0, 1);
  });

  it('should calculate correct fill for 16:9 → 21:9 (3440×1440)', () => {
    const result = calculateFillTransform({
      videoWidth: 1920,
      videoHeight: 1080,
      containerWidth: 3440,
      containerHeight: 1440,
    });
    // 16:9 video (1.778) into 21.5:9 container (2.389)
    // Container is wider, so we scale by width: containerAR / videoAR
    const expectedScale = (3440 / 1440) / (1920 / 1080);
    expect(result.scale).toBeCloseTo(expectedScale, 5);
    expect(result.scale).toBeGreaterThan(1);
    // Should crop top and bottom
    expect(result.cropTop).toBeGreaterThan(0);
    expect(result.cropBottom).toBeGreaterThan(0);
    expect(result.cropLeft).toBeCloseTo(0, 1);
    expect(result.cropRight).toBeCloseTo(0, 1);
    // Aspect ratios
    expect(result.videoAspectRatio).toBeCloseTo(16 / 9, 3);
    expect(result.targetAspectRatio).toBeCloseTo(3440 / 1440, 3);
  });

  it('should calculate correct fill for 16:9 → 32:9 (5120×1440)', () => {
    const result = calculateFillTransform({
      videoWidth: 1920,
      videoHeight: 1080,
      containerWidth: 5120,
      containerHeight: 1440,
    });
    // 32:9 = 3.556, 16:9 = 1.778
    const expectedScale = (5120 / 1440) / (1920 / 1080);
    expect(result.scale).toBeCloseTo(expectedScale, 5);
    expect(result.scale).toBeCloseTo(2.0, 1); // approximately 2x
    expect(result.cropTop).toBeGreaterThan(0);
    expect(result.cropBottom).toBeGreaterThan(0);
  });

  it('should calculate correct fill for 21:9 → 32:9', () => {
    const result = calculateFillTransform({
      videoWidth: 2560,
      videoHeight: 1080,
      containerWidth: 5120,
      containerHeight: 1440,
    });
    const videoAR = 2560 / 1080; // 2.370
    const containerAR = 5120 / 1440; // 3.556
    const expectedScale = containerAR / videoAR;
    expect(result.scale).toBeCloseTo(expectedScale, 5);
    expect(result.cropTop).toBeGreaterThan(0);
    expect(result.cropBottom).toBeGreaterThan(0);
  });

  it('should calculate correct fill for 21:9 → 16:9 (wider video than container)', () => {
    const result = calculateFillTransform({
      videoWidth: 2560,
      videoHeight: 1080,
      containerWidth: 1920,
      containerHeight: 1080,
    });
    // Video is wider than container
    const videoAR = 2560 / 1080; // 2.370
    const containerAR = 1920 / 1080; // 1.778
    // videoAR > containerAR, so scale by height: videoAR / containerAR
    const expectedScale = videoAR / containerAR;
    expect(result.scale).toBeCloseTo(expectedScale, 5);
    // Should crop left and right
    expect(result.cropLeft).toBeGreaterThan(0);
    expect(result.cropRight).toBeGreaterThan(0);
    expect(result.cropTop).toBeCloseTo(0, 1);
    expect(result.cropBottom).toBeCloseTo(0, 1);
  });

  it('should calculate correct fill for 4:3 → 21:9', () => {
    const result = calculateFillTransform({
      videoWidth: 1024,
      videoHeight: 768,
      containerWidth: 3440,
      containerHeight: 1440,
    });
    const videoAR = 1024 / 768; // 1.333
    const containerAR = 3440 / 1440; // 2.389
    const expectedScale = containerAR / videoAR;
    expect(result.scale).toBeCloseTo(expectedScale, 5);
    expect(result.scale).toBeGreaterThan(1.5); // significant zoom needed
    expect(result.cropTop).toBeGreaterThan(0);
  });

  it('should calculate correct fill for 2.39:1 → 21:9', () => {
    const result = calculateFillTransform({
      videoWidth: 2390,
      videoHeight: 1000,
      containerWidth: 3440,
      containerHeight: 1440,
    });
    const videoAR = 2390 / 1000; // 2.39
    const containerAR = 3440 / 1440; // 2.389
    // Nearly identical aspect ratios
    expect(result.scale).toBeCloseTo(1, 1);
  });

  it('should calculate correct fill for 2.39:1 → 32:9', () => {
    const result = calculateFillTransform({
      videoWidth: 2390,
      videoHeight: 1000,
      containerWidth: 5120,
      containerHeight: 1440,
    });
    const videoAR = 2390 / 1000;
    const containerAR = 5120 / 1440;
    const expectedScale = containerAR / videoAR;
    expect(result.scale).toBeCloseTo(expectedScale, 5);
  });

  it('should calculate correct fill for 1:1 → 21:9', () => {
    const result = calculateFillTransform({
      videoWidth: 1080,
      videoHeight: 1080,
      containerWidth: 3440,
      containerHeight: 1440,
    });
    const videoAR = 1;
    const containerAR = 3440 / 1440;
    const expectedScale = containerAR / videoAR;
    expect(result.scale).toBeCloseTo(expectedScale, 5);
    expect(result.cropTop).toBeGreaterThan(0);
    expect(result.cropBottom).toBeGreaterThan(0);
  });

  it('should never produce a scale less than 1', () => {
    // Same aspect ratio should be exactly 1
    const result = calculateFillTransform({
      videoWidth: 1920,
      videoHeight: 1080,
      containerWidth: 1920,
      containerHeight: 1080,
    });
    expect(result.scale).toBeGreaterThanOrEqual(1);
  });

  it('should handle unusual aspect ratios like 18:9', () => {
    const result = calculateFillTransform({
      videoWidth: 1800,
      videoHeight: 900,
      containerWidth: 3440,
      containerHeight: 1440,
    });
    expect(result.scale).toBeGreaterThan(1);
    expect(result.videoAspectRatio).toBeCloseTo(2, 3);
  });

  it('should handle 19.5:9', () => {
    const result = calculateFillTransform({
      videoWidth: 1950,
      videoHeight: 900,
      containerWidth: 3440,
      containerHeight: 1440,
    });
    expect(result.scale).toBeGreaterThan(1);
  });

  it('should handle 20:9', () => {
    const result = calculateFillTransform({
      videoWidth: 2000,
      videoHeight: 900,
      containerWidth: 3440,
      containerHeight: 1440,
    });
    expect(result.scale).toBeGreaterThan(1);
  });

  it('should handle 24:10', () => {
    const result = calculateFillTransform({
      videoWidth: 2400,
      videoHeight: 1000,
      containerWidth: 3440,
      containerHeight: 1440,
    });
    expect(result.scale).toBeGreaterThan(1);
  });

  it('should preserve center positioning (translateX and translateY are 0)', () => {
    const result = calculateFillTransform({
      videoWidth: 1920,
      videoHeight: 1080,
      containerWidth: 3440,
      containerHeight: 1440,
    });
    expect(result.translateX).toBe(0);
    expect(result.translateY).toBe(0);
  });

  it('should produce symmetrical crop', () => {
    const result = calculateFillTransform({
      videoWidth: 1920,
      videoHeight: 1080,
      containerWidth: 3440,
      containerHeight: 1440,
    });
    expect(result.cropTop).toBeCloseTo(result.cropBottom, 5);
    expect(result.cropLeft).toBeCloseTo(result.cropRight, 5);
  });

  it('should handle 16:10 → 21:9', () => {
    const result = calculateFillTransform({
      videoWidth: 1920,
      videoHeight: 1200,
      containerWidth: 3440,
      containerHeight: 1440,
    });
    const videoAR = 1920 / 1200; // 1.6
    const containerAR = 3440 / 1440; // 2.389
    expect(result.scale).toBeCloseTo(containerAR / videoAR, 5);
  });

  it('should handle 3840×1600 display', () => {
    const result = calculateFillTransform({
      videoWidth: 1920,
      videoHeight: 1080,
      containerWidth: 3840,
      containerHeight: 1600,
    });
    expect(result.scale).toBeGreaterThan(1);
    expect(result.videoAspectRatio).toBeCloseTo(16 / 9, 3);
    expect(result.targetAspectRatio).toBeCloseTo(3840 / 1600, 3);
  });

  it('should handle 3840×2160 (4K) display', () => {
    const result = calculateFillTransform({
      videoWidth: 1920,
      videoHeight: 1080,
      containerWidth: 3840,
      containerHeight: 2160,
    });
    // Same aspect ratio
    expect(result.scale).toBeCloseTo(1, 5);
  });
});

describe('calculateAdjustedScale', () => {
  it('should return base scale with 0 adjustment', () => {
    expect(calculateAdjustedScale(1.33, 0)).toBeCloseTo(1.33, 5);
  });

  it('should increase scale with positive adjustment', () => {
    expect(calculateAdjustedScale(1.33, 10)).toBeCloseTo(1.33 * 1.1, 5);
  });

  it('should decrease scale with negative adjustment', () => {
    expect(calculateAdjustedScale(1.33, -10)).toBeCloseTo(1.33 * 0.9, 5);
  });

  it('should handle large adjustments', () => {
    expect(calculateAdjustedScale(1.0, 100)).toBeCloseTo(2.0, 5);
  });
});

describe('getSliderRange', () => {
  it('should return a range that includes 0 (the auto position)', () => {
    const range = getSliderRange(1.33);
    expect(range.min).toBeLessThan(0);
    expect(range.max).toBeGreaterThan(0);
  });

  it('should have step of 1', () => {
    const range = getSliderRange(1.5);
    expect(range.step).toBe(1);
  });

  it('should produce a reasonable range for common scales', () => {
    const range = getSliderRange(1.33);
    expect(range.min).toBeLessThan(-10);
    expect(range.max).toBeGreaterThan(30);
  });
});

describe('scaleToPercent', () => {
  it('should convert 1.0 to 100%', () => {
    expect(scaleToPercent(1.0)).toBe('100%');
  });

  it('should convert 1.33 to 133%', () => {
    expect(scaleToPercent(1.33)).toBe('133%');
  });

  it('should round correctly', () => {
    expect(scaleToPercent(1.337)).toBe('134%');
  });
});

describe('calculateVisiblePercent', () => {
  it('should return 100 for scale 1', () => {
    expect(calculateVisiblePercent(1)).toBe(100);
  });

  it('should return ~75 for scale 1.33', () => {
    expect(calculateVisiblePercent(1.33)).toBe(75);
  });

  it('should return 50 for scale 2', () => {
    expect(calculateVisiblePercent(2)).toBe(50);
  });
});
