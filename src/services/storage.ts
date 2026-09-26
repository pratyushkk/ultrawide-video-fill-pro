import { DEFAULT_GLOBAL_SETTINGS, DEFAULT_VIDEO_SETTINGS } from '../types';
import type { StorageData, GlobalSettings, SiteSettings, VideoSettings } from '../types';

/**
 * Storage service using Chrome Storage API.
 * All data is stored locally - nothing is sent externally.
 */
export class StorageService {
  /**
   * Get all storage data with defaults for missing values.
   */
  static async getAll(): Promise<StorageData> {
    try {
      const data = await chrome.storage.local.get(['globalSettings', 'siteSettings']);
      return {
        globalSettings: {
          ...DEFAULT_GLOBAL_SETTINGS,
          ...((data.globalSettings as Partial<GlobalSettings>) || {}),
        },
        siteSettings: (data.siteSettings as Record<string, SiteSettings>) || {},
      };
    } catch {
      return {
        globalSettings: { ...DEFAULT_GLOBAL_SETTINGS },
        siteSettings: {},
      };
    }
  }

  /**
   * Get global settings.
   */
  static async getGlobalSettings(): Promise<GlobalSettings> {
    const data = await StorageService.getAll();
    return data.globalSettings;
  }

  /**
   * Save global settings.
   */
  static async saveGlobalSettings(settings: Partial<GlobalSettings>): Promise<void> {
    const current = await StorageService.getGlobalSettings();
    await chrome.storage.local.set({
      globalSettings: { ...current, ...settings },
    });
  }

  /**
   * Get site-specific settings for a hostname.
   */
  static async getSiteSettings(hostname: string): Promise<SiteSettings | null> {
    const data = await StorageService.getAll();
    return data.siteSettings[hostname] || null;
  }

  /**
   * Save site-specific settings.
   */
  static async saveSiteSettings(hostname: string, settings: Partial<VideoSettings>): Promise<void> {
    const data = await StorageService.getAll();
    data.siteSettings[hostname] = {
      hostname,
      settings,
      enabled: true,
    };
    await chrome.storage.local.set({ siteSettings: data.siteSettings });
  }

  /**
   * Remove site-specific settings.
   */
  static async removeSiteSettings(hostname: string): Promise<void> {
    const data = await StorageService.getAll();
    delete data.siteSettings[hostname];
    await chrome.storage.local.set({ siteSettings: data.siteSettings });
  }

  /**
   * Get all site settings.
   */
  static async getAllSiteSettings(): Promise<Record<string, SiteSettings>> {
    const data = await StorageService.getAll();
    return data.siteSettings;
  }

  /**
   * Reset all settings to defaults.
   */
  static async resetAll(): Promise<void> {
    await chrome.storage.local.clear();
  }

  /**
   * Get effective settings for a site (merges global + site-specific).
   */
  static async getEffectiveSettings(hostname: string): Promise<VideoSettings> {
    const global = await StorageService.getGlobalSettings();
    const site = await StorageService.getSiteSettings(hostname);

    const defaults: VideoSettings = {
      ...DEFAULT_VIDEO_SETTINGS,
      autoFill: global.autoFillDefault,
      cinemaCrop: global.defaultCinemaCrop,
      sharpness: global.defaultSharpness,
      hdrBoost: global.defaultHdrBoost,
    };

    if (site?.settings) {
      return { ...defaults, ...site.settings };
    }

    return defaults;
  }
}
