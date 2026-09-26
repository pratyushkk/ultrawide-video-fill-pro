// ─── Video Fill Transform ────────────────────────────────────────────
export interface FillInput {
  videoWidth: number;
  videoHeight: number;
  containerWidth: number;
  containerHeight: number;
}

export interface FillTransform {
  scale: number;
  translateX: number;
  translateY: number;
  videoAspectRatio: number;
  targetAspectRatio: number;
  cropLeft: number;
  cropRight: number;
  cropTop: number;
  cropBottom: number;
}

// ─── Settings ────────────────────────────────────────────────────────
export type CinemaCropLevel = 'off' | 'low' | 'medium' | 'high' | 'custom';

export interface VideoSettings {
  mode: 'auto' | 'custom';
  adjustment: number;        // percentage offset from auto-fill baseline
  autoFill: boolean;
  cinemaCrop: CinemaCropLevel;
  cinemaCropAmount: number;  // 0-100 for custom
  posX: number;              // manual X offset
  posY: number;              // manual Y offset
  rotation: number;          // degrees
  mirrorH: boolean;
  mirrorV: boolean;
  sharpness: number;         // 0-100 GPU sharpness
  hdrBoost: number;          // 0-100 GPU HDR dynamic range boost
  brightness: number;        // 0-200% global video brightness (default 100)
  aspectRatio: string;       // 'auto' | '21:9' | '32:9' | '16:9' | '16:10' | '18:9'
}

export interface SiteSettings {
  hostname: string;
  settings: Partial<VideoSettings>;
  enabled: boolean;
}

export type GPUQualityPreference = 'auto' | 'performance' | 'balanced' | 'quality';

export interface GlobalSettings {
  autoFillDefault: boolean;
  defaultCinemaCrop: CinemaCropLevel;
  showAdvanced: boolean;
  keyboardShortcutsEnabled: boolean;
  smoothTransitions: boolean;
  transitionDuration: number;
  defaultSharpness: number;
  defaultHdrBoost: number;
  brightness: number;        // global video brightness (0-200, default 100)
  defaultAspectRatio?: string; // 'auto' | '21:9' | '32:9' | '16:9' | '16:10' | '18:9'
  gpuQualityPreference: GPUQualityPreference;
}

export interface StorageData {
  globalSettings: GlobalSettings;
  siteSettings: Record<string, SiteSettings>;
}

// ─── Messages ────────────────────────────────────────────────────────
export type MessageType =
  | 'GET_VIDEO_STATUS'
  | 'VIDEO_STATUS'
  | 'ZOOM_TO_FILL'
  | 'RESET'
  | 'SET_ADJUSTMENT'
  | 'SET_SETTING'
  | 'GET_SETTINGS'
  | 'SETTINGS_UPDATED'
  | 'TOGGLE_AUTO_FILL'
  | 'SAVE_SITE_SETTINGS'
  | 'RESET_SITE_SETTINGS'
  | 'GET_SITE_SETTINGS'
  | 'SELECT_VIDEO'
  | 'CONTENT_READY'
  | 'NAVIGATE'
  | 'SET_ADVANCED'
  | 'SET_GPU_EFFECTS'
  | 'GET_GPU_DIAGNOSTICS'
  | 'SET_BRIGHTNESS'
  | 'SET_ASPECT_RATIO';

export interface ExtensionMessage {
  type: MessageType;
  payload?: unknown;
  tabId?: number;
}

// ─── Video Info ──────────────────────────────────────────────────────
export interface VideoInfo {
  index: number;
  width: number;
  height: number;
  naturalWidth: number;
  naturalHeight: number;
  playing: boolean;
  visible: boolean;
  area: number;
  src: string;
  currentTime: number;
  duration: number;
}

export interface VideoStatus {
  detected: boolean;
  videoCount: number;
  activeVideoIndex: number;
  videos: VideoInfo[];
  isTransformed: boolean;
  currentScale: number;
  autoFillScale: number;
  adjustment: number;
  containerWidth: number;
  containerHeight: number;
  isFullscreen: boolean;
  autoFillEnabled?: boolean;
  posX?: number;
  posY?: number;
  rotation?: number;
  mirrorH?: boolean;
  mirrorV?: boolean;
  cinemaCrop?: CinemaCropLevel;
  sharpness?: number;
  hdrBoost?: number;
  brightness?: number;
  aspectRatio?: string;
  gpuBackend?: 'webgpu' | 'webgl2' | 'direct-gpu' | 'unavailable' | 'bypassed';
  gpuAvailable?: boolean;
  gpuFps?: number;
  gpuFrameTimeMs?: number;
  gpuDroppedFrames?: number;
  gpuResolution?: string;
  isDrmProtected?: boolean;
}

// ─── Defaults ────────────────────────────────────────────────────────
export const DEFAULT_VIDEO_SETTINGS: VideoSettings = {
  mode: 'auto',
  adjustment: 0,
  autoFill: false,
  cinemaCrop: 'off',
  cinemaCropAmount: 0,
  posX: 0,
  posY: 0,
  rotation: 0,
  mirrorH: false,
  mirrorV: false,
  sharpness: 0,
  hdrBoost: 0,
  brightness: 100,
  aspectRatio: 'auto',
};

export const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  autoFillDefault: false,
  defaultCinemaCrop: 'off',
  showAdvanced: false,
  keyboardShortcutsEnabled: true,
  smoothTransitions: true,
  transitionDuration: 200,
  defaultSharpness: 0,
  defaultHdrBoost: 0,
  brightness: 100,
  defaultAspectRatio: 'auto',
  gpuQualityPreference: 'auto',
};

export const DEFAULT_STORAGE: StorageData = {
  globalSettings: DEFAULT_GLOBAL_SETTINGS,
  siteSettings: {},
};
