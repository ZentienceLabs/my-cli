// Type definitions
export type Mode = 'command' | 'chat' | 'settings' | 'agent' | 'search';

export type SettingsConfig = {
  provider: string;
  model: string;
  apiKey: string;
};
