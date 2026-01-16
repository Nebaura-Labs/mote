/**
 * Home Screen - Chat Interface
 *
 * Main chat interface for communicating with clawd.bot AI
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  Animated,
  useColorScheme,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { v4 as uuidv4 } from 'uuid';
import { Button, TextField } from 'heroui-native';
import Markdown from 'react-native-markdown-display';
import { CaretDown, ArrowClockwise, Paperclip, ArrowUp, Microphone, Stop, ChatCircleDots, ChatText, SpeakerHigh, X } from 'phosphor-react-native';
import { ScreenWrapper } from '@/components/ui/screen-wrapper';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/contexts/auth-context';
import { client } from '@/utils/orpc';
import { useVoiceChat } from '@/hooks/useVoiceChat';

const getStyles = (isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
    backgroundColor: isDark ? '#1a1a1a' : '#f0efea',
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 8,
  },
  inputContainer: {
    padding: 16,
    paddingTop: 12,
    backgroundColor: isDark ? '#1a1a1a' : '#f0efea',
  },
  inputCard: {
    backgroundColor: isDark ? '#2a2a2a' : '#ffffff',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: isDark ? '#3a3a3a' : '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isDark ? 0.3 : 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  inputControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  controlsLeft: {
    flexDirection: 'row',
    gap: 16,
  },
  controlsRight: {
    flexDirection: 'row',
    gap: 12,
  },
  sessionSelector: {
    color: '#007AFF',
    fontSize: 15,
    fontWeight: '500',
  },
  offToggle: {
    color: '#007AFF',
    fontSize: 15,
    fontWeight: '500',
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: isDark ? '#3a3a3a' : '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  textInput: {
    backgroundColor: isDark ? '#1a1a1a' : '#f0efea',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: isDark ? '#e5e5e5' : '#111827',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageCard: {
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  userMessage: {
    alignSelf: 'flex-end',
    maxWidth: '75%',
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    maxWidth: '75%',
  },
  userBubble: {
    backgroundColor: '#007AFF',
    borderRadius: 20,
    borderBottomRightRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#0066CC',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: isDark ? 0.3 : 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  assistantBubble: {
    backgroundColor: isDark ? '#2a2a2a' : '#ffffff',
    borderRadius: 20,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: isDark ? '#3a3a3a' : '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: isDark ? 0.3 : 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  userText: {
    color: '#ffffff',
    fontSize: 16,
    lineHeight: 22,
  },
  assistantText: {
    color: isDark ? '#e5e5e5' : '#1f2937',
    fontSize: 16,
    lineHeight: 22,
  },
  thinkingBubble: {
    backgroundColor: isDark ? '#2a2a2a' : '#ffffff',
    borderRadius: 20,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: isDark ? '#3a3a3a' : '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: isDark ? 0.3 : 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  micButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  micButtonIdle: {
    backgroundColor: '#007AFF',
  },
  micButtonListening: {
    backgroundColor: '#EF4444',
  },
  micButtonProcessing: {
    backgroundColor: '#F59E0B',
  },
  micButtonSpeaking: {
    backgroundColor: '#10B981',
  },
  voiceStatusContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingTop: 60, // Account for status bar
    alignItems: 'center',
    zIndex: 1000,
    backgroundColor: isDark ? 'rgba(26, 26, 26, 0.95)' : 'rgba(240, 239, 234, 0.95)',
  },
  voiceStatusCard: {
    backgroundColor: isDark ? '#2a2a2a' : '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: isDark ? '#3a3a3a' : '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: isDark ? 0.3 : 0.1,
    shadowRadius: 12,
    elevation: 8,
    minWidth: 280,
    maxWidth: '90%',
    alignItems: 'center',
    position: 'relative',
  },
  voiceCancelButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: isDark ? '#3a3a3a' : '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  voiceStatusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  voiceStatusText: {
    color: isDark ? '#e5e5e5' : '#111827',
    fontSize: 16,
    fontWeight: '600',
  },
  voiceTranscription: {
    color: isDark ? '#9CA3AF' : '#6B7280',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});

const getMarkdownStyles = (isDark: boolean) => ({
  body: {
    color: isDark ? '#e5e5e5' : '#1f2937',
    fontSize: 16,
    lineHeight: 22,
  },
  paragraph: {
    marginTop: 0,
    marginBottom: 8,
  },
  strong: {
    fontWeight: 'bold' as const,
  },
  em: {
    fontStyle: 'italic' as const,
  },
  link: {
    color: '#007AFF',
  },
  code_inline: {
    backgroundColor: isDark ? '#3a3a3a' : '#f3f4f6',
    color: isDark ? '#e5e5e5' : '#111827',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    fontFamily: 'monospace',
    fontSize: 14,
  },
  code_block: {
    backgroundColor: isDark ? '#3a3a3a' : '#f3f4f6',
    color: isDark ? '#e5e5e5' : '#111827',
    padding: 12,
    borderRadius: 8,
    marginVertical: 4,
    fontFamily: 'monospace',
    fontSize: 14,
  },
  fence: {
    backgroundColor: isDark ? '#3a3a3a' : '#f3f4f6',
    color: isDark ? '#e5e5e5' : '#111827',
    padding: 12,
    borderRadius: 8,
    marginVertical: 4,
    fontFamily: 'monospace',
    fontSize: 14,
  },
  bullet_list: {
    marginBottom: 8,
  },
  ordered_list: {
    marginBottom: 8,
  },
  list_item: {
    marginBottom: 4,
  },
});

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
}

export default function Home() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { isAuthenticated } = useAuth();
  const scrollViewRef = useRef<ScrollView>(null);
  const micScale = useRef(new Animated.Value(1)).current;

  // Generate styles based on theme
  const styles = getStyles(isDark);
  const markdownStyles = getMarkdownStyles(isDark);

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [hasConfig, setHasConfig] = useState(false);
  const [hasVoiceConfig, setHasVoiceConfig] = useState(false);
  const [sessionKey, setSessionKey] = useState<string | undefined>();

  // Voice chat integration
  const voiceChat = useVoiceChat({
    autoListen: true,
    followUpTimeout: 5000,
    onConversationEnd: () => {
      console.log('[Home] Voice conversation ended');
    },
    onError: (error) => {
      Alert.alert('Voice Error', error.message);
    },
  });

  /**
   * Load Gateway configuration and check if user has setup
   * If Gateway SSH is configured but chat API isn't, auto-setup chat API
   */
  useEffect(() => {
    const loadConfig = async () => {
      if (!isAuthenticated) return;

      setIsLoading(true);
      try {
        let config = await client.clawd.getConfig();

        // If no chat config exists, check if Gateway SSH is configured
        // and auto-setup chat API if needed
        if (!config) {
          const gatewayConfig = await client.gateway.getConfig();
          if (gatewayConfig) {
            console.log('[Home] Gateway SSH configured but chat API not configured, running auto-setup...');
            try {
              const setupResult = await client.autoSetupClawd.autoSetup();
              console.log('[Home] Auto-setup result:', setupResult);

              // Reload config after auto-setup
              config = await client.clawd.getConfig();
            } catch (autoSetupError) {
              console.error('[Home] Auto-setup failed:', autoSetupError);
            }
          }
        }

        setHasConfig(!!config);

        // Check voice configuration
        try {
          const voiceConfig = await client.voice.getConfig();
          setHasVoiceConfig(voiceConfig.configured);
        } catch (error) {
          console.error('[Home] Failed to load voice config:', error);
          setHasVoiceConfig(false);
        }

        if (config) {
          // Load existing messages
          const { messages: chatMessages } = await client.clawd.getMessages({
            limit: 50,
            offset: 0,
          });

          setMessages(
            chatMessages.map((msg: any) => ({
              id: msg.id,
              role: msg.role as 'user' | 'assistant',
              content: msg.content,
              createdAt: new Date(msg.createdAt),
            }))
          );

          // Generate session key for new conversation if no messages
          if (chatMessages.length === 0) {
            setSessionKey(uuidv4());
          }
        }
      } catch (error) {
        console.error('[Home] Failed to load config:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadConfig();
  }, [isAuthenticated]);

  /**
   * Reload voice config when screen comes into focus
   */
  useFocusEffect(
    useCallback(() => {
      const checkVoiceConfig = async () => {
        try {
          const voiceConfig = await client.voice.getConfig();
          setHasVoiceConfig(voiceConfig.configured);
        } catch (error) {
          console.error('[Home] Failed to load voice config:', error);
          setHasVoiceConfig(false);
        }
      };
      checkVoiceConfig();
    }, [])
  );

  /**
   * Add voice chat messages to chat when they arrive
   */
  useEffect(() => {
    if (voiceChat.transcription && voiceChat.response) {
      // Add user message (transcription)
      const userMessage: Message = {
        id: uuidv4(),
        role: 'user',
        content: voiceChat.transcription,
        createdAt: new Date(),
      };

      // Add assistant response
      const assistantMessage: Message = {
        id: uuidv4(),
        role: 'assistant',
        content: voiceChat.response,
        createdAt: new Date(),
      };

      setMessages((prev) => [...prev, userMessage, assistantMessage]);
    }
  }, [voiceChat.transcription, voiceChat.response]);

  /**
   * Scroll to bottom when messages change
   */
  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages]);

  /**
   * Animate microphone button when listening
   */
  useEffect(() => {
    if (voiceChat.isListening) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(micScale, {
            toValue: 1.2,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(micScale, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      micScale.setValue(1);
    }
  }, [voiceChat.isListening, micScale]);

  /**
   * Navigate to gateway setup
   */
  const handleConfigure = () => {
    router.push('/gateway-setup');
  };

  /**
   * Handle sending a message
   */
  const handleSendMessage = async () => {
    if (!inputText.trim() || isSending) return;

    const messageText = inputText.trim();
    setInputText('');
    setIsSending(true);

    // Add user message to UI immediately
    const userMessage: Message = {
      id: uuidv4(),
      role: 'user',
      content: messageText,
      createdAt: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    try {
      // Send message to clawd.bot via API
      const response = await client.clawd.sendMessage({
        message: messageText,
        sessionKey,
      });

      // Add assistant response to UI
      const assistantMessage: Message = {
        id: response.messageId,
        role: 'assistant',
        content: response.message,
        createdAt: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // Update session key if it was newly created
      if (!sessionKey && response.sessionKey) {
        setSessionKey(response.sessionKey);
      }
    } catch (error) {
      console.error('[Home] Failed to send message:', error);
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to send message',
        [{ text: 'OK' }]
      );

      // Remove the user message from UI if send failed
      setMessages((prev) => prev.filter((msg) => msg.id !== userMessage.id));
    } finally {
      setIsSending(false);
    }
  };

  /**
   * Handle voice message recording
   */
  const handleVoiceMessage = async () => {
    // Check config status when button is pressed (fresh check)
    try {
      const voiceConfig = await client.voice.getConfig();
      if (!voiceConfig.configured) {
        Alert.alert(
          'Voice Not Configured',
          'Please configure your voice settings (API keys) in Settings first.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Go to Settings', onPress: () => router.push('/(drawer)/settings') },
          ]
        );
        return;
      }
    } catch (error) {
      console.error('[Home] Failed to check voice config:', error);
      Alert.alert(
        'Error',
        'Failed to check voice configuration. Please try again.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (voiceChat.isListening) {
      // Stop listening and process
      await voiceChat.stopListening();
    } else {
      // Start voice message
      await voiceChat.sendVoiceMessage();
    }
  };


  if (isLoading) {
    return (
      <ScreenWrapper style={{ backgroundColor: isDark ? '#1a1a1a' : '#f0efea' }}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text variant="p" className="mt-4" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>
            Loading...
          </Text>
        </View>
      </ScreenWrapper>
    );
  }

  if (!hasConfig) {
    return (
      <ScreenWrapper style={{ backgroundColor: isDark ? '#1a1a1a' : '#f0efea' }}>
        <View className="flex-1 items-center justify-center p-6">
          <Text variant="h2" className="text-center mb-4" style={{ color: isDark ? '#e5e5e5' : '#111827' }}>
            Welcome to Mote
          </Text>
          <Text variant="p" className="text-center mb-6" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>
            To get started, configure your clawd.bot Gateway connection.
          </Text>
          <Button
            onPress={handleConfigure}
            size="lg"
            className="w-full max-w-xs bg-blue-500"
          >
            Configure Gateway
          </Button>
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper style={{ backgroundColor: isDark ? '#1a1a1a' : '#f0efea' }}>
      {/* Voice Status Indicator */}
      {(voiceChat.isListening || voiceChat.isProcessing || voiceChat.isSpeaking) && (
        <View style={styles.voiceStatusContainer}>
          <View style={styles.voiceStatusCard}>
            {/* Cancel Button */}
            <TouchableOpacity
              style={styles.voiceCancelButton}
              onPress={voiceChat.cancel}
              activeOpacity={0.7}
            >
              <X size={16} color={isDark ? '#9CA3AF' : '#6B7280'} weight="bold" />
            </TouchableOpacity>

            {voiceChat.isListening && (
              <>
                <View style={styles.voiceStatusHeader}>
                  <Microphone size={20} color="#EF4444" weight="fill" />
                  <Text style={styles.voiceStatusText}>Listening...</Text>
                </View>
                <Text style={styles.voiceTranscription}>Speak now</Text>
              </>
            )}
            {voiceChat.isProcessing && (
              <>
                <View style={styles.voiceStatusHeader}>
                  <ActivityIndicator color={isDark ? '#F59E0B' : '#D97706'} size="small" />
                  <Text style={styles.voiceStatusText}>Processing...</Text>
                </View>
                {voiceChat.transcription && (
                  <Text style={styles.voiceTranscription}>{voiceChat.transcription}</Text>
                )}
              </>
            )}
            {voiceChat.isSpeaking && (
              <>
                <View style={styles.voiceStatusHeader}>
                  <SpeakerHigh size={20} color="#10B981" weight="fill" />
                  <Text style={styles.voiceStatusText}>Speaking...</Text>
                </View>
                {voiceChat.response && (
                  <Text style={styles.voiceTranscription} numberOfLines={2}>
                    {voiceChat.response}
                  </Text>
                )}
              </>
            )}
          </View>
        </View>
      )}

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={100}
      >
        {/* Messages */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.length === 0 && !isSending && (
            <View className="flex-1 items-center justify-center py-20">
              <View style={{
                backgroundColor: isDark ? '#2a2a2a' : '#f3f4f6',
                borderRadius: 60,
                width: 100,
                height: 100,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 20,
                borderWidth: 1,
                borderColor: isDark ? '#3a3a3a' : '#e5e7eb',
              }}>
                <ChatCircleDots
                  size={56}
                  color={isDark ? '#9CA3AF' : '#6B7280'}
                  weight="duotone"
                />
              </View>
              <Text style={{
                fontSize: 24,
                fontWeight: '600',
                color: isDark ? '#e5e5e5' : '#111827',
                marginBottom: 8,
                textAlign: 'center',
              }}>
                Start a conversation
              </Text>
              <Text style={{
                fontSize: 16,
                color: isDark ? '#9CA3AF' : '#6b7280',
                textAlign: 'center',
                paddingHorizontal: 32,
              }}>
                Ask me anything! I'm here to help.
              </Text>
            </View>
          )}

          {messages.map((message) => (
            <View
              key={message.id}
              style={[
                styles.messageCard,
                message.role === 'user' ? styles.userMessage : styles.assistantMessage,
              ]}
            >
              <View
                style={
                  message.role === 'user' ? styles.userBubble : styles.assistantBubble
                }
              >
                {message.role === 'user' ? (
                  <Text style={styles.userText}>
                    {message.content}
                  </Text>
                ) : (
                  <Markdown style={markdownStyles}>
                    {message.content}
                  </Markdown>
                )}
              </View>
            </View>
          ))}

          {isSending && (
            <View style={[styles.messageCard, styles.assistantMessage]}>
              <View style={styles.thinkingBubble}>
                <ActivityIndicator size="small" color={isDark ? '#9CA3AF' : '#6b7280'} />
                <Text style={{ color: isDark ? '#9CA3AF' : '#6b7280', fontSize: 15 }}>
                  Thinking...
                </Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Input Area - Clawd Style */}
        <View style={styles.inputContainer}>
          <View style={styles.inputCard}>
            {/* Top Controls */}
            <View style={styles.inputControls}>
              <View style={styles.controlsLeft}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={styles.sessionSelector}>main</Text>
                  <CaretDown size={14} color="#007AFF" weight="bold" />
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={styles.offToggle}>Off</Text>
                  <CaretDown size={14} color="#007AFF" weight="bold" />
                </View>
              </View>
              <View style={styles.controlsRight}>
                <View style={styles.iconButton}>
                  <ArrowClockwise size={18} color={isDark ? '#9CA3AF' : '#6B7280'} weight="bold" />
                </View>
                <View style={styles.iconButton}>
                  <Paperclip size={18} color={isDark ? '#9CA3AF' : '#6B7280'} weight="bold" />
                </View>
              </View>
            </View>

            {/* Text Input */}
            <TextField>
              <TextField.Input
                value={inputText}
                onChangeText={setInputText}
                placeholder="Message Clawd..."
                placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                multiline
                numberOfLines={3}
                maxLength={2000}
                onSubmitEditing={handleSendMessage}
                editable={!isSending}
                style={styles.textInput}
              />
            </TextField>

            {/* Bottom Status Bar */}
            <View style={styles.statusBar}>
              {/* Microphone Button - Left */}
              <TouchableOpacity
                onPress={handleVoiceMessage}
                disabled={voiceChat.isProcessing || isSending}
                activeOpacity={0.7}
              >
                <Animated.View
                  style={[
                    styles.micButton,
                    voiceChat.isListening
                      ? styles.micButtonListening
                      : voiceChat.isProcessing
                      ? styles.micButtonProcessing
                      : voiceChat.isSpeaking
                      ? styles.micButtonSpeaking
                      : styles.micButtonIdle,
                    {
                      transform: [{ scale: micScale }],
                      opacity: voiceChat.isProcessing || isSending ? 0.5 : 1,
                    },
                  ]}
                >
                  {voiceChat.isListening ? (
                    <Stop size={20} color="#ffffff" weight="fill" />
                  ) : (
                    <Microphone size={20} color="#ffffff" weight="fill" />
                  )}
                </Animated.View>
              </TouchableOpacity>

              {/* Send Button - Right */}
              <Button
                onPress={handleSendMessage}
                isDisabled={!inputText.trim() || isSending}
                isIconOnly
                style={styles.sendButton}
              >
                <ArrowUp size={20} color="#ffffff" weight="bold" />
              </Button>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </ScreenWrapper>
  );
}
