import type { FillInput, FillTransform } from '../types';

/**
 * Calculate the exact transformation needed to fill a container with a video
 * while preserving the video's original aspect ratio.
 * 
 * This uses minimum-crop fill: scale the video just enough so it completely
 * covers the container, then center it.
 */
export function calculateFillTransform(input: FillInput): FillTransform {
  const { videoWidth, videoHeight, containerWidth, containerHeight } = input;

  if (videoWidth <= 0 || videoHeight <= 0 || containerWidth <= 0 || containerHeight <= 0) {
    return {
      scale: 1,
      translateX: 0,
      translateY: 0,
      videoAspectRatio: 0,
      targetAspectRatio: 0,
      cropLeft: 0,
      cropRight: 0,
      cropTop: 0,
      cropBottom: 0,
    };
  }

  const videoAspectRatio = videoWidth / videoHeight;
  const targetAspectRatio = containerWidth / containerHeight;

  // To fill: we need the video to cover the entire container.
  // Scale is determined by which dimension needs more scaling.
  let scale: number;

  if (videoAspectRatio < targetAspectRatio) {
    // Video is relatively taller (narrower) than container.
    // We need to scale based on width to fill horizontally.
    // The video's width (after being fit to container) needs to match container width.
    // When a video is "contain" fit in a container:
    //   If videoAR < containerAR: video is height-matched, so displayed width = containerHeight * videoAR
    //   Scale needed = containerWidth / (containerHeight * videoAR)
    //   = containerAR / videoAR
    scale = targetAspectRatio / videoAspectRatio;
  } else {
    // Video is relatively wider than container.
    // We need to scale based on height to fill vertically.
    // When videoAR > containerAR: video is width-matched, so displayed height = containerWidth / videoAR
    //   Scale needed = containerHeight / (containerWidth / videoAR)
    //   = videoAR / containerAR
    scale = videoAspectRatio / targetAspectRatio;
  }

  // When the video fills the container, the excess is cropped equally on both sides.
  // Calculate how much of the original video is cropped.
  
  // After scaling, the video dimensions relative to the container:
  // If videoAR < targetAR (we scaled by width):
  //   Width perfectly matches, height is larger than container
  //   Excess height = scaledHeight - containerHeight
  // If videoAR >= targetAR (we scaled by height):
  //   Height perfectly matches, width is larger than container
  //   Excess width = scaledWidth - containerWidth

  let cropLeft = 0;
  let cropRight = 0;
  let cropTop = 0;
  let cropBottom = 0;

  if (videoAspectRatio < targetAspectRatio) {
    // Cropping top and bottom
    // The video's displayed height when contain-fit = containerHeight
    // After our scale, displayed height = containerHeight * scale
    // Excess = containerHeight * scale - containerHeight = containerHeight * (scale - 1)
    const excessHeight = containerHeight * (scale - 1);
    cropTop = excessHeight / 2;
    cropBottom = excessHeight / 2;
  } else if (videoAspectRatio > targetAspectRatio) {
    // Cropping left and right
    const excessWidth = containerWidth * (scale - 1);
    cropLeft = excessWidth / 2;
    cropRight = excessWidth / 2;
  }

  return {
    scale,
    translateX: 0,  // Centered, no translate needed with CSS transform-origin center
    translateY: 0,
    videoAspectRatio,
    targetAspectRatio,
    cropLeft,
    cropRight,
    cropTop,
    cropBottom,
  };
}

/**
 * Calculate adjusted scale from a base fill scale and a percentage adjustment.
 * Adjustment is a percentage offset: 0 means auto-fill, +10 means 10% more zoom, etc.
 */
export function calculateAdjustedScale(baseScale: number, adjustmentPercent: number): number {
  return baseScale * (1 + adjustmentPercent / 100);
}

/**
 * Get the slider range for a given auto-fill scale.
 * The range adapts to the current video/container combination.
 */
export function getSliderRange(autoFillScale: number): { min: number; max: number; step: number } {
  // Min: allow going down to 100% (no zoom, original fit)
  // Max: allow going up to 2x the auto-fill scale (heavy crop)
  const minAdjustment = -((autoFillScale - 1) / autoFillScale) * 100;
  const maxAdjustment = Math.max(50, (autoFillScale - 1) * 100 + 50);
  
  return {
    min: Math.round(minAdjustment),
    max: Math.round(maxAdjustment),
    step: 1,
  };
}

/**
 * Convert a scale value to a display percentage string.
 */
export function scaleToPercent(scale: number): string {
  return `${Math.round(scale * 100)}%`;
}

/**
 * Calculate crop percentage (how much of the original video is visible).
 */
export function calculateVisiblePercent(scale: number): number {
  if (scale <= 0) return 100;
  return Math.round((1 / scale) * 100);
}
