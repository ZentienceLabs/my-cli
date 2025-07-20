import React, { useState, useEffect } from 'react';
import { render, Box, Text, useInput, useFocusManager, useFocus, useApp } from 'ink';
import TextInput from 'ink-text-input';
import SelectInput from 'ink-select-input';
import { spawn } from 'child_process';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// --- Configuration Management ---
type SettingsConfig = {
	provider: string;
	model: string;
	apiKey: string;
};

// Find project root by looking for package.json
const findProjectRoot = (startPath: string): string => {
	let currentPath = startPath;
	while (currentPath !== path.parse(currentPath).root) {
		if (fs.existsSync(path.join(currentPath, 'package.json'))) {
			return currentPath;
		}
		currentPath = path.dirname(currentPath);
	}
	throw new Error('Could not find project root');
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = findProjectRoot(__dirname);
const configDir = path.join(projectRoot, 'config');
const settingsPath = path.join(configDir, 'settings.json');

const loadSettings = (): SettingsConfig => {
	const defaultConfig: SettingsConfig = {
		provider: 'Anthropic',
		model: 'claude-3-haiku-20240307',
		apiKey: 'your_api_key_here',
	};

	if (!fs.existsSync(configDir)) {
		fs.mkdirSync(configDir, { recursive: true });
	}

	if (!fs.existsSync(settingsPath)) {
		fs.writeFileSync(settingsPath, JSON.stringify(defaultConfig, null, 2));
		return defaultConfig;
	}

	try {
		const fileContent = fs.readFileSync(settingsPath, 'utf-8');
		return { ...defaultConfig, ...JSON.parse(fileContent) };
	} catch (error) {
		fs.writeFileSync(settingsPath, JSON.stringify(defaultConfig, null, 2));
		return defaultConfig;
	}
};

const saveSettings = (settings: SettingsConfig) => {
	fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
};



// --- Model Definitions ---
const modelsByProvider: Record<string, { label: string; value: string }[]> = {
	Anthropic: [
		{ label: 'Claude 3.5 Sonnet', value: 'claude-3-5-sonnet-20240620' },
		{ label: 'Claude 3 Opus', value: 'claude-3-opus-20240229' },
		{ label: 'Claude 3 Sonnet', value: 'claude-3-sonnet-20240229' },
		{ label: 'Claude 3 Haiku', value: 'claude-3-haiku-20240307' },
	],
	OpenAI: [
		{ label: 'GPT-4o', value: 'gpt-4o' },
		{ label: 'GPT-4 Turbo', value: 'gpt-4-turbo' },
		{ label: 'GPT-3.5 Turbo', value: 'gpt-3.5-turbo' },
	],
	Google: [
		{ label: 'Gemini 2.5 Pro', value: 'gemini-2.5-pro' },
		{ label: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash' },
		{ label: 'Gemini 2.0 Flash', value: 'gemini-2.0-flash' },
	],
};

// --- UI Components ---
type Mode = 'command' | 'agent' | 'settings';

const Settings = ({ onExit, onSave }: { onExit: () => void; onSave: () => void }) => {
	const { exit } = useApp();
	const [form, setForm] = useState<SettingsConfig>(() => loadSettings());
	const [status, setStatus] = useState('');
	const [activeField, setActiveField] = useState<'provider' | 'model' | 'apiKey' | 'save'>('provider');



	useInput((input, key) => {
		// Handle Ctrl+Up Arrow to exit settings
		if (key.ctrl && key.upArrow) {
			onExit();
			return;
		}
		
		// Handle tab navigation
		if (key.tab) {
			if (!key.shift) {
				// Forward tab navigation
				switch (activeField) {
					case 'provider':
						setActiveField('model');
						break;
					case 'model':
						setActiveField('apiKey');
						break;
					case 'apiKey':
						setActiveField('save');
						break;
					case 'save':
						setActiveField('provider');
						break;
				}
			} else {
				// Backward tab navigation
				switch (activeField) {
					case 'provider':
						setActiveField('save');
						break;
					case 'model':
						setActiveField('provider');
						break;
					case 'apiKey':
						setActiveField('model');
						break;
					case 'save':
						setActiveField('apiKey');
						break;
				}
			}
		}
		
		// Handle enter key for save button
		if (key.return && activeField === 'save') {
			handleSave();
		}
	});

	const handleSave = () => {
		saveSettings(form);
		onSave(); // Notify parent to re-initialize client
		setStatus('Settings saved successfully!');
		setTimeout(() => setStatus(''), 2000);
	};

	const providerItems = Object.keys(modelsByProvider).map(p => ({ label: p, value: p }));
	const modelItems = modelsByProvider[form.provider] || [];

	return (
		<Box flexDirection="column" padding={1}>
			<Text bold>LLM Settings</Text>
			<Box flexDirection="column" borderStyle="round" padding={1} marginTop={1}>
				<Field label="Provider" isActive={activeField === 'provider'}>
					<SelectInput
						items={providerItems}
						onSelect={(item) => {
							const newProvider = item.value;
							const newModel = modelsByProvider[newProvider][0].value;
							setForm({ ...form, provider: newProvider, model: newModel });
						}}
						initialIndex={providerItems.findIndex(p => p.value === form.provider)}
					/>
				</Field>
				<Field label="Model" isActive={activeField === 'model'}>
					<SelectInput
						items={modelItems}
						onSelect={(item) => setForm({ ...form, model: item.value })}
						initialIndex={modelItems.findIndex(m => m.value === form.model)}
					/>
				</Field>
				<Field label="API Key" isActive={activeField === 'apiKey'}>
					<TextInput
						value={form.apiKey}
						onChange={value => setForm({ ...form, apiKey: value })}
						mask="*"
						showCursor={activeField === 'apiKey'}
					/>
				</Field>
				<Box 
					justifyContent="center" 
					marginTop={1} 
					borderStyle={activeField === 'save' ? 'round' : undefined} 
					borderColor="cyan"
					paddingX={1}
				>
					<Text color={activeField === 'save' ? 'cyan' : 'white'} bold> Save </Text>
				</Box>
			</Box>
			{status && <Text color="green">{status}</Text>}
			<Text color="gray">Use Tab to navigate, Enter to select/save. Press Ctrl+Up Arrow to exit.</Text>
		</Box>
	);
};

const Field = ({ label, children, isActive = false }: { label: string; children: React.ReactElement; isActive?: boolean }) => {

	let finalChild = children;

	if (children.type === SelectInput) {
		// When not active, render a disabled-looking list containing only the selected item
		if (!isActive) {
			const { items, initialIndex = 0 } = children.props;
			const selected = items[initialIndex];
			finalChild = React.cloneElement(children, {
				items: selected ? [selected] : [],
				onSelect: () => {},
			});
		}
	} else if (children.type === TextInput && !children.props.showCursor) {
		// For text inputs, we just show or hide the cursor based on active state
		finalChild = React.cloneElement(children, { showCursor: isActive });
	}

	return (
		<Box 
			borderStyle={isActive ? 'round' : undefined} 
			borderColor="cyan" 
			paddingX={1}
		>
			<Box width={15}>
				<Text>{label}:</Text>
			</Box>
			{finalChild}
		</Box>
	);
};

const Cli = ({ initialSettings }: { initialSettings: SettingsConfig }) => {
	const { exit } = useApp();
	const [mode, setMode] = useState<Mode>('command');
	const [command, setCommand] = useState('');
	const [history, setHistory] = useState<string[]>([]);
	const [showSlashCommands, setShowSlashCommands] = useState(false);
	const [settings, setSettings] = useState<SettingsConfig>(initialSettings);
	const [apiClient, setApiClient] = useState<any>(null);
	const [isProcessing, setIsProcessing] = useState(false);

	const reinitializeClient = () => {
		const newSettings = loadSettings();
		setSettings(newSettings);
		if (newSettings.provider === 'Anthropic') {
			setApiClient(new Anthropic({ apiKey: newSettings.apiKey }));
		} else {
			setApiClient(null);
		}
	};

	useEffect(() => {
		reinitializeClient(); // Initial setup
	}, []);

	const getSlashCommands = (currentMode: Mode) => {
		const commands = [
			{ label: 'settings - Configure the agent', value: 'settings' },
			{ label: 'quit - Exit the CLI', value: 'quit' },
		];

		// Add mode-specific commands
		if (currentMode === 'command') {
			commands.push({ label: 'agent - Switch to agent mode', value: 'agent' });
		} else if (currentMode === 'agent') {
			commands.push({ label: 'cli - Switch to command mode', value: 'cli' });
		}

		return commands;
	};

	const slashCommands = getSlashCommands(mode);

	const filteredSlashCommands = slashCommands.filter(cmd =>
		cmd.value.startsWith(command.substring(1))
	);

	useInput((input, key) => {
		// Handle Ctrl+Up Arrow to switch modes
		if (key.ctrl && key.upArrow) {
			setMode(prev => {
				if (prev === 'settings') return 'command'; // Exit settings to command mode
				return prev === 'command' ? 'agent' : 'command'; // Toggle between command and agent
			});
			return;
		}
	});

	const handleCommandSubmit = (value: string) => {
		setHistory(prev => [...prev, `> ${value}`]); // Keep command mode format as is

		const parts = value.split(' ');
		const command = parts[0];
		const args = parts.slice(1);

		const child = spawn(command, args, { shell: true, stdio: 'pipe' });

		child.stdout.on('data', (data) => {
			setHistory(prev => [...prev, data.toString().trim()]);
		});

		child.stderr.on('data', (data) => {
			setHistory(prev => [...prev, `Stderr: ${data.toString().trim()}`]);
		});

		child.on('error', (error) => {
			setHistory(prev => [...prev, `Error: ${error.message}`]);
		});

		child.on('close', (code) => {
			if (code !== 0) {
				setHistory(prev => [...prev, `Command exited with code ${code}`]);
			}
		});
	};

	const handleAgentSubmit = async (value: string) => {
		if (!apiClient || !settings?.apiKey || settings.apiKey === 'your_api_key_here') {
			const providerError = !apiClient ? `Provider '${settings?.provider}' is not supported yet.` : 'API key not set.';
			setHistory(prev => [...prev, `Error: ${providerError} Use /settings to configure it.`]);
			return;
		}
		// Label user message as User in chat history
		setHistory(prev => [...prev, `User: ${value}`]);
		
		// Show loader while processing
		setIsProcessing(true);
		setHistory(prev => [...prev, 'AI: Thinking...']);
		
		try {
			const response = await apiClient.messages.create({
				model: settings.model,
				max_tokens: 1024,
				messages: [{ role: 'user', content: value }],
			});
			const agentResponseBlock = response.content[0];
			const agentResponse = agentResponseBlock.type === 'text' ? agentResponseBlock.text : '[Unsupported content type]';
			
			// Replace loader with actual response
			setHistory(prev => {
				const newHistory = [...prev];
				// Remove the last item (loader)
				newHistory.pop();
				// Add the actual response
				return [...newHistory, `AI: ${agentResponse}`];
			});
		} catch (error) {
			// Replace loader with error message
			setHistory(prev => {
				const newHistory = [...prev];
				// Remove the last item (loader)
				newHistory.pop();
				// Add the error message
				return [...newHistory, `Agent Error: ${error instanceof Error ? error.message : 'Unknown error'}`];
			});
		} finally {
			setIsProcessing(false);
		}
	};

	const handleSlashCommandSelect = (item: { value: string }) => {
		if (item.value === 'settings') {
			setMode('settings');
		} else if (item.value === 'quit') {
			exit();
		} else if (item.value === 'agent') {
			setMode('agent');
		} else if (item.value === 'cli') {
			setMode('command');
		}
		setShowSlashCommands(false);
		setCommand('');
	};

	const handleSubmit = (value: string) => {
		// Handle direct slash commands without selection
		if (value === '/agent') {
			setMode('agent');
			setCommand('');
			return;
		} else if (value === '/cli') {
			setMode('command');
			setCommand('');
			return;
		}
		
		if (value.startsWith('/')) return; // Ignore submission if it's a slash command trigger

		setCommand('');

		if (mode === 'command') handleCommandSubmit(value);
		else if (mode === 'agent') handleAgentSubmit(value);
	};

	const prompt = mode === 'command' ? '> ' : '[AGENT]> ';

	if (mode === 'settings') {
		return <Settings onExit={() => setMode('command')} onSave={reinitializeClient} />;
	}

	// Helper function to split the line into label and content
	const formatHistoryLine = (line: string) => {
		// For lines with a prefix like 'User: ' or 'AI: '
		if (line.includes(': ')) {
			const [prefix, ...rest] = line.split(': ');
			return { label: prefix, content: rest.join(': ') };
		}
		// For command output or other lines without a prefix
		return { label: '', content: line };
	};

	return (
		<Box flexDirection="column" height="100%">
			<Box flexGrow={1} flexDirection="column">
				{history.map((line, index) => {
					// Format the line
					const { label, content } = formatHistoryLine(line);
					
					// Add loading animation to the last line if it's the loader
					if (isProcessing && index === history.length - 1 && line === 'AI: Thinking...') {
						return (
							<Box key={index} flexDirection="row">
								<Box width="8%"><Text bold color="yellow">AI</Text></Box>
								<Box width="1%"><Text color="yellow">:</Text></Box>
								<Box><Text color="yellow">Thinking...</Text></Box>
							</Box>
						);
					}
					
					// If this is a line with a label (like User: or AI:)
					if (label) {
						return (
							<Box key={index} flexDirection="row">
								<Box width="8%"><Text bold>{label}</Text></Box>
								<Box width="1%"><Text>:</Text></Box>
								<Box><Text>{content}</Text></Box>
							</Box>
						);
					}
					
					// For lines without a label (like command output)
					return <Text key={index}>{line}</Text>;
				})}
			</Box>

			{showSlashCommands && filteredSlashCommands.length > 0 && (
				<Box flexDirection="column">
					<SelectInput items={filteredSlashCommands} onSelect={handleSlashCommandSelect} />
				</Box>
			)}

			<Box borderStyle="round" borderColor="blue" paddingX={1}>
				<Text color="magenta">{prompt}</Text>
				<TextInput
					value={command}
					onChange={value => {
						setCommand(value);
						setShowSlashCommands(value.startsWith('/'));
					}}
					onSubmit={handleSubmit}
					placeholder="Type your message or / for commands"
				/>
			</Box>
		</Box>
	);
};

const App = () => {
	const settings = loadSettings();
	return <Cli initialSettings={settings} />;
};

render(<App />);
