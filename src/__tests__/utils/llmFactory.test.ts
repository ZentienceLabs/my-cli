import { LLMFactory, LLMProvider } from '../../utils/llmFactory';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatOpenAI } from '@langchain/openai';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';

// Mock the LLM classes
jest.mock('@langchain/anthropic', () => ({
  ChatAnthropic: jest.fn().mockImplementation(() => ({
    invoke: jest.fn().mockResolvedValue({ content: 'Anthropic response' })
  }))
}));

jest.mock('@langchain/openai', () => ({
  ChatOpenAI: jest.fn().mockImplementation(() => ({
    invoke: jest.fn().mockResolvedValue({ content: 'OpenAI response' })
  }))
}));

jest.mock('@langchain/google-genai', () => ({
  ChatGoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    invoke: jest.fn().mockResolvedValue({ content: 'Google response' })
  }))
}));

describe('LLMFactory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createLLM', () => {
    it('should create an Anthropic LLM instance', () => {
      const llm = LLMFactory.createLLM('Anthropic', 'test-api-key', 'claude-3-opus-20240229');
      
      expect(ChatAnthropic).toHaveBeenCalledWith({
        apiKey: 'test-api-key',
        model: 'claude-3-opus-20240229',
        temperature: 0.7
      });
      expect(llm).toBeDefined();
    });

    it('should create an OpenAI LLM instance', () => {
      const llm = LLMFactory.createLLM('OpenAI', 'test-api-key', 'gpt-4');
      
      expect(ChatOpenAI).toHaveBeenCalledWith({
        apiKey: 'test-api-key',
        modelName: 'gpt-4',
        temperature: 0.7
      });
      expect(llm).toBeDefined();
    });

    it('should create a Google LLM instance', () => {
      const llm = LLMFactory.createLLM('Google', 'test-api-key', 'gemini-pro');
      
      expect(ChatGoogleGenerativeAI).toHaveBeenCalledWith({
        apiKey: 'test-api-key',
        model: 'gemini-pro',
        temperature: 0.7
      });
      expect(llm).toBeDefined();
    });

    it('should throw an error for unsupported provider', () => {
      expect(() => {
        // @ts-ignore - Testing invalid provider
        LLMFactory.createLLM('UnsupportedProvider', 'test-api-key', 'model');
      }).toThrow('Unsupported LLM provider: UnsupportedProvider');
    });
  });

  describe('isValidProviderModel', () => {
    it('should return true for valid provider', () => {
      expect(LLMFactory.isValidProviderModel('Anthropic', 'claude-3-opus-20240229')).toBe(true);
      expect(LLMFactory.isValidProviderModel('OpenAI', 'gpt-4')).toBe(true);
      expect(LLMFactory.isValidProviderModel('Google', 'gemini-pro')).toBe(true);
    });

    it('should return false for invalid provider', () => {
      expect(LLMFactory.isValidProviderModel('', 'model')).toBe(false);
      expect(LLMFactory.isValidProviderModel('InvalidProvider', 'model')).toBe(false);
    });

    it('should return false for missing model', () => {
      expect(LLMFactory.isValidProviderModel('Anthropic', '')).toBe(false);
    });
  });
});
