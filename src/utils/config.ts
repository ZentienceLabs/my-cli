import { SettingsConfig } from '../types/index';
import { loadSettings as loadStorageSettings, saveSettings as saveStorageSettings } from './storage';

/**
 * Load settings from the user's home directory
 * @returns The settings configuration
 */
export const loadSettings = (): SettingsConfig => {
  const defaultConfig: SettingsConfig = {
    provider: 'Anthropic',
    model: 'claude-3-haiku-20240307',
    apiKey: '',
  };

  try {
    // Load settings from the home directory
    const storedSettings = loadStorageSettings();
    return { ...defaultConfig, ...storedSettings };
  } catch (error) {
    console.error('Error loading settings:', error);
    return defaultConfig;
  }
};

/**
 * Save settings to the user's home directory
 * @param settings The settings to save
 */
export const saveSettings = (settings: SettingsConfig): void => {
  try {
    saveStorageSettings(settings);
  } catch (error) {
    console.error('Error saving settings:', error);
  }
};
