export type GPUBackendType = 'webgpu' | 'webgl2' | 'direct-gpu' | 'unavailable' | 'bypassed';
export type GPUQuality = 'auto' | 'performance' | 'balanced' | 'quality';

export interface UniformData {
  sharpness: number;    // 0.0 to 1.0
  hdrBoost: number;     // 0.0 to 1.0
  texWidth: number;     // video width in px
  texHeight: number;    // video height in px
  quality: number;      // 0: performance, 1: balanced, 2: quality
  abMode: number;       // 0: full screen processed, 1: split-screen A/B
}

export interface GPUDiagnostics {
  backend: GPUBackendType;
  isSupported: boolean;
  fps: number;
  frameTimeMs: number;
  droppedFrames: number;
  resolution: string;
  activePasses: number;
}

export interface GPURendererBackend {
  readonly type: GPUBackendType;
  isInitialized(): boolean;
  initialize(canvas: HTMLCanvasElement): Promise<boolean>;
  render(video: HTMLVideoElement, uniforms: UniformData): void;
  updateUniforms(uniforms: UniformData): void;
  resize(width: number, height: number): void;
  destroy(): void;
}

export interface GPUCapabilitiesResult {
  webgpuSupported: boolean;
  webgl2Supported: boolean;
  hdrDisplaySupported: boolean;
  preferredBackend: GPUBackendType;
}

// ─── WebGPU Minimal Type Declarations ─────────────────────────────────
// Allows clean compilation without external @webgpu/types dependency
export interface WebGPUAdapterShim {
  requestDevice(descriptor?: any): Promise<WebGPUDeviceShim>;
  limits?: Record<string, number>;
}

export interface WebGPUDeviceShim {
  queue: {
    writeBuffer(buffer: any, bufferOffset: number, data: BufferSource, dataOffset?: number, size?: number): void;
    submit(commandBuffers: any[]): void;
  };
  createShaderModule(descriptor: { code: string }): any;
  createRenderPipeline(descriptor: any): any;
  createBuffer(descriptor: { size: number; usage: number }): any;
  createBindGroup(descriptor: any): any;
  createBindGroupLayout(descriptor: any): any;
  createSampler(descriptor?: any): any;
  createCommandEncoder(descriptor?: any): any;
  importExternalTexture(descriptor: { source: HTMLVideoElement }): any;
  destroy(): void;
  lost: Promise<{ reason: string; message: string }>;
}
