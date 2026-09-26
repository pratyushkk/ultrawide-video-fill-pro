// ─── WebGPU WGSL Shader (Single-Pass Combined Sharpness + HDR Boost) ───

export const WGSL_SHADER_SOURCE = /* wgsl */ `
struct Uniforms {
  sharpness: f32,    // 0.0 to 1.0
  hdrBoost: f32,     // 0.0 to 1.0
  texWidth: f32,
  texHeight: f32,
  quality: u32,      // 0: fast, 1: balanced, 2: quality
  abMode: u32,       // 0: full screen, 1: split-screen comparison
  pad1: u32,
  pad2: u32,
};

@group(0) @binding(0) var videoTexture: texture_external;
@group(0) @binding(1) var videoSampler: sampler;
@group(0) @binding(2) var<uniform> uniforms: Uniforms;

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

// Fullscreen triangle covering [-1, 1] clip space
@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var out: VertexOutput;
  // Positions for full-screen triangle:
  // 0: (-1, -1), 1: (3, -1), 2: (-1, 3)
  let x = f32((vertexIndex << 1u) & 2u) * 2.0 - 1.0;
  let y = f32(vertexIndex & 2u) * 2.0 - 1.0;
  
  out.position = vec4<f32>(x, y, 0.0, 1.0);
  // UV coordinates: (0, 1) -> (2, 1) -> (0, -1) mapped to [0, 1]
  out.uv = vec2<f32>(x * 0.5 + 0.5, 0.5 - y * 0.5);
  return out;
}

// Rec. 709 Luminance
fn getLuminance(rgb: vec3<f32>) -> f32 {
  return dot(rgb, vec3<f32>(0.2126, 0.7152, 0.0722));
}

// Soft S-curve for midtone contrast expansion
fn sCurve(x: f32) -> f32 {
  return x * x * (3.0 - 2.0 * x);
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
  let uv = in.uv;

  // Split-screen A/B mode check
  if (uniforms.abMode == 1u) {
    let splitX = 0.5;
    // Draw 2px vertical dividing line
    let pixelDist = abs(uv.x - splitX) * uniforms.texWidth;
    if (pixelDist < 1.0) {
      return vec4<f32>(1.0, 1.0, 1.0, 1.0);
    }
    // Left half: bypass original video
    if (uv.x < splitX) {
      return textureSampleBaseClampToEdge(videoTexture, videoSampler, uv);
    }
  }

  // Bypass if both effects are zero
  if (uniforms.sharpness <= 0.001 && uniforms.hdrBoost <= 0.001) {
    return textureSampleBaseClampToEdge(videoTexture, videoSampler, uv);
  }

  let center = textureSampleBaseClampToEdge(videoTexture, videoSampler, uv).rgb;
  let lumC = getLuminance(center);

  // Compute pixel step for texture sampling
  let dx = 1.0 / max(uniforms.texWidth, 1.0);
  let dy = 1.0 / max(uniforms.texHeight, 1.0);

  // Cross neighbor samples
  let sampleTop   = textureSampleBaseClampToEdge(videoTexture, videoSampler, uv + vec2<f32>(0.0, -dy)).rgb;
  let sampleBottom= textureSampleBaseClampToEdge(videoTexture, videoSampler, uv + vec2<f32>(0.0, dy)).rgb;
  let sampleLeft  = textureSampleBaseClampToEdge(videoTexture, videoSampler, uv + vec2<f32>(-dx, 0.0)).rgb;
  let sampleRight = textureSampleBaseClampToEdge(videoTexture, videoSampler, uv + vec2<f32>(dx, 0.0)).rgb;

  let lumTop    = getLuminance(sampleTop);
  let lumBottom = getLuminance(sampleBottom);
  let lumLeft   = getLuminance(sampleLeft);
  let lumRight  = getLuminance(sampleRight);

  var lumMin = min(lumC, min(min(lumTop, lumBottom), min(lumLeft, lumRight)));
  var lumMax = max(lumC, max(max(lumTop, lumBottom), max(lumLeft, lumRight)));
  var lumBlur = (lumTop + lumBottom + lumLeft + lumRight) * 0.25;

  // Higher quality: include diagonal corner samples
  if (uniforms.quality >= 1u) {
    let sampleTL = textureSampleBaseClampToEdge(videoTexture, videoSampler, uv + vec2<f32>(-dx, -dy)).rgb;
    let sampleTR = textureSampleBaseClampToEdge(videoTexture, videoSampler, uv + vec2<f32>(dx, -dy)).rgb;
    let sampleBL = textureSampleBaseClampToEdge(videoTexture, videoSampler, uv + vec2<f32>(-dx, dy)).rgb;
    let sampleBR = textureSampleBaseClampToEdge(videoTexture, videoSampler, uv + vec2<f32>(dx, dy)).rgb;

    let lumTL = getLuminance(sampleTL);
    let lumTR = getLuminance(sampleTR);
    let lumBL = getLuminance(sampleBL);
    let lumBR = getLuminance(sampleBR);

    lumMin = min(lumMin, min(min(lumTL, lumTR), min(lumBL, lumBR)));
    lumMax = max(lumMax, max(max(lumTL, lumTR), max(lumBL, lumBR)));
    // Weighted 3x3 Gaussian-like average
    lumBlur = lumBlur * 0.6 + (lumTL + lumTR + lumBL + lumBR) * 0.1;
  }

  // ─── 1. ADAPTIVE SHARPNESS ──────────────────────────────────────────
  var processedLum = lumC;

  if (uniforms.sharpness > 0.001) {
    let detail = lumC - lumBlur;

    // Noise coring threshold: suppress fine noise / grain in flat or dark areas
    let coringThreshold = 0.008 + (1.0 - smoothstep(0.02, 0.15, lumC)) * 0.012;
    let detailSign = sign(detail);
    let detailAbs = abs(detail);
    let coredDetail = detailSign * max(0.0, detailAbs - coringThreshold);

    // Dynamic detail gain: maps slider 0..1 to 0..2.2x strength
    let sharpnessFactor = uniforms.sharpness * 2.2;
    let sharpLum = lumC + coredDetail * sharpnessFactor;

    // Halo & ringing prevention: clamp to local neighborhood range with gentle overshooting allowance
    let haloSlack = (lumMax - lumMin) * 0.15;
    processedLum = clamp(sharpLum, max(0.0, lumMin - haloSlack), min(1.0, lumMax + haloSlack));
  }

  // ─── 2. HDR DYNAMIC RANGE BOOST ────────────────────────────────────
  if (uniforms.hdrBoost > 0.001) {
    let hdrAmount = uniforms.hdrBoost;

    // A. Controlled Shadow Preservation:
    // Protect deep blacks (lum < 0.04) from washing out into gray
    let shadowMask = smoothstep(0.005, 0.08, processedLum);

    // B. Midtone Contrast Expansion:
    // S-curve boosts midtone punch while maintaining smooth gradients
    let curvedLum = sCurve(processedLum);
    var boostedLum = mix(processedLum, curvedLum, hdrAmount * 0.45);

    // C. Highlight Reconstruction & Shoulder Roll-off (Extended Reinhard Tone Curve):
    // White point ceiling
    let whitePoint = 1.35;
    let extendedReinhard = (boostedLum * (1.0 + boostedLum / (whitePoint * whitePoint))) / (1.0 + boostedLum);
    
    // Blend expanded dynamic range based on HDR intensity
    boostedLum = mix(boostedLum, extendedReinhard, hdrAmount * shadowMask);
    processedLum = clamp(boostedLum, 0.0, 1.0);
  }

  // ─── 3. COLOR RECONSTRUCTION & CHROMINANCE BOOST ───────────────────
  let lumRatio = processedLum / max(lumC, 0.0001);
  var outColor = center * lumRatio;

  // Gamut & Saturation Enhancement:
  // When HDR boost is applied, slightly enhance saturation to match wide color gamut presentation
  if (uniforms.hdrBoost > 0.001) {
    let saturationBoost = 1.0 + uniforms.hdrBoost * 0.32;
    outColor = mix(vec3<f32>(processedLum), outColor, saturationBoost);
  }

  // Final safety clamp
  return vec4<f32>(clamp(outColor, vec3<f32>(0.0), vec3<f32>(1.0)), 1.0);
}
`;
