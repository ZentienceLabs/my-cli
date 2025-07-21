import { useState, useEffect } from 'react';
import { agentService, AgentFunction } from '../services/agentService';
import { SettingsConfig } from '../types/index';
import { loadSettings } from '../utils/config';

export interface UseAgentReturn {
  agent: AgentFunction | null;
  isAvailable: boolean;
  initialize: (settings: SettingsConfig) => boolean;
  reinitialize: () => void;
  processRequest: (
    userInput: string,
    mode: 'chat' | 'agent',
    history: Array<{ role: 'user' | 'assistant'; content: string }>
  ) => Promise<string>;
}

export const useAgent = (initialSettings: SettingsConfig): UseAgentReturn => {
  const [agent, setAgent] = useState<AgentFunction | null>(null);

  const initialize = (settings: SettingsConfig): boolean => {
    const success = agentService.initialize(settings);
    setAgent(agentService.getAgent());
    return success;
  };

  const reinitialize = (): void => {
    const updatedSettings = loadSettings();
    const success = agentService.initialize(updatedSettings);
    setAgent(agentService.getAgent());
    
  };

  const processRequest = async (
    userInput: string,
    mode: 'chat' | 'agent',
    history: Array<{ role: 'user' | 'assistant'; content: string }> = []
  ): Promise<string> => {
    return agentService.processRequest(userInput, mode, history);
  };

  // Initialize on mount
  useEffect(() => {
    initialize(initialSettings);
  }, []);

  return {
    agent,
    isAvailable: agentService.isAvailable(),
    initialize,
    reinitialize,
    processRequest
  };
};