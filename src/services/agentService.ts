import { createLangGraphAgent } from '../utils/langGraphAgent';
import { SettingsConfig } from '../types/index';
import { LLMFactory, LLMProvider } from '../utils/llmFactory';

export type AgentFunction = (
  userInput: string,
  mode: 'chat' | 'agent',
  history: Array<{ role: 'user' | 'assistant'; content: string }>
) => Promise<string>;

export class AgentService {
  private static instance: AgentService;
  private currentAgent: AgentFunction | null = null;

  private constructor() {}

  static getInstance(): AgentService {
    if (!AgentService.instance) {
      AgentService.instance = new AgentService();
    }
    return AgentService.instance;
  }

  /**
   * Initialize the LangGraph agent with given settings
   */
  initialize(settings: SettingsConfig): boolean {
    console.log('AgentService: Initializing with settings:', {
      provider: settings.provider,
      hasApiKey: !!settings.apiKey,
      model: settings.model
    });

    // Check if we have valid settings
    if (!settings.provider || !settings.apiKey || !settings.model) {
      console.log('AgentService: Missing required settings - clearing agent');
      this.currentAgent = null;
      return false;
    }

    // Validate provider and model combination
    if (!LLMFactory.isValidProviderModel(settings.provider, settings.model)) {
      console.error('AgentService: Invalid provider/model combination:', settings.provider, settings.model);
      this.currentAgent = null;
      return false;
    }

    try {
      console.log('AgentService: Creating LangGraph agent with provider:', settings.provider, 'model:', settings.model);
      
      // Create agent using the factory with the appropriate provider
      const agent = createLangGraphAgent(
        settings.provider as LLMProvider,
        settings.apiKey,
        settings.model
      );
      
      console.log('AgentService: Agent created, type:', typeof agent);

      if (typeof agent === 'function') {
        console.log('AgentService: Agent successfully initialized');
        this.currentAgent = agent;
        return true;
      } else {
        console.error('AgentService: Agent is not a function:', agent);
        this.currentAgent = null;
      }
    } catch (error) {
      console.error('AgentService: Error initializing agent:', error);
      this.currentAgent = null;
    }
    
    return false;
  }

  /**
   * Get the current agent function
   */
  getAgent(): AgentFunction | null {
    return this.currentAgent;
  }

  /**
   * Check if agent is available
   */
  isAvailable(): boolean {
    return this.currentAgent !== null && typeof this.currentAgent === 'function';
  }

  /**
   * Process a request with the agent
   */
  async processRequest(
    userInput: string,
    mode: 'chat' | 'agent',
    history: Array<{ role: 'user' | 'assistant'; content: string }> = []
  ): Promise<string> {
    if (!this.isAvailable()) {
      throw new Error('Agent not available. Please check settings.');
    }

    try {
      return await this.currentAgent!(userInput, mode, history);
    } catch (error) {
      console.error('AgentService: Error processing request:', error);
      throw new Error(`Agent processing failed: ${(error as Error).message}`);
    }
  }

  /**
   * Clear the current agent
   */
  clear(): void {
    console.log('AgentService: Clearing agent');
    this.currentAgent = null;
  }
}

export const agentService = AgentService.getInstance();