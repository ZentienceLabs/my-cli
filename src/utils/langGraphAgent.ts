import { ChatAnthropic } from "@langchain/anthropic";
import { HumanMessage } from "@langchain/core/messages";

/**
 * Create a simple LangChain agent using Anthropic
 * @param apiKey - The Anthropic API key
 * @param model - The model to use (e.g., "claude-3-opus-20240229")
 * @returns A function that takes a user input and returns an agent response
 */
export function createLangGraphAgent(apiKey: string, model: string) {
  // Initialize the LLM
  const llm = new ChatAnthropic({
    apiKey,
    model,
  });

  // Return a function that processes user input and returns a response
  return async (userInput: string): Promise<string> => {
    try {
      // Add agent instructions to the user input
      const agentPrompt = `You are a specialized AI assistant focused ONLY on command-line operations and technical commands.

      I can help with:
      - Operating system commands (Linux, Windows, macOS)
      - Development tools (git, npm, docker, kubernetes, etc.)
      - Terminal operations and shell scripting
      - Command syntax, options, and usage examples
      - Tool-specific commands and configurations

      For command-related questions, respond with structured information in this format:
      [COMMAND_RESPONSE]
      COMMAND: command_name
      DESCRIPTION: Brief description of what the command does
      OPTIONS: Key command-line options and flags (if applicable)
      EXAMPLES: Practical usage examples (if applicable)
      [/COMMAND_RESPONSE]

      You can include multiple command blocks if the query involves multiple commands.

      IMPORTANT: If the user asks about non-command topics (general conversation, explanations of concepts not related to commands, personal questions, etc.), politely redirect them by saying:
      "I'm specialized in command-line operations only. For general conversations and other topics, please switch to chat mode using Ctrl+C and selecting chat mode."

      USER REQUEST: ${userInput}`;
      
      // Create the message with enhanced prompt
      const message = new HumanMessage(agentPrompt);
      
      // Get the response from the LLM
      const response = await llm.invoke([message]);
      
      // Return the content as a string
      return response.content.toString();
    } catch (error) {
      console.error("Error in LangChain agent:", error);
      return `Error: ${(error as Error).message}`;
    }
  };
}
