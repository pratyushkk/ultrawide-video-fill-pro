import { StorageService } from '../services/storage';
import type { ExtensionMessage } from '../types';

// On install, set defaults
chrome.runtime.onInstalled.addListener(async () => {
  const settings = await StorageService.getGlobalSettings();
  // Settings already have defaults, just ensure they exist
  await StorageService.saveGlobalSettings(settings);
});

// Handle keyboard commands
chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  
  switch (command) {
    case 'zoom-to-fill':
      await chrome.tabs.sendMessage(tab.id, { type: 'ZOOM_TO_FILL' });
      break;
    case 'reset-video':
      await chrome.tabs.sendMessage(tab.id, { type: 'RESET' });
      break;
  }
});

// Handle messages from popup/options
chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
  // Messages that need forwarding to content scripts
  if (message.tabId) {
    chrome.tabs.sendMessage(message.tabId, message)
      .then(sendResponse)
      .catch(() => sendResponse(null));
    return true;
  }
  
  // Handle storage-related messages
  if (message.type === 'GET_SETTINGS') {
    StorageService.getAll().then(sendResponse);
    return true;
  }
  
  if (message.type === 'SAVE_SITE_SETTINGS') {
    const { hostname, settings } = message.payload as { hostname: string; settings: any };
    StorageService.saveSiteSettings(hostname, settings).then(() => sendResponse({ success: true }));
    return true;
  }
  
  if (message.type === 'RESET_SITE_SETTINGS') {
    const { hostname } = message.payload as { hostname: string };
    StorageService.removeSiteSettings(hostname).then(() => sendResponse({ success: true }));
    return true;
  }
  
  return false;
});
