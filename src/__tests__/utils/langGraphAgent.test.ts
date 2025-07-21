import { createLangGraphAgent } from '../../utils/langGraphAgent';
import { LLMFactory, LLMProvider } from '../../utils/llmFactory';

// Mock the LLM factory
jest.mock('../../utils/llmFactory', () => {
  const mockInvoke = jest.fn().mockImplementation(async (messages) => {
    return { content: `Mock response for: ${messages[messages.length - 1]?.content || 'empty input'}` };
  });
  
  return {
    LLMProvider: {
      Anthropic: 'Anthropic',
      OpenAI: 'OpenAI',
      Google: 'Google'
    },
    LLMFactory: {
      createLLM: jest.fn().mockImplementation(() => ({
        invoke: mockInvoke
      })),
      isValidProviderModel: jest.fn().mockReturnValue(true)
    }
  };
});

describe('LangGraph Agent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createLangGraphAgent', () => {
    it('should create a valid agent function', () => {
      const agent = createLangGraphAgent('Anthropic', 'test-api-key', 'claude-3-opus-20240229');
      expect(typeof agent).toBe('function');
      expect(LLMFactory.createLLM).toHaveBeenCalledWith('Anthropic', 'test-api-key', 'claude-3-opus-20240229');
    });

    it('should handle chat mode correctly', async () => {
      const agent = createLangGraphAgent('Anthropic', 'test-api-key', 'claude-3-opus-20240229');
      const response = await agent('Hello, how are you?', 'chat', []);
      
      expect(response).toContain('Mock response');
    });

    it('should handle agent mode correctly', async () => {
      const agent = createLangGraphAgent('Anthropic', 'test-api-key', 'claude-3-opus-20240229');
      const response = await agent('git status', 'agent', []);
      
      expect(response).toContain('Mock response');
    });

    it('should handle empty input gracefully', async () => {
      const agent = createLangGraphAgent('Anthropic', 'test-api-key', 'claude-3-opus-20240229');
      const response = await agent('', 'chat', []);
      
      expect(response).toContain('Invalid input');
    });

    it('should maintain chat history correctly', async () => {
      const agent = createLangGraphAgent('Anthropic', 'test-api-key', 'claude-3-opus-20240229');
      
      // First message
      await agent('Hello', 'chat', []);
      
      // Second message with history
      const history: Array<{ role: 'user' | 'assistant'; content: string }> = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there! How can I help you today?' }
      ];
      
      const response = await agent('How are you?', 'chat', history);
      expect(response).toContain('Mock response');
    });
  });
});
