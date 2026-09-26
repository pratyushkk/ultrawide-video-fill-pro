import type { GPURendererBackend, GPUBackendType, UniformData, WebGPUDeviceShim } from './types';
import { WGSL_SHADER_SOURCE } from './shaders/wgsl';

export class WebGPUBackend implements GPURendererBackend {
  readonly type: GPUBackendType = 'webgpu';

  private canvas: HTMLCanvasElement | null = null;
  private context: any = null;
  private device: WebGPUDeviceShim | null = null;
  private pipeline: any = null;
  private uniformBuffer: any = null;
  private sampler: any = null;
  private bindGroupLayout: any = null;
  private uniformFloatArray = new Float32Array(8);
  private uniformUintArray = new Uint32Array(this.uniformFloatArray.buffer);
  private initialized = false;
  private onDeviceLostCallback: (() => void) | null = null;

  constructor(onDeviceLost?: () => void) {
    this.onDeviceLostCallback = onDeviceLost || null;
  }

  public isInitialized(): boolean {
    return this.initialized && this.device !== null;
  }

  public async initialize(canvas: HTMLCanvasElement): Promise<boolean> {
    try {
      this.canvas = canvas;

      if (typeof navigator === 'undefined' || !('gpu' in navigator) || !(navigator as any).gpu) {
        return false;
      }

      const adapter = await (navigator as any).gpu.requestAdapter({
        powerPreference: 'high-performance'
      });
      if (!adapter) {
        console.warn('[UWVF-WebGPU] No suitable GPU adapter found');
        return false;
      }

      const device = await adapter.requestDevice();
      if (!device) {
        console.warn('[UWVF-WebGPU] Failed to create GPU device');
        return false;
      }
      this.device = device;

      // Handle device loss gracefully
      device.lost.then((info: any) => {
        console.warn(`[UWVF-WebGPU] GPU Device was lost: ${info?.message || info?.reason}`);
        this.initialized = false;
        if (this.onDeviceLostCallback) {
          this.onDeviceLostCallback();
        }
      }).catch(() => {});

      const ctx = canvas.getContext('webgpu');
      if (!ctx) {
        console.warn('[UWVF-WebGPU] Failed to get webgpu context on canvas');
        return false;
      }
      this.context = ctx;

      const presentationFormat = (navigator as any).gpu.getPreferredCanvasFormat();
      this.context.configure({
        device,
        format: presentationFormat,
        alphaMode: 'opaque'
      });

      // Compile combined shader module
      const shaderModule = device.createShaderModule({
        code: WGSL_SHADER_SOURCE
      });

      // Linear filtering sampler
      this.sampler = device.createSampler({
        magFilter: 'linear',
        minFilter: 'linear',
        addressModeU: 'clamp-to-edge',
        addressModeV: 'clamp-to-edge'
      });

      // Uniform buffer (32 bytes: 8 x 4 bytes)
      this.uniformBuffer = device.createBuffer({
        size: 32,
        usage: 0x0040 | 0x0008 // GPUBufferUsage.UNIFORM (0x0040) | GPUBufferUsage.COPY_DST (0x0008)
      });

      // Explicit bind group layout
      this.bindGroupLayout = device.createBindGroupLayout({
        entries: [
          {
            binding: 0,
            visibility: 0x2, // GPUShaderStage.FRAGMENT
            externalTexture: {}
          },
          {
            binding: 1,
            visibility: 0x2,
            sampler: { type: 'filtering' }
          },
          {
            binding: 2,
            visibility: 0x2,
            buffer: { type: 'uniform' }
          }
        ]
      });

      // Pipeline layout & pipeline
      const pipelineLayout = (device as any).createPipelineLayout({
        bindGroupLayouts: [this.bindGroupLayout]
      });

      this.pipeline = device.createRenderPipeline({
        layout: pipelineLayout,
        vertex: {
          module: shaderModule,
          entryPoint: 'vs_main'
        },
        fragment: {
          module: shaderModule,
          entryPoint: 'fs_main',
          targets: [{ format: presentationFormat }]
        },
        primitive: {
          topology: 'triangle-list'
        }
      });

      this.initialized = true;
      return true;
    } catch (e) {
      console.error('[UWVF-WebGPU] Initialization error:', e);
      this.initialized = false;
      return false;
    }
  }

  public updateUniforms(uniforms: UniformData): void {
    if (!this.device || !this.uniformBuffer) return;

    this.uniformFloatArray[0] = uniforms.sharpness;
    this.uniformFloatArray[1] = uniforms.hdrBoost;
    this.uniformFloatArray[2] = uniforms.texWidth;
    this.uniformFloatArray[3] = uniforms.texHeight;
    this.uniformUintArray[4] = uniforms.quality;
    this.uniformUintArray[5] = uniforms.abMode;
    this.uniformUintArray[6] = 0;
    this.uniformUintArray[7] = 0;

    this.device.queue.writeBuffer(this.uniformBuffer, 0, this.uniformFloatArray.buffer);
  }

  public render(video: HTMLVideoElement, uniforms: UniformData): void {
    if (!this.initialized || !this.device || !this.context || !this.pipeline) {
      return;
    }

    try {
      this.updateUniforms(uniforms);

      // WebGPU zero-copy hardware frame import
      const externalTexture = this.device.importExternalTexture({
        source: video
      });

      const bindGroup = this.device.createBindGroup({
        layout: this.bindGroupLayout,
        entries: [
          { binding: 0, resource: externalTexture },
          { binding: 1, resource: this.sampler },
          { binding: 2, resource: { buffer: this.uniformBuffer } }
        ]
      });

      const commandEncoder = this.device.createCommandEncoder();
      const currentTextureView = this.context.getCurrentTexture().createView();

      const renderPass = commandEncoder.beginRenderPass({
        colorAttachments: [
          {
            view: currentTextureView,
            clearValue: { r: 0, g: 0, b: 0, a: 1 },
            loadOp: 'clear',
            storeOp: 'store'
          }
        ]
      });

      renderPass.setPipeline(this.pipeline);
      renderPass.setBindGroup(0, bindGroup);
      renderPass.draw(3, 1, 0, 0);
      renderPass.end();

      this.device.queue.submit([commandEncoder.finish()]);
    } catch (e) {
      console.warn('[UWVF-WebGPU] Render frame error:', e);
    }
  }

  public resize(width: number, height: number): void {
    if (!this.canvas) return;
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
  }

  public destroy(): void {
    this.initialized = false;
    if (this.device) {
      try {
        if (typeof this.device.destroy === 'function') {
          this.device.destroy();
        }
      } catch {}
      this.device = null;
    }
    this.context = null;
    this.pipeline = null;
    this.uniformBuffer = null;
    this.sampler = null;
    this.canvas = null;
  }
}
