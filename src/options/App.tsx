import React, { useEffect, useState } from 'react';
import { StorageService } from '../services/storage';
import { GlobalSettings, SiteSettings, StorageData, CinemaCropLevel } from '../types';

const App: React.FC = () => {
  const [data, setData] = useState<StorageData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    const storageData = await StorageService.getAll();
    setData(storageData);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const updateGlobalSetting = async <K extends keyof GlobalSettings>(key: K, value: GlobalSettings[K]) => {
    if (!data) return;
    const newSettings = { ...data.globalSettings, [key]: value };
    await StorageService.saveGlobalSettings(newSettings);
    setData({ ...data, globalSettings: newSettings });
  };

  const removeSite = async (hostname: string) => {
    if (!data) return;
    await StorageService.removeSiteSettings(hostname);
    const newSiteSettings = { ...data.siteSettings };
    delete newSiteSettings[hostname];
    setData({ ...data, siteSettings: newSiteSettings });
  };

  const resetAll = async () => {
    if (window.confirm('Are you sure you want to reset all settings to defaults? This will remove all saved site preferences.')) {
      await StorageService.resetAll();
      loadData();
    }
  };

  if (loading || !data) {
    return <div className="loading">Loading...</div>;
  }

  const { globalSettings, siteSettings } = data;
  const siteKeys = Object.keys(siteSettings);

  return (
    <div className="options-container">
      <header className="options-header">
        <div className="options-brand-wrap">
          <img src="/icons/icon48.png" alt="UltraWide Video Fill Pro" className="options-logo-img" />
          <div className="options-titles">
            <h1>UltraWide Video Fill</h1>
            <p>Settings &amp; Preferences</p>
          </div>
        </div>
      </header>

      <section>
        <h2>General</h2>
        <div className="setting-row">
          <label htmlFor="autoFillDefault">Auto Fill by default</label>
          <input 
            type="checkbox" 
            id="autoFillDefault" 
            checked={globalSettings.autoFillDefault}
            onChange={(e) => updateGlobalSetting('autoFillDefault', e.target.checked)}
          />
        </div>
        <div className="setting-row">
          <label htmlFor="smoothTransitions">Smooth transitions</label>
          <input 
            type="checkbox" 
            id="smoothTransitions" 
            checked={globalSettings.smoothTransitions}
            onChange={(e) => updateGlobalSetting('smoothTransitions', e.target.checked)}
          />
        </div>
        <div className="setting-row">
          <label htmlFor="transitionDuration">Transition duration (ms)</label>
          <input 
            type="number" 
            id="transitionDuration" 
            value={globalSettings.transitionDuration}
            min="0"
            max="2000"
            step="50"
            disabled={!globalSettings.smoothTransitions}
            onChange={(e) => updateGlobalSetting('transitionDuration', parseInt(e.target.value, 10) || 200)}
          />
        </div>
        <div className="setting-row">
          <label htmlFor="defaultCinemaCrop">Default cinema crop</label>
          <select 
            id="defaultCinemaCrop"
            value={globalSettings.defaultCinemaCrop}
            onChange={(e) => updateGlobalSetting('defaultCinemaCrop', e.target.value as CinemaCropLevel)}
          >
            <option value="off">Off</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        <div className="setting-row">
          <label htmlFor="globalBrightness">Default Brightness ({globalSettings.brightness ?? 100}%)</label>
          <input 
            type="range" 
            id="globalBrightness" 
            min="0"
            max="200"
            step="1"
            value={globalSettings.brightness ?? 100}
            onChange={(e) => updateGlobalSetting('brightness', parseInt(e.target.value, 10) || 100)}
          />
        </div>
      </section>

      <section>
        <h2>GPU Video Enhancement</h2>
        <div className="setting-row">
          <label htmlFor="defaultSharpness">Default Sharpness (0–100%)</label>
          <input 
            type="number" 
            id="defaultSharpness" 
            min="0"
            max="100"
            value={globalSettings.defaultSharpness ?? 0}
            onChange={(e) => updateGlobalSetting('defaultSharpness', Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0)))}
          />
        </div>
        <div className="setting-row">
          <label htmlFor="defaultHdrBoost">Default HDR Boost (0–100%)</label>
          <input 
            type="number" 
            id="defaultHdrBoost" 
            min="0"
            max="100"
            value={globalSettings.defaultHdrBoost ?? 0}
            onChange={(e) => updateGlobalSetting('defaultHdrBoost', Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0)))}
          />
        </div>
        <div className="setting-row">
          <label htmlFor="gpuQualityPreference">GPU Quality Preference</label>
          <select 
            id="gpuQualityPreference"
            value={globalSettings.gpuQualityPreference || 'auto'}
            onChange={(e) => updateGlobalSetting('gpuQualityPreference', e.target.value as any)}
          >
            <option value="auto">Auto (Dynamically Balanced)</option>
            <option value="performance">Performance (Fast cross-sampling)</option>
            <option value="balanced">Balanced (High efficiency)</option>
            <option value="quality">Quality (Full 3x3 weighted sampling)</option>
          </select>
        </div>
      </section>

      <section>
        <h2>Keyboard Shortcuts</h2>
        <div className="shortcuts-list">
          <div className="shortcut-row">
            <span>Zoom to Fill</span>
            <kbd>Alt + Shift + F</kbd>
          </div>
          <div className="shortcut-row">
            <span>Reset</span>
            <kbd>Alt + Shift + R</kbd>
          </div>
        </div>
        <div className="shortcuts-info">
          <a href="chrome://extensions/shortcuts" target="_blank" rel="noreferrer">
            Customize shortcuts in Chrome settings
          </a>
        </div>
      </section>

      <section>
        <h2>Site Settings</h2>
        {siteKeys.length === 0 ? (
          <p className="no-sites">No site-specific settings saved.</p>
        ) : (
          <ul className="site-list">
            {siteKeys.map((hostname) => (
              <li key={hostname} className="site-item">
                <span className="site-name">{hostname}</span>
                <div className="site-actions">
                  <span className="site-status">
                    Auto Fill: {siteSettings[hostname].enabled ? 'ON' : 'OFF'}
                  </span>
                  <button onClick={() => removeSite(hostname)} className="btn-danger-outline">
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="danger-zone">
        <h2>Danger Zone</h2>
        <button onClick={resetAll} className="btn-danger">
          Reset All Settings
        </button>
      </section>
    </div>
  );
};

export default App;
