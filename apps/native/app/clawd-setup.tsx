/**
 * Clawd.bot Gateway Setup Screen
 *
 * Configure Gateway URL and authentication token
 */

import { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';
import { Button, TextField, Card } from 'heroui-native';
import { ScreenWrapper } from '@/components/ui/screen-wrapper';
import { Text } from '@/components/ui/text';
import { client } from '@/utils/orpc';

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
  },
});

export default function ClawdSetup() {
  const [gatewayUrl, setGatewayUrl] = useState('http://localhost:18789');
  const [token, setToken] = useState('');
  const [agentId, setAgentId] = useState('main');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Load existing configuration
   */
  useEffect(() => {
    const loadConfig = async () => {
      setIsLoading(true);
      try {
        const config = await client.clawd.getConfig();
        if (config) {
          setGatewayUrl(config.gatewayUrl);
          setAgentId(config.defaultAgentId);
          // Don't load token for security
        }
      } catch (error) {
        console.error('[ClawdSetup] Failed to load config:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadConfig();
  }, []);

  /**
   * Validate inputs
   */
  const validateInputs = () => {
    if (!gatewayUrl.trim()) {
      Alert.alert('Error', 'Gateway URL is required');
      return false;
    }

    if (!token.trim()) {
      Alert.alert('Error', 'Gateway token is required');
      return false;
    }

    // Validate gatewayUrl is a valid URL
    try {
      new URL(gatewayUrl);
    } catch {
      Alert.alert('Error', 'Invalid Gateway URL format');
      return false;
    }

    if (!agentId.trim()) {
      Alert.alert('Error', 'Agent ID is required');
      return false;
    }

    return true;
  };

  /**
   * Handle saving configuration
   */
  const handleSave = async () => {
    if (!validateInputs()) return;

    setIsSaving(true);

    try {
      const result = await client.clawd.saveConfig({
        gatewayUrl: gatewayUrl.trim(),
        token: token.trim(),
        defaultAgentId: agentId.trim(),
      });

      if (result.success) {
        Alert.alert('Success', result.message, [
          {
            text: 'OK',
            onPress: () => {
              router.back();
            },
          },
        ]);
      }
    } catch (error) {
      console.error('[ClawdSetup] Failed to save config:', error);
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to save configuration',
        [{ text: 'OK' }]
      );
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Handle deleting configuration
   */
  const handleDelete = () => {
    Alert.alert(
      'Delete Configuration',
      'Are you sure you want to delete your clawd.bot configuration? This will also clear your chat history.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await client.clawd.deleteConfig();
              Alert.alert('Success', 'Configuration deleted', [
                {
                  text: 'OK',
                  onPress: () => {
                    router.back();
                  },
                },
              ]);
            } catch (error) {
              console.error('[ClawdSetup] Failed to delete config:', error);
              Alert.alert('Error', 'Failed to delete configuration');
            }
          },
        },
      ]
    );
  };

  return (
    <ScreenWrapper>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-6">
          {/* Header */}
          <View className="gap-2">
            <Text variant="h2" style={{ color: '#111827' }}>
              Gateway Setup
            </Text>
            <Text variant="p" style={{ color: '#6B7280' }}>
              Configure your clawd.bot Gateway connection to start chatting.
            </Text>
          </View>

          {/* Configuration Form */}
          <Card className="bg-white border border-gray-200 rounded-xl">
            <Card.Body className="p-4">
              <View className="gap-4">
                {/* Gateway URL */}
                <View>
                  <Text variant="small" className="mb-2" style={{ color: '#6B7280' }}>
                    Gateway URL
                  </Text>
                  <TextField>
                    <TextField.Input
                      value={gatewayUrl}
                      onChangeText={setGatewayUrl}
                      placeholder="http://localhost:18789"
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="url"
                      editable={!isSaving}
                      className="bg-white border border-gray-200 rounded-xl px-4 h-14 text-gray-900"
                    />
                  </TextField>
                  <Text variant="small" className="mt-1" style={{ color: '#9CA3AF' }}>
                    Your Gateway HTTP endpoint URL
                  </Text>
                </View>

                {/* Gateway Token */}
                <View>
                  <Text variant="small" className="mb-2" style={{ color: '#6B7280' }}>
                    Gateway Token
                  </Text>
                  <TextField>
                    <TextField.Input
                      value={token}
                      onChangeText={setToken}
                      placeholder="Enter your Gateway token"
                      autoCapitalize="none"
                      autoCorrect={false}
                      secureTextEntry
                      editable={!isSaving}
                      className="bg-white border border-gray-200 rounded-xl px-4 h-14 text-gray-900"
                    />
                  </TextField>
                  <Text variant="small" className="mt-1" style={{ color: '#9CA3AF' }}>
                    Your Gateway authentication token (if required)
                  </Text>
                </View>

                {/* Agent ID */}
                <View>
                  <Text variant="small" className="mb-2" style={{ color: '#6B7280' }}>
                    Default Agent ID
                  </Text>
                  <TextField>
                    <TextField.Input
                      value={agentId}
                      onChangeText={setAgentId}
                      placeholder="main"
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!isSaving}
                      className="bg-white border border-gray-200 rounded-xl px-4 h-14 text-gray-900"
                    />
                  </TextField>
                  <Text variant="small" className="mt-1" style={{ color: '#9CA3AF' }}>
                    Which agent to use (usually "main")
                  </Text>
                </View>
              </View>

              {/* Action Buttons */}
              <View className="mt-6 gap-3">
                <Button
                  onPress={handleSave}
                  isLoading={isSaving}
                  isDisabled={isSaving || isLoading}
                  color="primary"
                  size="lg"
                  className="w-full"
                >
                  Save Configuration
                </Button>

                {!isLoading && (
                  <Button
                    onPress={handleDelete}
                    variant="bordered"
                    color="danger"
                    size="md"
                    className="w-full"
                    isDisabled={isSaving}
                  >
                    Delete Configuration
                  </Button>
                )}

                <Button
                  onPress={() => router.back()}
                  variant="bordered"
                  size="md"
                  className="w-full"
                  isDisabled={isSaving}
                >
                  Cancel
                </Button>
              </View>
            </Card.Body>
          </Card>

          {/* Info Card */}
          <View className="rounded-lg bg-white/60 p-4">
            <Text variant="h4" className="mb-2" style={{ color: '#111827' }}>
              About Gateway Connection
            </Text>
            <Text variant="small" style={{ color: '#6B7280', lineHeight: 20 }}>
              The Gateway URL is the HTTP endpoint for your clawd.bot Gateway.{'\n\n'}
              Default: http://localhost:18789{'\n\n'}
              If you set CLAWDBOT_GATEWAY_TOKEN in your Gateway config, enter it above. Otherwise, leave it empty.{'\n\n'}
              🔐 Your token is encrypted and stored securely on our server.
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}
