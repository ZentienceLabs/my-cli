import { ChatAnthropic } from "@langchain/anthropic";
import { HumanMessage, SystemMessage, BaseMessage } from "@langchain/core/messages";
import { StateGraph, END, START } from "@langchain/langgraph";
import { Annotation } from "@langchain/langgraph";

// Define the state interface using LangGraph's Annotation system
const AgentState = Annotation.Root({
  mode: Annotation<'chat' | 'agent'>(),
  input: Annotation<string>(),
  response: Annotation<string>(),
  history: Annotation<Array<{ role: 'user' | 'assistant'; content: string }>>(),
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
});

type AgentStateType = typeof AgentState.State;

/**
 * Create a LangGraph agent using Anthropic
 * @param apiKey - The Anthropic API key
 * @param model - The model to use (e.g., "claude-3-opus-20240229")
 * @returns A function that takes a user input, mode, and history and returns an agent response
 */
export function createLangGraphAgent(apiKey: string, model: string) {
  // Initialize the LLM
  const llm = new ChatAnthropic({
    apiKey,
    model,
    temperature: 0.7,
  });

  // Chat node - handles general conversation
  const chatNode = async (state: AgentStateType): Promise<Partial<AgentStateType>> => {
    try {
      console.log('Chat node state:', JSON.stringify(state, null, 2));
      
      // Build messages array
      const messages: BaseMessage[] = [
        new SystemMessage({ content: "You are a helpful AI assistant. Respond to the user's questions in a friendly and informative manner." })
      ];
      
      // Add history messages
      if (state.history && Array.isArray(state.history)) {
        for (const item of state.history) {
          if (item && item.role === 'user' && item.content && typeof item.content === 'string') {
            messages.push(new HumanMessage({ content: item.content }));
          } else if (item && item.role === 'assistant' && item.content && typeof item.content === 'string') {
            messages.push(new SystemMessage({ content: item.content }));
          }
        }
      }
      
      // Handle case where input is null or undefined
      if (state.input === null || state.input === undefined) {
        // Use a default message or get from history if available
        const defaultMessage = "Hello, how can I help you today?";
        console.log('Input is null or undefined, using default message');
        return {
          response: defaultMessage,
          messages: [...messages, new SystemMessage({ content: defaultMessage })]
        };
      }
      
      // Add current input - validate it's a string
      if (typeof state.input === 'string' && state.input.trim().length > 0) {
        console.log('Adding HumanMessage with content:', state.input);
        messages.push(new HumanMessage({ content: state.input }));
      } else {
        // Handle empty string or non-string input
        const errorMessage = `Invalid input: input must be a non-empty string, got: ${typeof state.input} - "${state.input}"`;
        console.error(errorMessage);
        return {
          response: errorMessage,
          messages: [...messages, new SystemMessage({ content: errorMessage })]
        };
      }
      
      // Get response from LLM
      const response = await llm.invoke(messages);
      
      return {
        response: response.content.toString(),
        messages: messages.concat([response])
      };
    } catch (error) {
      console.error("Error in chat node:", error);
      return {
        response: `Error: ${(error as Error).message}`,
        messages: []
      };
    }
  };

  // Agent node - handles command-specific queries
  const agentNode = async (state: AgentStateType): Promise<Partial<AgentStateType>> => {
    try {
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

USER REQUEST: ${state.input || 'No input provided'}`;

      // Build messages array - validate input
      if (!state.input || typeof state.input !== 'string') {
        throw new Error('Invalid input: input must be a non-empty string');
      }
      
      const messages: BaseMessage[] = [
        new HumanMessage({ content: agentPrompt })
      ];
      
      // Get response from LLM
      const response = await llm.invoke(messages);
      
      return {
        response: response.content.toString(),
        messages: messages.concat([response])
      };
    } catch (error) {
      console.error("Error in agent node:", error);
      return {
        response: `Error: ${(error as Error).message}`,
        messages: []
      };
    }
  };

  // Router function to decide which node to use
  const routeToNode = (state: AgentStateType): string => {
    return state.mode === 'agent' ? 'agent' : 'chat';
  };

  // Create the StateGraph
  const workflow = new StateGraph(AgentState)
    .addNode("chat", chatNode)
    .addNode("agent", agentNode)
    .addConditionalEdges(START, routeToNode, {
      chat: "chat",
      agent: "agent"
    })
    .addEdge("chat", END)
    .addEdge("agent", END);

  // Compile the graph
  const app = workflow.compile();

  // Return a function that processes user input and returns a response
  return async (
    userInput: string, 
    mode: 'chat' | 'agent' = 'chat', 
    history: Array<{ role: 'user' | 'assistant'; content: string }> = []
  ): Promise<string> => {
    try {
      // Create initial state
      const initialState: AgentStateType = {
        mode,
        input: userInput,
        response: '',
        history,
        messages: []
      };

      // Invoke the graph
      const result = await app.invoke(initialState);
      
      // Return the response
      return result.response || 'No response generated';
    } catch (error) {
      console.error("Error in LangGraph agent:", error);
      return `Error: ${(error as Error).message}`;
    }
  };
}