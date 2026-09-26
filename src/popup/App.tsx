import React, { useEffect, useState, useCallback, useRef } from 'react';
import { VideoStatus, ExtensionMessage } from '../types';
import { LogoIcon, SettingsIcon, ZoomIcon, SharpnessIcon, HdrIcon, BrightnessIcon } from './components/Icons';
import { Slider } from './components/Slider';
import { PresetDropdown, Preset } from './components/PresetDropdown';

export default function App() {
  const [status, setStatus] = useState<VideoStatus | null>(null);
  const [adjustment, setAdjustment] = useState<number>(0);
  const [sharpness, setSharpness] = useState<number>(0);
  const [hdrBoost, setHdrBoost] = useState<number>(0);
  const [brightness, setBrightness] = useState<number>(100);
  const [aspectRatio, setAspectRatio] = useState<string>('auto');
  const [isReady, setIsReady] = useState(false);

  const sendMessage = useCallback((msg: ExtensionMessage, callback?: (res: any) => void) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, msg, (response) => {
          if (chrome.runtime.lastError) {
            return;
          }
          if (callback && response !== undefined) {
            callback(response);
          }
        });
      }
    });
  }, []);

  const fetchStatus = useCallback(() => {
    sendMessage({ type: 'GET_VIDEO_STATUS' } as ExtensionMessage, (res: VideoStatus) => {
      if (res) {
        setStatus(res);
        setIsReady(true);
        if (res.adjustment !== undefined) setAdjustment(res.adjustment);
        if (res.sharpness !== undefined) setSharpness(res.sharpness);
        if (res.hdrBoost !== undefined) setHdrBoost(res.hdrBoost);
        if (res.brightness !== undefined) setBrightness(res.brightness);
        if (res.aspectRatio !== undefined) setAspectRatio(res.aspectRatio);
      }
    });
  }, [sendMessage]);

  useEffect(() => {
    chrome.storage?.local?.get(['globalSettings'], (res) => {
      if (res?.globalSettings?.brightness !== undefined) {
        setBrightness(res.globalSettings.brightness);
      }
    });
    fetchStatus();
    const interval = setInterval(fetchStatus, 1000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  // Zoom to Fill toggle handler
  const handleToggleZoom = () => {
    if (!status?.detected) return;
    const shouldFill = !status.isTransformed;
    const msgType = shouldFill ? 'ZOOM_TO_FILL' : 'RESET';
    
    // Optimistic update
    setStatus((prev) => (prev ? { ...prev, isTransformed: shouldFill } : prev));
    
    sendMessage({ type: msgType } as ExtensionMessage, (res: VideoStatus) => {
      if (res) setStatus(res);
    });
  };

  // Screen Size / Aspect Ratio 1-Click Selection
  const handleSelectAspectRatio = (ratio: string) => {
    setAspectRatio(ratio);
    setStatus((prev) => (prev ? { ...prev, aspectRatio: ratio, isTransformed: true } : prev));
    sendMessage({
      type: 'SET_ASPECT_RATIO',
      payload: { aspectRatio: ratio },
    } as ExtensionMessage, (res: VideoStatus) => {
      if (res) setStatus(res);
    });
  };

  // Crop / Zoom Slider Debounce
  const adjustmentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleAdjustmentChange = (val: number) => {
    setAdjustment(val);
    setStatus((prev) => (prev ? { ...prev, adjustment: val, isTransformed: true } : prev));

    if (adjustmentTimer.current) clearTimeout(adjustmentTimer.current);
    adjustmentTimer.current = setTimeout(() => {
      sendMessage({ type: 'SET_ADJUSTMENT', payload: { adjustment: val } } as ExtensionMessage);
    }, 30);
  };

  // Reset Crop / Zoom adjustment to 0%
  const handleResetAdjustment = () => {
    if (adjustmentTimer.current) clearTimeout(adjustmentTimer.current);
    setAdjustment(0);
    setStatus((prev) => (prev ? { ...prev, adjustment: 0 } : prev));
    sendMessage({
      type: 'SET_ADJUSTMENT',
      payload: { adjustment: 0 },
    } as ExtensionMessage);
  };

  // Reset Brightness to system/default (100%)
  const handleResetBrightness = () => {
    if (brightnessTimer.current) clearTimeout(brightnessTimer.current);
    setBrightness(100);
    sendMessage({
      type: 'SET_BRIGHTNESS',
      payload: { brightness: 100 },
    } as ExtensionMessage);
    chrome.storage?.local?.get(['globalSettings'], (res) => {
      const currentGlobal = res?.globalSettings || {};
      chrome.storage?.local?.set({
        globalSettings: {
          ...currentGlobal,
          brightness: 100,
        },
      });
    });
  };

  // Sharpness Slider Debounce
  const sharpnessTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSharpnessChange = (val: number) => {
    setSharpness(val);
    if (sharpnessTimer.current) clearTimeout(sharpnessTimer.current);
    sharpnessTimer.current = setTimeout(() => {
      sendMessage({
        type: 'SET_GPU_EFFECTS',
        payload: { sharpness: val, hdrBoost },
      } as ExtensionMessage);
    }, 30);
  };

  // HDR Boost Slider Debounce
  const hdrTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleHdrBoostChange = (val: number) => {
    setHdrBoost(val);
    if (hdrTimer.current) clearTimeout(hdrTimer.current);
    hdrTimer.current = setTimeout(() => {
      sendMessage({
        type: 'SET_GPU_EFFECTS',
        payload: { sharpness, hdrBoost: val },
      } as ExtensionMessage);
    }, 30);
  };

  // Brightness Slider Debounce (Global)
  const brightnessTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleBrightnessChange = (val: number) => {
    setBrightness(val);
    if (brightnessTimer.current) clearTimeout(brightnessTimer.current);
    brightnessTimer.current = setTimeout(() => {
      sendMessage({
        type: 'SET_BRIGHTNESS',
        payload: { brightness: val },
      } as ExtensionMessage);

      // Save globally across all tabs and future playback
      chrome.storage?.local?.get(['globalSettings'], (res) => {
        const currentGlobal = res?.globalSettings || {};
        chrome.storage?.local?.set({
          globalSettings: {
            ...currentGlobal,
            brightness: val,
          },
        });
      });
    }, 25);
  };

  // Preset Selection
  const handleSelectPreset = (preset: Preset) => {
    setSharpness(preset.sharpness);
    setHdrBoost(preset.hdrBoost);
    sendMessage({
      type: 'SET_GPU_EFFECTS',
      payload: { sharpness: preset.sharpness, hdrBoost: preset.hdrBoost },
    } as ExtensionMessage);
  };

  const openOptions = () => {
    chrome.runtime.openOptionsPage();
  };

  const hasVideo = status?.detected ?? false;
  const isZoomActive = status?.isTransformed ?? false;
  
  // Check if current site uses DRM (e.g. Hotstar, Prime Video, Netflix)
  const isDrmProtected = status?.isDrmProtected === true || status?.gpuBackend === 'direct-gpu';

  // Reliable slider bounds: -50% to +50% allows smooth, symmetric zoom control
  const minAdjustment = -50;
  const maxAdjustment = 50;

  // Format adjustment display: e.g. "12%", "+12%", "0%"
  const formatAdjustment = (val: number): string => {
    if (val === 0) return '0%';
    return `${val > 0 ? '+' : ''}${val}%`;
  };

  return (
    <div className={`popup-panel ${!hasVideo ? 'no-video-state' : ''}`}>
      {/* 1. Header */}
      <header className="panel-header">
        <div className="brand-group">
          <div className="brand-icon-wrapper" aria-hidden="true">
            <img src="/icons/icon48.png" alt="UltraWide Video Fill Pro" className="brand-logo-img" />
          </div>
          <div className="brand-titles">
            <h1 className="brand-title">UltraWide</h1>
            <span className="brand-subtitle">Video Fill Pro</span>
          </div>
        </div>

        <div className="header-meta">
          <div
            className={`status-pill ${hasVideo ? 'active' : 'inactive'}`}
            title={hasVideo ? 'Video stream active' : 'No compatible video found'}
          >
            <span className="status-dot" />
            <span className="status-text">{hasVideo ? 'Active' : 'No Video'}</span>
          </div>

          <button
            type="button"
            className="settings-icon-btn"
            onClick={openOptions}
            aria-label="Open Extension Settings"
            title="Settings"
          >
            <SettingsIcon size={18} />
          </button>
        </div>
      </header>

      {/* 2. Main Content Control Stack */}
      <main className="controls-stack">
        {/* Zoom to Fill Control Row */}
        <section
          className={`control-row zoom-row ${isZoomActive ? 'active' : ''} ${!hasVideo ? 'disabled' : ''}`}
          onClick={handleToggleZoom}
          role="button"
          tabIndex={hasVideo ? 0 : -1}
          aria-label="Toggle Zoom to Fill"
          aria-pressed={isZoomActive}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleToggleZoom();
            }
          }}
        >
          <div className="zoom-info">
            <div className="zoom-title-row">
              <span className="control-icon zoom-icon" aria-hidden="true">
                <ZoomIcon size={18} />
              </span>
              <span className="zoom-title">Zoom to Fill</span>
            </div>
            <span className="zoom-subtitle">
              {hasVideo ? 'Automatically fills the video' : 'No video detected'}
            </span>
          </div>

          <div
            className={`large-toggle ${isZoomActive ? 'on' : 'off'}`}
            role="switch"
            aria-checked={isZoomActive}
            aria-label="Zoom to Fill switch"
          >
            <div className="toggle-thumb" />
          </div>
        </section>

        <div className="section-separator" />

        {/* Screen Size / Aspect Ratio 1-Click Selector */}
        <section className="control-section screen-sizes-section" aria-label="Screen Size Presets">
          <div className="screen-sizes-header">
            <span className="screen-sizes-title">Screen Size</span>
            <span className="screen-sizes-badge">
              {aspectRatio === 'auto' ? 'Auto Fit' : aspectRatio}
            </span>
          </div>
          <div className="aspect-ratio-pills" role="radiogroup" aria-label="Screen aspect ratio presets">
            {[
              { id: 'auto', label: 'Auto' },
              { id: '21:9', label: '21:9' },
              { id: '32:9', label: '32:9' },
              { id: '16:9', label: '16:9' },
              { id: '16:10', label: '16:10' },
            ].map((preset) => {
              const isActive = (aspectRatio || 'auto') === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  className={`ar-pill ${isActive ? 'active' : ''}`}
                  disabled={!hasVideo}
                  onClick={() => handleSelectAspectRatio(preset.id)}
                  title={`Fit to ${preset.label} screen`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </section>

        <div className="section-separator" />

        {/* Crop / Zoom Slider */}
        <section className="control-section">
          <Slider
            label="Crop / Zoom"
            value={adjustment}
            min={minAdjustment}
            max={maxAdjustment}
            step={1}
            displayValue={formatAdjustment(adjustment)}
            minLabel="Less crop"
            maxLabel="More crop"
            variant="blue"
            disabled={!hasVideo}
            onChange={handleAdjustmentChange}
            showReset={adjustment !== 0}
            onReset={handleResetAdjustment}
            resetTitle="Reset crop to 0%"
            aria-label="Crop and zoom scale adjustment"
          />
        </section>

        <div className="section-separator" />

        {/* Global Brightness Slider with Reset to System Brightness */}
        <section className="control-section">
          <Slider
            label="Brightness"
            icon={<BrightnessIcon size={16} />}
            value={brightness}
            min={0}
            max={200}
            step={1}
            displayValue={`${brightness}%`}
            minLabel="Dimmer"
            maxLabel="Brighter"
            variant="amber"
            disabled={!hasVideo}
            onChange={handleBrightnessChange}
            showReset={brightness !== 100}
            onReset={handleResetBrightness}
            resetTitle="Reset to system brightness (100%)"
            aria-label="Global Video Brightness control"
          />
        </section>

        {/* GPU Video Enhancements (Sharpness & HDR Boost & Presets) */}
        {/* Completely removed on DRM-protected sites per user specifications */}
        {!isDrmProtected && (
          <>
            <div className="section-separator" />

            <section className="control-section">
              <Slider
                label="Sharpness"
                icon={<SharpnessIcon size={16} />}
                value={sharpness}
                min={0}
                max={100}
                step={1}
                displayValue={`${sharpness}%`}
                minLabel="Smoother"
                maxLabel="Sharper"
                variant="violet"
                disabled={!hasVideo}
                onChange={handleSharpnessChange}
                aria-label="GPU Sharpness enhancement"
              />
            </section>

            <div className="section-separator" />

            <section className="control-section">
              <Slider
                label="HDR Boost"
                icon={<HdrIcon size={16} />}
                value={hdrBoost}
                min={0}
                max={100}
                step={1}
                displayValue={`${hdrBoost}%`}
                minLabel="Natural"
                maxLabel="More vivid"
                variant="hdr"
                disabled={!hasVideo}
                onChange={handleHdrBoostChange}
                aria-label="GPU HDR Dynamic Range Boost"
              />
            </section>

            <div className="section-separator" />

            {/* Presets Dropdown */}
            <section className="control-section presets-section">
              <PresetDropdown
                currentSharpness={sharpness}
                currentHdrBoost={hdrBoost}
                onSelectPreset={handleSelectPreset}
                disabled={!hasVideo}
              />
            </section>
          </>
        )}
      </main>

      {/* 3. Subtle Footer */}
      <footer className="panel-footer" aria-hidden="true">
        <span>UltraWide Video Fill Pro v1.0.0</span>
      </footer>
    </div>
  );
}
