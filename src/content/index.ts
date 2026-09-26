import { calculateFillTransform, calculateAdjustedScale } from '../utils/fillCalculator';
import { VideoGPUProcessor } from '../gpu/VideoGPUProcessor';
import type { VideoStatus, VideoInfo, ExtensionMessage, FillTransform, FillInput, VideoSettings, MessageType } from '../types';

(function() {
  if ((window as any).__uwvf_injected) return;
  (window as any).__uwvf_injected = true;

  // --- STATE ---
  const state = {
    videos: new Set<HTMLVideoElement>(),
    activeVideo: null as HTMLVideoElement | null,
    isTransformed: false,
    currentScale: 1,
    autoFillScale: 1,
    adjustment: 0,
    containerWidth: 0,
    containerHeight: 0,
    autoFillEnabled: false,
    originalStyles: new WeakMap<HTMLVideoElement, { transform: string, transition: string }>(),
    originalContainerStyles: new WeakMap<HTMLElement, { overflow: string }>(),

    // Advanced
    posX: 0,
    posY: 0,
    rotation: 0,
    mirrorH: false,
    mirrorV: false,
    cinemaCrop: 'off' as import('../types').CinemaCropLevel,

    // GPU Enhancements
    sharpness: 0,
    hdrBoost: 0,
    brightness: 100,
    aspectRatio: 'auto',
    gpuProcessor: new VideoGPUProcessor(),
    
    resizeObserver: null as ResizeObserver | null,
    mutationObserver: null as MutationObserver | null,
    lastUrl: location.href,
    urlCheckInterval: 0 as unknown as ReturnType<typeof setInterval>
  };

  // --- UTILS ---
  function debounce<T extends (...args: any[]) => void>(func: T, wait: number): T {
    let timeout: ReturnType<typeof setTimeout> | null;
    return function(this: any, ...args: Parameters<T>) {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        timeout = null;
        func.apply(this, args);
      }, wait);
    } as T;
  }

  // --- VIDEO DETECTION & SELECTION ---
  function scoreVideo(video: HTMLVideoElement): number {
    let score = 0;
    if (!video.paused) score += 1000;
    const rect = video.getBoundingClientRect();
    const isVisible = rect.width > 0 && rect.height > 0 && 
      rect.top < window.innerHeight && rect.bottom > 0;
    if (isVisible) score += 500;
    score += (rect.width * rect.height) / 1000;
    
    // Center bonus
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const distFromCenter = Math.hypot(
      centerX - window.innerWidth / 2,
      centerY - window.innerHeight / 2
    );
    score -= distFromCenter / 10;
    return score;
  }

  const scanForVideos = debounce(() => {
    const videoElements = document.querySelectorAll('video');
    
    videoElements.forEach(v => {
      if (!state.videos.has(v)) {
        state.videos.add(v);
        v.addEventListener('play', onVideoPlay);
        v.addEventListener('loadedmetadata', handleResize);
      }
    });

    // Remove stale videos
    state.videos.forEach(v => {
      if (!document.body.contains(v)) {
        state.videos.delete(v);
        v.removeEventListener('play', onVideoPlay);
        v.removeEventListener('loadedmetadata', handleResize);
        if (state.activeVideo === v) {
          resetTransformation();
          state.gpuProcessor.detach();
          state.activeVideo = null;
        }
      }
    });

    selectBestVideo();
  }, 300);

  function selectBestVideo() {
    let bestVideo: HTMLVideoElement | null = null;
    let bestScore = -Infinity;

    state.videos.forEach(video => {
      const score = scoreVideo(video);
      if (score > bestScore) {
        bestScore = score;
        bestVideo = video;
      }
    });

    if (bestVideo && bestVideo !== state.activeVideo) {
      if (state.activeVideo) {
        resetTransformation();
      }
      state.activeVideo = bestVideo;
      observeVideo(bestVideo);
      state.gpuProcessor.attach(bestVideo);
      state.gpuProcessor.setEffects(state.sharpness, state.hdrBoost, state.brightness);
    }
  }

  // --- CONTAINER & TRANSFORM ---
  function getTargetDimensions(video: HTMLVideoElement): { width: number; height: number, container: HTMLElement } {
    if (document.fullscreenElement) {
      const fsEl = document.fullscreenElement as HTMLElement;
      return { width: fsEl.clientWidth, height: fsEl.clientHeight, container: fsEl };
    }
    
    let container = video.parentElement;
    const vWidth = video.clientWidth || video.getBoundingClientRect().width;
    const vHeight = video.clientHeight || video.getBoundingClientRect().height;

    while (container && container !== document.body) {
      const style = window.getComputedStyle(container);
      const rect = container.getBoundingClientRect();
      
      if (rect.width >= vWidth * 0.85 && rect.height >= vHeight * 0.85) {
        if (style.overflow === 'hidden' || style.position === 'relative' || style.position === 'absolute' || style.display === 'flex' || style.display === 'grid') {
          return { width: rect.width, height: rect.height, container };
        }
      }
      container = container.parentElement;
    }
    
    return { width: window.innerWidth, height: window.innerHeight, container: document.body };
  }

  function applyTransform() {
    if (!state.activeVideo) return;
    const video = state.activeVideo;

    try {
      const { width, height, container } = getTargetDimensions(video);
      state.containerWidth = width;
      state.containerHeight = height;

      if (!video.videoWidth || !video.videoHeight) return;

      let targetWidth = width;
      let targetHeight = height;

      if (state.aspectRatio && state.aspectRatio !== 'auto') {
        let presetRatio = 0;
        if (state.aspectRatio === '21:9') presetRatio = 21 / 9;
        else if (state.aspectRatio === '32:9') presetRatio = 32 / 9;
        else if (state.aspectRatio === '16:9') presetRatio = 16 / 9;
        else if (state.aspectRatio === '16:10') presetRatio = 16 / 10;
        else if (state.aspectRatio === '18:9') presetRatio = 18 / 9;

        if (presetRatio > 0) {
          targetWidth = targetHeight * presetRatio;
        }
      }

      const fillInput: FillInput = {
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        containerWidth: targetWidth,
        containerHeight: targetHeight
      };

      const fillTransform = calculateFillTransform(fillInput);
      state.autoFillScale = fillTransform.scale;

      let cinemaMultiplier = 1;
      if (state.cinemaCrop === 'low') cinemaMultiplier = 1.1;
      else if (state.cinemaCrop === 'medium') cinemaMultiplier = 1.22;
      else if (state.cinemaCrop === 'high') cinemaMultiplier = 1.333;

      state.currentScale = calculateAdjustedScale(fillTransform.scale * cinemaMultiplier, state.adjustment);

      // Save original styles if not saved
      if (!state.originalStyles.has(video)) {
        state.originalStyles.set(video, {
          transform: video.style.transform || '',
          transition: video.style.transition || ''
        });
      }
      
      if (container && container !== document.body && !state.originalContainerStyles.has(container)) {
        state.originalContainerStyles.set(container, {
          overflow: container.style.overflow || ''
        });
      }

      // Apply transformations
      video.classList.add('uwvf-active');
      video.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
      
      const mirrorScaleX = state.mirrorH ? -1 : 1;
      const mirrorScaleY = state.mirrorV ? -1 : 1;

      video.style.transform = `scale(${state.currentScale * mirrorScaleX}, ${state.currentScale * mirrorScaleY}) translate(${state.posX}px, ${state.posY}px) rotate(${state.rotation}deg)`;
      video.style.transformOrigin = 'center center';

      if (container && container !== document.body) {
        container.classList.add('uwvf-container');
        container.style.overflow = 'hidden';
      }

      state.isTransformed = true;
      state.gpuProcessor.syncCanvasLayout();
    } catch (e) {
      console.error('[UWVF] Error applying transform:', e);
    }
  }

  function resetTransformation() {
    if (!state.activeVideo) return;
    const video = state.activeVideo;
    
    video.classList.remove('uwvf-active');
    const origStyles = state.originalStyles.get(video);
    if (origStyles) {
      video.style.transform = origStyles.transform;
      video.style.transition = origStyles.transition;
    } else {
      video.style.transform = '';
      video.style.transition = '';
    }

    const { container } = getTargetDimensions(video);
    if (container && container !== document.body) {
      container.classList.remove('uwvf-container');
      const origContainerStyles = state.originalContainerStyles.get(container);
      if (origContainerStyles) {
        container.style.overflow = origContainerStyles.overflow;
      } else {
        container.style.overflow = '';
      }
    }

    state.isTransformed = false;
    state.currentScale = 1;
    state.gpuProcessor.syncCanvasLayout();
  }

  // --- OBSERVERS & EVENT LISTENERS ---
  const handleResize = debounce(() => {
    if (state.isTransformed) {
      applyTransform();
    }
  }, 150);

  function observeVideo(video: HTMLVideoElement) {
    if (state.resizeObserver) {
      state.resizeObserver.disconnect();
    }
    
    state.resizeObserver = new ResizeObserver(handleResize);
    state.resizeObserver.observe(video);
    const { container } = getTargetDimensions(video);
    if (container) {
      state.resizeObserver.observe(container);
    }
  }

  function onVideoPlay(e: Event) {
    if (state.autoFillEnabled && !state.isTransformed) {
      // Small delay to ensure video dimensions are loaded
      setTimeout(() => {
        applyTransform();
      }, 100);
    }
  }

  function setupObservers() {
    state.mutationObserver = new MutationObserver((mutations) => {
      let shouldScan = false;
      for (const mutation of mutations) {
        if (mutation.addedNodes.length || mutation.removedNodes.length) {
          shouldScan = true;
          break;
        }
      }
      if (shouldScan) scanForVideos();
    });

    state.mutationObserver.observe(document.body, {
      childList: true,
      subtree: true
    });

    window.addEventListener('resize', handleResize);
    document.addEventListener('fullscreenchange', handleResize);

    // Initial scan
    scanForVideos();
  }

  function setupSPASupport() {
    state.urlCheckInterval = setInterval(() => {
      if (location.href !== state.lastUrl) {
        state.lastUrl = location.href;
        scanForVideos();
      }
    }, 1000);

    // YouTube specific
    window.addEventListener('yt-navigate-finish', () => {
      scanForVideos();
    });
  }

  // --- MESSAGING ---
  function getVideoStatus(): VideoStatus {
    const videos: VideoInfo[] = Array.from(state.videos).map((v, idx) => ({
      index: idx,
      width: v.clientWidth,
      height: v.clientHeight,
      naturalWidth: v.videoWidth,
      naturalHeight: v.videoHeight,
      playing: !v.paused,
      visible: v.getBoundingClientRect().width > 0,
      area: v.clientWidth * v.clientHeight,
      src: v.src || v.currentSrc,
      currentTime: v.currentTime,
      duration: v.duration
    }));

    const diag = state.gpuProcessor.getDiagnostics();

    return {
      detected: state.videos.size > 0,
      videoCount: state.videos.size,
      activeVideoIndex: state.activeVideo ? Array.from(state.videos).indexOf(state.activeVideo) : -1,
      videos,
      isTransformed: state.isTransformed,
      currentScale: state.currentScale,
      autoFillScale: state.autoFillScale,
      adjustment: state.adjustment,
      containerWidth: state.containerWidth || (state.activeVideo ? getTargetDimensions(state.activeVideo).width : 0),
      containerHeight: state.containerHeight || (state.activeVideo ? getTargetDimensions(state.activeVideo).height : 0),
      isFullscreen: !!document.fullscreenElement,
      autoFillEnabled: state.autoFillEnabled,
      posX: state.posX,
      posY: state.posY,
      rotation: state.rotation,
      mirrorH: state.mirrorH,
      mirrorV: state.mirrorV,
      cinemaCrop: state.cinemaCrop,
      sharpness: state.sharpness,
      hdrBoost: state.hdrBoost,
      brightness: state.brightness,
      aspectRatio: state.aspectRatio || 'auto',
      gpuBackend: state.gpuProcessor.getActiveBackend(),
      gpuAvailable: diag.isSupported,
      gpuFps: diag.fps,
      gpuFrameTimeMs: diag.frameTimeMs,
      gpuDroppedFrames: diag.droppedFrames,
      gpuResolution: diag.resolution,
      isDrmProtected: state.gpuProcessor.isDRMProtected(),
    };
  }

  function handleInternalMessage(message: ExtensionMessage, sendResponse: (res: any) => void): boolean {
    try {
      switch (message.type) {
        case 'GET_VIDEO_STATUS':
          sendResponse(getVideoStatus());
          break;
          
        case 'ZOOM_TO_FILL':
          applyTransform();
          sendResponse(getVideoStatus());
          break;
          
        case 'RESET':
          resetTransformation();
          sendResponse(getVideoStatus());
          break;
          
        case 'SET_ADJUSTMENT': {
          const adjPayload = message.payload as { adjustment?: number } | number | undefined;
          const adjValue = typeof adjPayload === 'number' 
            ? adjPayload 
            : (adjPayload && typeof adjPayload === 'object' && 'adjustment' in adjPayload) 
              ? adjPayload.adjustment ?? 0 
              : 0;
          state.adjustment = adjValue;
          state.isTransformed = true;
          applyTransform();
          sendResponse(getVideoStatus());
          break;
        }

        case 'SET_ASPECT_RATIO': {
          const arPayload = message.payload as { aspectRatio?: string } | string | undefined;
          const arVal = typeof arPayload === 'string'
            ? arPayload
            : (arPayload && typeof arPayload === 'object' && 'aspectRatio' in arPayload)
              ? arPayload.aspectRatio ?? 'auto'
              : 'auto';
          state.aspectRatio = arVal;
          state.isTransformed = true;
          applyTransform();
          sendResponse(getVideoStatus());
          break;
        }

        case 'SET_BRIGHTNESS': {
          const bPayload = message.payload as { brightness?: number } | number | undefined;
          const bVal = typeof bPayload === 'number' ? bPayload : (bPayload?.brightness ?? 100);
          state.brightness = bVal;
          state.gpuProcessor.setBrightness(bVal);
          sendResponse(getVideoStatus());
          break;
        }

        case 'SET_GPU_EFFECTS': {
          const payload = message.payload as { sharpness?: number; hdrBoost?: number; quality?: number; abMode?: boolean } | undefined;
          if (payload) {
            if (payload.sharpness !== undefined) state.sharpness = payload.sharpness;
            if (payload.hdrBoost !== undefined) state.hdrBoost = payload.hdrBoost;
            state.gpuProcessor.setEffects(state.sharpness, state.hdrBoost);
            if (payload.quality !== undefined) state.gpuProcessor.setQuality(payload.quality);
            if (payload.abMode !== undefined) state.gpuProcessor.setSplitScreen(payload.abMode);
          }
          sendResponse(getVideoStatus());
          break;
        }

        case 'GET_GPU_DIAGNOSTICS': {
          sendResponse(state.gpuProcessor.getDiagnostics());
          break;
        }
          
        case 'SET_ADVANCED':
          if (message.payload && typeof message.payload === 'object') {
            const payload = message.payload as Partial<VideoSettings>;
            if (payload.posX !== undefined) state.posX = payload.posX;
            if (payload.posY !== undefined) state.posY = payload.posY;
            if (payload.rotation !== undefined) state.rotation = payload.rotation;
            if (payload.mirrorH !== undefined) state.mirrorH = payload.mirrorH;
            if (payload.mirrorV !== undefined) state.mirrorV = payload.mirrorV;
            if (payload.cinemaCrop !== undefined) state.cinemaCrop = payload.cinemaCrop;
            if (payload.sharpness !== undefined) {
              state.sharpness = payload.sharpness;
              state.gpuProcessor.setEffects(state.sharpness, state.hdrBoost);
            }
            if (payload.hdrBoost !== undefined) {
              state.hdrBoost = payload.hdrBoost;
              state.gpuProcessor.setEffects(state.sharpness, state.hdrBoost);
            }
            
            if (state.isTransformed) {
              applyTransform();
            }
          }
          sendResponse(getVideoStatus());
          break;
          
        case 'TOGGLE_AUTO_FILL': {
          const afPayload = message.payload as { enabled?: boolean } | boolean | undefined;
          if (typeof afPayload === 'boolean') {
            state.autoFillEnabled = afPayload;
          } else if (afPayload && typeof afPayload === 'object' && 'enabled' in afPayload) {
            state.autoFillEnabled = afPayload.enabled ?? false;
          }
          sendResponse(getVideoStatus());
          break;
        }
          
        case 'SELECT_VIDEO': {
          const selPayload = message.payload as { index?: number } | number | undefined;
          const selIndex = typeof selPayload === 'number' 
            ? selPayload 
            : (selPayload && typeof selPayload === 'object' && 'index' in selPayload) 
              ? selPayload.index ?? 0 
              : -1;
          if (selIndex >= 0) {
            const videoArray = Array.from(state.videos);
            if (videoArray[selIndex]) {
              if (state.activeVideo) resetTransformation();
              state.activeVideo = videoArray[selIndex];
              observeVideo(state.activeVideo);
              state.gpuProcessor.attach(state.activeVideo);
              state.gpuProcessor.setEffects(state.sharpness, state.hdrBoost);
            }
          }
          sendResponse(getVideoStatus());
          break;
        }

        case 'SAVE_SITE_SETTINGS': {
          const hostname = window.location.hostname;
          chrome.storage.local.get(['siteSettings'], (result) => {
            const siteSettings = (result.siteSettings as Record<string, any>) || {};
            siteSettings[hostname] = {
              hostname,
              enabled: true,
              settings: {
                autoFill: state.autoFillEnabled,
                adjustment: state.adjustment,
                posX: state.posX,
                posY: state.posY,
                rotation: state.rotation,
                mirrorH: state.mirrorH,
                mirrorV: state.mirrorV,
                cinemaCrop: state.cinemaCrop,
                sharpness: state.sharpness,
                hdrBoost: state.hdrBoost,
                aspectRatio: state.aspectRatio,
              }
            };
            chrome.storage.local.set({ siteSettings }, () => {
              sendResponse({ success: true, status: getVideoStatus() });
            });
          });
          return true;
        }

        case 'RESET_SITE_SETTINGS': {
          const hostname = window.location.hostname;
          chrome.storage.local.get(['siteSettings'], (result) => {
            const siteSettings = (result.siteSettings as Record<string, any>) || {};
            delete siteSettings[hostname];
            chrome.storage.local.set({ siteSettings }, () => {
              sendResponse({ success: true, status: getVideoStatus() });
            });
          });
          return true;
        }

        default:
          sendResponse(null);
          break;
      }
    } catch (e) {
      console.error('[UWVF] Message handling error:', e);
      sendResponse(null);
    }
    return true;
  }

  // Chrome Extension Messaging
  chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
    return handleInternalMessage(message, sendResponse);
  });

  // Test Bridge for Automated Browser Testing
  window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data || !event.data.__uwvf_test_req) return;
    const { id, type, payload } = event.data;
    handleInternalMessage({ type, payload } as ExtensionMessage, (result) => {
      window.postMessage({ __uwvf_test_res: true, id, result }, '*');
    });
  });

  // Load initial settings for site
  chrome.storage?.local?.get(['siteSettings', 'globalSettings'], (result) => {
    if (!result) return;
    const hostname = window.location.hostname;
    const siteSetting = (result.siteSettings as Record<string, any>)?.[hostname];
    
    if (siteSetting?.settings) {
      if (siteSetting.settings.autoFill !== undefined) state.autoFillEnabled = siteSetting.settings.autoFill;
      if (siteSetting.settings.adjustment !== undefined) state.adjustment = siteSetting.settings.adjustment;
      if (siteSetting.settings.posX !== undefined) state.posX = siteSetting.settings.posX;
      if (siteSetting.settings.posY !== undefined) state.posY = siteSetting.settings.posY;
      if (siteSetting.settings.rotation !== undefined) state.rotation = siteSetting.settings.rotation;
      if (siteSetting.settings.mirrorH !== undefined) state.mirrorH = siteSetting.settings.mirrorH;
      if (siteSetting.settings.mirrorV !== undefined) state.mirrorV = siteSetting.settings.mirrorV;
      if (siteSetting.settings.cinemaCrop !== undefined) state.cinemaCrop = siteSetting.settings.cinemaCrop;
      if (siteSetting.settings.sharpness !== undefined) state.sharpness = siteSetting.settings.sharpness;
      if (siteSetting.settings.hdrBoost !== undefined) state.hdrBoost = siteSetting.settings.hdrBoost;
      if (siteSetting.settings.aspectRatio !== undefined) state.aspectRatio = siteSetting.settings.aspectRatio;
    } else {
      if (result.globalSettings?.autoFillDefault !== undefined) {
        state.autoFillEnabled = result.globalSettings.autoFillDefault;
      }
      if (result.globalSettings?.defaultSharpness !== undefined) {
        state.sharpness = result.globalSettings.defaultSharpness;
      }
      if (result.globalSettings?.defaultHdrBoost !== undefined) {
        state.hdrBoost = result.globalSettings.defaultHdrBoost;
      }
      if (result.globalSettings?.defaultAspectRatio !== undefined) {
        state.aspectRatio = result.globalSettings.defaultAspectRatio;
      }
    }

    // Global brightness applies across all sites
    if (result.globalSettings?.brightness !== undefined) {
      state.brightness = result.globalSettings.brightness;
    }

    if (result.globalSettings?.defaultCinemaCrop && state.cinemaCrop === 'off') {
      state.cinemaCrop = result.globalSettings.defaultCinemaCrop;
    }

    if (state.sharpness > 0 || state.hdrBoost > 0 || state.brightness !== 100) {
      state.gpuProcessor.setEffects(state.sharpness, state.hdrBoost, state.brightness);
    }
  });

  // Listen for global storage changes (e.g. brightness adjusted in popup or options page)
  chrome.storage?.onChanged?.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.globalSettings?.newValue) {
      const newBright = changes.globalSettings.newValue.brightness;
      if (newBright !== undefined && newBright !== state.brightness) {
        state.brightness = newBright;
        state.gpuProcessor.setBrightness(newBright);
      }
    }
  });

  // --- INIT ---
  setupObservers();
  setupSPASupport();

  console.log('[UWVF] Content script initialized');
})();
