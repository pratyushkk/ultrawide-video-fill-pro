import type { GPURendererBackend, GPUBackendType, UniformData } from './types';
import { GLSL_VERTEX_SHADER, GLSL_FRAGMENT_SHADER } from './shaders/glsl';

export class WebGL2Backend implements GPURendererBackend {
  readonly type: GPUBackendType = 'webgl2';

  private canvas: HTMLCanvasElement | null = null;
  private gl: WebGL2RenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private texture: WebGLTexture | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private quadBuffer: WebGLBuffer | null = null;

  // Uniform locations
  private uVideoTextureLoc: WebGLUniformLocation | null = null;
  private uSharpnessLoc: WebGLUniformLocation | null = null;
  private uHdrBoostLoc: WebGLUniformLocation | null = null;
  private uTexSizeLoc: WebGLUniformLocation | null = null;
  private uQualityLoc: WebGLUniformLocation | null = null;
  private uAbModeLoc: WebGLUniformLocation | null = null;

  private initialized = false;

  public isInitialized(): boolean {
    return this.initialized && this.gl !== null;
  }

  public async initialize(canvas: HTMLCanvasElement): Promise<boolean> {
    try {
      this.canvas = canvas;
      const gl = canvas.getContext('webgl2', {
        alpha: false,
        desynchronized: true,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: false
      });

      if (!gl) {
        console.warn('[UWVF-WebGL2] WebGL2 not supported on canvas');
        return false;
      }
      this.gl = gl;

      // Compile shaders
      const vertShader = this.compileShader(gl.VERTEX_SHADER, GLSL_VERTEX_SHADER);
      const fragShader = this.compileShader(gl.FRAGMENT_SHADER, GLSL_FRAGMENT_SHADER);
      if (!vertShader || !fragShader) {
        return false;
      }

      const program = gl.createProgram();
      if (!program) return false;

      gl.attachShader(program, vertShader);
      gl.attachShader(program, fragShader);
      gl.linkProgram(program);

      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('[UWVF-WebGL2] Program link error:', gl.getProgramInfoLog(program));
        return false;
      }
      this.program = program;

      // Get uniform locations
      this.uVideoTextureLoc = gl.getUniformLocation(program, 'u_videoTexture');
      this.uSharpnessLoc = gl.getUniformLocation(program, 'u_sharpness');
      this.uHdrBoostLoc = gl.getUniformLocation(program, 'u_hdrBoost');
      this.uTexSizeLoc = gl.getUniformLocation(program, 'u_texSize');
      this.uQualityLoc = gl.getUniformLocation(program, 'u_quality');
      this.uAbModeLoc = gl.getUniformLocation(program, 'u_abMode');

      // Create fullscreen quad VAO
      this.vao = gl.createVertexArray();
      gl.bindVertexArray(this.vao);

      this.quadBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
      // Quad positions: Triangle strip (-1, -1), (1, -1), (-1, 1), (1, 1)
      const quadVertices = new Float32Array([
        -1.0, -1.0,
         1.0, -1.0,
        -1.0,  1.0,
         1.0,  1.0
      ]);
      gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);

      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

      // Create video texture
      this.texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

      // Flip Y unpack so video image is right-side up
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

      this.initialized = true;
      return true;
    } catch (e) {
      console.error('[UWVF-WebGL2] Initialization error:', e);
      this.initialized = false;
      return false;
    }
  }

  private compileShader(type: number, source: string): WebGLShader | null {
    if (!this.gl) return null;
    const shader = this.gl.createShader(type);
    if (!shader) return null;

    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      console.error('[UWVF-WebGL2] Shader compile error:', this.gl.getShaderInfoLog(shader));
      this.gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  public updateUniforms(uniforms: UniformData): void {
    if (!this.gl || !this.program) return;
    this.gl.useProgram(this.program);

    if (this.uSharpnessLoc) this.gl.uniform1f(this.uSharpnessLoc, uniforms.sharpness);
    if (this.uHdrBoostLoc) this.gl.uniform1f(this.uHdrBoostLoc, uniforms.hdrBoost);
    if (this.uTexSizeLoc) this.gl.uniform2f(this.uTexSizeLoc, uniforms.texWidth, uniforms.texHeight);
    if (this.uQualityLoc) this.gl.uniform1i(this.uQualityLoc, uniforms.quality);
    if (this.uAbModeLoc) this.gl.uniform1i(this.uAbModeLoc, uniforms.abMode);
  }

  public render(video: HTMLVideoElement, uniforms: UniformData): void {
    if (!this.initialized || !this.gl || !this.program || !this.texture || !this.vao) {
      return;
    }

    const gl = this.gl;
    try {
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.useProgram(this.program);

      // Upload video frame to texture
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
      if (this.uVideoTextureLoc) {
        gl.uniform1i(this.uVideoTextureLoc, 0);
      }

      this.updateUniforms(uniforms);

      // Draw quad
      gl.bindVertexArray(this.vao);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    } catch (e) {
      console.warn('[UWVF-WebGL2] Render error:', e);
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
    if (this.gl) {
      if (this.texture) this.gl.deleteTexture(this.texture);
      if (this.quadBuffer) this.gl.deleteBuffer(this.quadBuffer);
      if (this.vao) this.gl.deleteVertexArray(this.vao);
      if (this.program) this.gl.deleteProgram(this.program);
    }
    this.gl = null;
    this.canvas = null;
  }
}
