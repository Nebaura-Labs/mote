/**
 * Home Screen - Chat Interface
 *
 * Main chat interface for communicating with clawd.bot AI
 */

import { useState, useEffect, useRef } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { v4 as uuidv4 } from 'uuid';
import { Button, TextField, Card } from 'heroui-native';
import { ScreenWrapper } from '@/components/ui/screen-wrapper';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/contexts/auth-context';
import { client } from '@/utils/orpc';

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 8,
  },
  inputContainer: {
    padding: 16,
    paddingTop: 8,
    backgroundColor: '#f0efea',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  messageCard: {
    marginBottom: 12,
  },
  userMessage: {
    alignSelf: 'flex-end',
    maxWidth: '80%',
    backgroundColor: '#3b82f6',
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    maxWidth: '80%',
    backgroundColor: '#ffffff',
  },
});

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
}

export default function Home() {
  const { isAuthenticated } = useAuth();
  const scrollViewRef = useRef<ScrollView>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [hasConfig, setHasConfig] = useState(false);
  const [sessionKey, setSessionKey] = useState<string | undefined>();

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
   * Scroll to bottom when messages change
   */
  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages]);

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
   * Handle configuring clawd.bot
   */
  const handleConfigure = () => {
    router.push('/clawd-setup');
  };

  /**
   * Handle starting new conversation
   */
  const handleNewConversation = () => {
    Alert.alert(
      'New Conversation',
      'Start a new conversation? This will clear the current chat.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start New',
          style: 'destructive',
          onPress: () => {
            setMessages([]);
            setSessionKey(uuidv4());
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <ScreenWrapper>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text variant="p" className="mt-4" style={{ color: '#6B7280' }}>
            Loading...
          </Text>
        </View>
      </ScreenWrapper>
    );
  }

  if (!hasConfig) {
    return (
      <ScreenWrapper>
        <View className="flex-1 items-center justify-center p-6">
          <Text variant="h2" className="text-center mb-4" style={{ color: '#111827' }}>
            Welcome to Mote
          </Text>
          <Text variant="p" className="text-center mb-6" style={{ color: '#6B7280' }}>
            To get started, configure your clawd.bot Gateway connection.
          </Text>
          <Button
            onPress={handleConfigure}
            color="primary"
            size="lg"
            className="w-full max-w-xs"
          >
            Configure Gateway
          </Button>
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
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
            <View className="flex-1 items-center justify-center py-12">
              <Text variant="large" className="text-center mb-2" style={{ color: '#111827' }}>
                Start a conversation
              </Text>
              <Text variant="p" className="text-center" style={{ color: '#6B7280' }}>
                Ask me anything!
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
              <Card
                className={`${
                  message.role === 'user'
                    ? 'bg-blue-500'
                    : 'bg-white border border-gray-200'
                } rounded-2xl`}
              >
                <Card.Body className="p-3">
                  <Text
                    variant="p"
                    style={{
                      color: message.role === 'user' ? '#ffffff' : '#111827',
                      lineHeight: 20,
                    }}
                  >
                    {message.content}
                  </Text>
                </Card.Body>
              </Card>
            </View>
          ))}

          {isSending && (
            <View style={[styles.messageCard, styles.assistantMessage]}>
              <Card className="bg-white border border-gray-200 rounded-2xl">
                <Card.Body className="p-3 flex-row items-center gap-2">
                  <ActivityIndicator size="small" color="#3b82f6" />
                  <Text variant="p" style={{ color: '#6B7280' }}>
                    Thinking...
                  </Text>
                </Card.Body>
              </Card>
            </View>
          )}
        </ScrollView>

        {/* Input Area */}
        <View style={styles.inputContainer}>
          <View className="flex-row items-end gap-2">
            <View className="flex-1">
              <TextField>
                <TextField.Input
                  value={inputText}
                  onChangeText={setInputText}
                  placeholder="Type a message..."
                  multiline
                  numberOfLines={3}
                  maxLength={2000}
                  onSubmitEditing={handleSendMessage}
                  editable={!isSending}
                  className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-900"
                  style={{ textAlignVertical: 'top' }}
                />
              </TextField>
            </View>
            <Button
              onPress={handleSendMessage}
              isDisabled={!inputText.trim() || isSending}
              variant="solid"
              size="md"
              className="self-end mb-1"
            >
              {isSending ? 'Sending...' : 'Send'}
            </Button>
          </View>

          {/* Action Buttons */}
          <View className="flex-row gap-2 mt-2">
            <Button
              onPress={handleNewConversation}
              variant="ghost"
              size="sm"
              isDisabled={messages.length === 0 || isSending}
              className="flex-1"
            >
              New Chat
            </Button>
            <Button
              onPress={handleConfigure}
              variant="ghost"
              size="sm"
              isDisabled={isSending}
              className="flex-1"
            >
              Settings
            </Button>
          </View>
        </View>
      </KeyboardAvoidingView>
    </ScreenWrapper>
  );
}
