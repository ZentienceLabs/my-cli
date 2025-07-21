import { ChatAnthropic } from "@langchain/anthropic";
import { ChatOpenAI } from "@langchain/openai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";

export type LLMProvider = 'Anthropic' | 'OpenAI' | 'Google';

/**
 * Factory for creating LLM instances based on provider and model
 */
export class LLMFactory {
  /**
   * Create an LLM instance based on provider and model
   * @param provider - The LLM provider (Anthropic, OpenAI, Google)
   * @param apiKey - The API key for the provider
   * @param model - The model to use
   * @returns A BaseChatModel instance
   */
  static createLLM(provider: LLMProvider, apiKey: string, model: string): BaseChatModel {
    
    
    switch (provider) {
      case 'Anthropic':
        return new ChatAnthropic({
          apiKey,
          model,
          temperature: 0.7,
        });
      
      case 'OpenAI':
        return new ChatOpenAI({
          apiKey,
          modelName: model,
          temperature: 0.7,
        });
      
      case 'Google':
        return new ChatGoogleGenerativeAI({
          apiKey,
          model: model,
          temperature: 0.7,
        });
      
      default:
        throw new Error(`Unsupported LLM provider: ${provider}`);
    }
  }

  /**
   * Check if the provider and model combination is valid
   * @param provider - The LLM provider
   * @param model - The model name
   * @returns True if valid, false otherwise
   */
  static isValidProviderModel(provider: string, model: string): boolean {
    // Basic validation - could be expanded with more specific model validation
    if (!provider || !model) {
      return false;
    }

    // Check if provider is supported
    const supportedProviders: LLMProvider[] = ['Anthropic', 'OpenAI', 'Google'];
    return supportedProviders.includes(provider as LLMProvider);
  }
}
