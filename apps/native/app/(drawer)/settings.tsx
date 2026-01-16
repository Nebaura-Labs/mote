/**
 * Settings Screen
 *
 * Voice assistant configuration including API keys, wake word, and voice settings
 */

import { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Alert, useColorScheme } from 'react-native';
import { Button, Card, TextField, Switch } from 'heroui-native';
import { ScreenWrapper } from '@/components/ui/screen-wrapper';
import { Text } from '@/components/ui/text';
import { client } from '@/utils/orpc';

const getStyles = (isDark: boolean) => StyleSheet.create({
	scrollView: {
		flex: 1,
	},
	scrollContent: {
		flexGrow: 1,
		padding: 24,
		gap: 16,
	},
	section: {
		gap: 12,
	},
	sectionTitle: {
		fontSize: 18,
		fontWeight: '600',
		marginBottom: 8,
		color: isDark ? '#e5e5e5' : '#111827',
	},
	fieldLabel: {
		fontSize: 14,
		fontWeight: '500',
		marginBottom: 4,
		color: isDark ? '#9CA3AF' : '#666',
	},
	switchRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		paddingVertical: 8,
	},
	saveButton: {
		marginTop: 16,
	},
	helpText: {
		fontSize: 12,
		color: isDark ? '#6B7280' : '#999',
		marginTop: 4,
	},
	description: {
		color: isDark ? '#9CA3AF' : '#666',
	},
	successText: {
		color: '#28a745',
		marginTop: 8,
	},
});

export default function Settings() {
	const colorScheme = useColorScheme();
	const isDark = colorScheme === 'dark';
	const styles = getStyles(isDark);

	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	const [configured, setConfigured] = useState(false);

	// Form state
	const [deepgramApiKey, setDeepgramApiKey] = useState('');
	const [elevenlabsApiKey, setElevenlabsApiKey] = useState('');
	const [elevenlabsVoiceId, setElevenlabsVoiceId] = useState('');
	const [wakeWord, setWakeWord] = useState('hey mote');
	const [useShortTimeout, setUseShortTimeout] = useState(true); // 5s vs 10s

	/**
	 * Load existing voice configuration
	 */
	const loadConfig = async () => {
		try {
			setIsLoading(true);
			const config = await client.voice.getConfig();

			setConfigured(config.configured);
			if (config.configured) {
				// API keys are not returned for security
				setElevenlabsVoiceId(config.elevenlabsVoiceId || '');
				setWakeWord(config.wakeWord || 'hey mote');
				setUseShortTimeout((config.conversationTimeout || 5000) === 5000);
			}
		} catch (error) {
			console.error('[Settings] Failed to load config:', error);
			Alert.alert('Error', 'Failed to load voice settings');
		} finally {
			setIsLoading(false);
		}
	};

	useEffect(() => {
		loadConfig();
	}, []);

	/**
	 * Save voice configuration
	 */
	const handleSave = async () => {
		// Validate inputs
		if (!deepgramApiKey.trim() && !configured) {
			Alert.alert('Validation Error', 'Deepgram API key is required');
			return;
		}

		if (!elevenlabsApiKey.trim() && !configured) {
			Alert.alert('Validation Error', 'ElevenLabs API key is required');
			return;
		}

		if (!elevenlabsVoiceId.trim()) {
			Alert.alert('Validation Error', 'ElevenLabs Voice ID is required');
			return;
		}

		if (!wakeWord.trim()) {
			Alert.alert('Validation Error', 'Wake word is required');
			return;
		}

		setIsSaving(true);

		try {
			await client.voice.saveConfig({
				deepgramApiKey: deepgramApiKey.trim() || undefined,
				elevenlabsApiKey: elevenlabsApiKey.trim() || undefined,
				elevenlabsVoiceId: elevenlabsVoiceId.trim(),
				wakeWord: wakeWord.trim(),
				conversationTimeout: useShortTimeout ? 5000 : 10000,
			});

			Alert.alert('Success', 'Voice settings saved successfully!');
			setConfigured(true);

			// Clear API key fields after save (they're encrypted in DB)
			setDeepgramApiKey('');
			setElevenlabsApiKey('');
		} catch (error) {
			console.error('[Settings] Save failed:', error);
			Alert.alert('Error', 'Failed to save voice settings. Please try again.');
		} finally {
			setIsSaving(false);
		}
	};

	/**
	 * Delete voice configuration
	 */
	const handleDelete = () => {
		Alert.alert(
			'Delete Configuration',
			'Are you sure you want to delete your voice settings? This will remove your API keys.',
			[
				{ text: 'Cancel', style: 'cancel' },
				{
					text: 'Delete',
					style: 'destructive',
					onPress: async () => {
						try {
							await client.voice.deleteConfig();
							Alert.alert('Success', 'Voice settings deleted');

							// Reset form
							setDeepgramApiKey('');
							setElevenlabsApiKey('');
							setElevenlabsVoiceId('');
							setWakeWord('hey mote');
							setUseShortTimeout(true);
							setConfigured(false);
						} catch (error) {
							console.error('[Settings] Delete failed:', error);
							Alert.alert('Error', 'Failed to delete configuration');
						}
					},
				},
			],
		);
	};

	if (isLoading) {
		return (
			<ScreenWrapper>
				<View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
					<Text style={{ color: isDark ? '#e5e5e5' : '#111827' }}>Loading settings...</Text>
				</View>
			</ScreenWrapper>
		);
	}

	return (
		<ScreenWrapper>
			<ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
				{/* Header */}
				<Card
					style={{
						backgroundColor: isDark ? '#2a2a2a' : '#ffffff',
						borderWidth: 1,
						borderColor: isDark ? '#3a3a3a' : '#e5e7eb',
					}}
				>
					<Text style={styles.sectionTitle}>Voice Assistant Settings</Text>
					<Text style={styles.description}>
						Configure your Deepgram and ElevenLabs API keys for voice functionality.
					</Text>
					{configured && (
						<Text style={styles.successText}>
							✓ API keys are configured and encrypted
						</Text>
					)}
				</Card>

				{/* API Keys Section */}
				<Card
					style={{
						backgroundColor: isDark ? '#2a2a2a' : '#ffffff',
						borderWidth: 1,
						borderColor: isDark ? '#3a3a3a' : '#e5e7eb',
					}}
				>
					<View style={styles.section}>
						<Text style={styles.sectionTitle}>API Keys</Text>

						{/* Deepgram API Key */}
						<View>
							<Text style={styles.fieldLabel}>Deepgram API Key</Text>
							<TextField>
								<TextField.Input
									value={deepgramApiKey}
									onChangeText={setDeepgramApiKey}
									placeholder={configured ? '••••••••••••••••' : 'Enter Deepgram API key'}
									secureTextEntry
									autoCapitalize="none"
									autoCorrect={false}
									style={{
										backgroundColor: isDark ? '#1a1a1a' : '#f0efea',
										borderRadius: 12,
										paddingHorizontal: 16,
										paddingVertical: 12,
										fontSize: 16,
										color: isDark ? '#e5e5e5' : '#111827',
									}}
								/>
							</TextField>
							<Text style={styles.helpText}>
								Used for speech-to-text transcription. Get your key at deepgram.com
							</Text>
						</View>

						{/* ElevenLabs API Key */}
						<View>
							<Text style={styles.fieldLabel}>ElevenLabs API Key</Text>
							<TextField>
								<TextField.Input
									value={elevenlabsApiKey}
									onChangeText={setElevenlabsApiKey}
									placeholder={configured ? '••••••••••••••••' : 'Enter ElevenLabs API key'}
									secureTextEntry
									autoCapitalize="none"
									autoCorrect={false}
									style={{
										backgroundColor: isDark ? '#1a1a1a' : '#f0efea',
										borderRadius: 12,
										paddingHorizontal: 16,
										paddingVertical: 12,
										fontSize: 16,
										color: isDark ? '#e5e5e5' : '#111827',
									}}
								/>
							</TextField>
							<Text style={styles.helpText}>
								Used for text-to-speech synthesis. Get your key at elevenlabs.io
							</Text>
						</View>

						{/* ElevenLabs Voice ID */}
						<View>
							<Text style={styles.fieldLabel}>ElevenLabs Voice ID</Text>
							<TextField>
								<TextField.Input
									value={elevenlabsVoiceId}
									onChangeText={setElevenlabsVoiceId}
									placeholder="e.g., 21m00Tcm4TlvDq8ikWAM"
									autoCapitalize="none"
									autoCorrect={false}
									style={{
										backgroundColor: isDark ? '#1a1a1a' : '#f0efea',
										borderRadius: 12,
										paddingHorizontal: 16,
										paddingVertical: 12,
										fontSize: 16,
										color: isDark ? '#e5e5e5' : '#111827',
									}}
								/>
							</TextField>
							<Text style={styles.helpText}>
								The voice ID for synthesis. Find voices at elevenlabs.io/voice-library
							</Text>
						</View>
					</View>
				</Card>

				{/* Voice Settings Section */}
				<Card
					style={{
						backgroundColor: isDark ? '#2a2a2a' : '#ffffff',
						borderWidth: 1,
						borderColor: isDark ? '#3a3a3a' : '#e5e7eb',
					}}
				>
					<View style={styles.section}>
						<Text style={styles.sectionTitle}>Voice Settings</Text>

						{/* Wake Word */}
						<View>
							<Text style={styles.fieldLabel}>Wake Word</Text>
							<TextField>
								<TextField.Input
									value={wakeWord}
									onChangeText={setWakeWord}
									placeholder="hey mote"
									autoCapitalize="none"
									style={{
										backgroundColor: isDark ? '#1a1a1a' : '#f0efea',
										borderRadius: 12,
										paddingHorizontal: 16,
										paddingVertical: 12,
										fontSize: 16,
										color: isDark ? '#e5e5e5' : '#111827',
									}}
								/>
							</TextField>
							<Text style={styles.helpText}>
								The phrase to activate voice assistant (detected on device)
							</Text>
						</View>

						{/* Conversation Timeout */}
						<View style={styles.switchRow}>
							<View style={{ flex: 1 }}>
								<Text style={styles.fieldLabel}>Quick Response Mode</Text>
								<Text style={styles.helpText}>
									{useShortTimeout ? '5 second' : '10 second'} wait time for follow-up questions
								</Text>
							</View>
							<Switch isSelected={useShortTimeout} onSelectedChange={setUseShortTimeout} />
						</View>
					</View>
				</Card>

				{/* Action Buttons */}
				<View style={{ gap: 12 }}>
					<Button
						onPress={handleSave}
						disabled={isSaving}
						style={styles.saveButton}
					>
						<Text style={{ color: '#ffffff' }}>
							{isSaving ? 'Saving...' : configured ? 'Update Settings' : 'Save Settings'}
						</Text>
					</Button>

					{configured && (
						<Button
							onPress={handleDelete}
							color="danger"
							variant="outlined"
						>
							<Text style={{ color: '#ef4444' }}>
								Delete Configuration
							</Text>
						</Button>
					)}
				</View>

				{/* Help Section */}
				<Card
					style={{
						backgroundColor: isDark ? '#2a2a2a' : '#ffffff',
						borderWidth: 1,
						borderColor: isDark ? '#3a3a3a' : '#e5e7eb',
					}}
				>
					<Text style={styles.sectionTitle}>Need Help?</Text>
					<Text style={styles.helpText}>
						• Deepgram: Speech-to-text service for transcribing your voice{'\n'}
						• ElevenLabs: Text-to-speech service for AI voice responses{'\n'}
						• Wake Word: Detected locally on Mote device using Porcupine{'\n'}
						• All API keys are encrypted before storage
					</Text>
				</Card>
			</ScrollView>
		</ScreenWrapper>
	);
}
