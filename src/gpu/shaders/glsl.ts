// ─── WebGL2 GLSL ES 3.0 Shaders (Fallback Single-Pass Pipeline) ───────

export const GLSL_VERTEX_SHADER = `#version 300 es
precision highp float;

layout(location = 0) in vec2 a_position;
out vec2 v_uv;

void main() {
  // a_position is in range [-1, 1]
  gl_Position = vec4(a_position, 0.0, 1.0);
  // UV in range [0, 1]
  v_uv = a_position * 0.5 + 0.5;
}
`;

export const GLSL_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_videoTexture;
uniform float u_sharpness;
uniform float u_hdrBoost;
uniform vec2 u_texSize;
uniform int u_quality;
uniform int u_abMode;

// Rec. 709 Luminance
float getLuminance(vec3 rgb) {
  return dot(rgb, vec3(0.2126, 0.7152, 0.0722));
}

// Soft S-curve for midtone contrast expansion
float sCurve(float x) {
  return x * x * (3.0 - 2.0 * x);
}

void main() {
  vec2 uv = v_uv;

  // Split-screen A/B mode check
  if (u_abMode == 1) {
    float splitX = 0.5;
    float pixelDist = abs(uv.x - splitX) * u_texSize.x;
    if (pixelDist < 1.0) {
      fragColor = vec4(1.0, 1.0, 1.0, 1.0);
      return;
    }
    // Left half: bypass original video
    if (uv.x < splitX) {
      fragColor = texture(u_videoTexture, uv);
      return;
    }
  }

  // Bypass check
  if (u_sharpness <= 0.001 && u_hdrBoost <= 0.001) {
    fragColor = texture(u_videoTexture, uv);
    return;
  }

  vec3 center = texture(u_videoTexture, uv).rgb;
  float lumC = getLuminance(center);

  vec2 step = 1.0 / max(u_texSize, vec2(1.0));

  // Cross neighbor samples
  vec3 sampleTop    = texture(u_videoTexture, uv + vec2(0.0, -step.y)).rgb;
  vec3 sampleBottom = texture(u_videoTexture, uv + vec2(0.0, step.y)).rgb;
  vec3 sampleLeft   = texture(u_videoTexture, uv + vec2(-step.x, 0.0)).rgb;
  vec3 sampleRight  = texture(u_videoTexture, uv + vec2(step.x, 0.0)).rgb;

  float lumTop    = getLuminance(sampleTop);
  float lumBottom = getLuminance(sampleBottom);
  float lumLeft   = getLuminance(sampleLeft);
  float lumRight  = getLuminance(sampleRight);

  float lumMin = min(lumC, min(min(lumTop, lumBottom), min(lumLeft, lumRight)));
  float lumMax = max(lumC, max(max(lumTop, lumBottom), max(lumLeft, lumRight)));
  float lumBlur = (lumTop + lumBottom + lumLeft + lumRight) * 0.25;

  if (u_quality >= 1) {
    vec3 sampleTL = texture(u_videoTexture, uv + vec2(-step.x, -step.y)).rgb;
    vec3 sampleTR = texture(u_videoTexture, uv + vec2(step.x, -step.y)).rgb;
    vec3 sampleBL = texture(u_videoTexture, uv + vec2(-step.x, step.y)).rgb;
    vec3 sampleBR = texture(u_videoTexture, uv + vec2(step.x, step.y)).rgb;

    float lumTL = getLuminance(sampleTL);
    float lumTR = getLuminance(sampleTR);
    float lumBL = getLuminance(sampleBL);
    float lumBR = getLuminance(sampleBR);

    lumMin = min(lumMin, min(min(lumTL, lumTR), min(lumBL, lumBR)));
    lumMax = max(lumMax, max(max(lumTL, lumTR), max(lumBL, lumBR)));
    lumBlur = lumBlur * 0.6 + (lumTL + lumTR + lumBL + lumBR) * 0.1;
  }

  // 1. Adaptive Sharpness
  float processedLum = lumC;
  if (u_sharpness > 0.001) {
    float detail = lumC - lumBlur;
    float coringThreshold = 0.008 + (1.0 - smoothstep(0.02, 0.15, lumC)) * 0.012;
    float detailSign = sign(detail);
    float detailAbs = abs(detail);
    float coredDetail = detailSign * max(0.0, detailAbs - coringThreshold);

    float sharpnessFactor = u_sharpness * 2.2;
    float sharpLum = lumC + coredDetail * sharpnessFactor;

    float haloSlack = (lumMax - lumMin) * 0.15;
    processedLum = clamp(sharpLum, max(0.0, lumMin - haloSlack), min(1.0, lumMax + haloSlack));
  }

  // 2. HDR Boost
  if (u_hdrBoost > 0.001) {
    float hdrAmount = u_hdrBoost;
    float shadowMask = smoothstep(0.005, 0.08, processedLum);

    float curvedLum = sCurve(processedLum);
    float boostedLum = mix(processedLum, curvedLum, hdrAmount * 0.45);

    float whitePoint = 1.35;
    float extendedReinhard = (boostedLum * (1.0 + boostedLum / (whitePoint * whitePoint))) / (1.0 + boostedLum);

    boostedLum = mix(boostedLum, extendedReinhard, hdrAmount * shadowMask);
    processedLum = clamp(boostedLum, 0.0, 1.0);
  }

  // 3. Color Reconstruction
  float lumRatio = processedLum / max(lumC, 0.0001);
  vec3 outColor = center * lumRatio;

  if (u_hdrBoost > 0.001) {
    float saturationBoost = 1.0 + u_hdrBoost * 0.32;
    outColor = mix(vec3(processedLum), outColor, saturationBoost);
  }

  fragColor = vec4(clamp(outColor, 0.0, 1.0), 1.0);
}
`;
