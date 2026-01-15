/**
 * Home Screen
 *
 * Main dashboard showing Gateway connection status and SSH configuration
 */

import { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';
import { Button, Card } from 'heroui-native';
import { ScreenWrapper } from '@/components/ui/screen-wrapper';
import { Text } from '@/components/ui/text';
import { BridgeStatusCard } from '@/components/BridgeStatusIndicator';
import { useBridge } from '@/contexts/BridgeContext';
import {
  getSSHConfig,
  getIdentityFilePath,
  clearAllBridgeData,
  testSSHConnection,
  type SSHConfig,
} from '@/utils/bridge-storage';

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
  },
});

export default function Home() {
  const { isConfigured, refreshConfigStatus, disconnect } = useBridge();
  const [sshConfig, setSSHConfig] = useState<SSHConfig | null>(null);
  const [hasIdentityFile, setHasIdentityFile] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isTesting, setIsTesting] = useState(false);

  /**
   * Load SSH configuration
   */
  const loadConfig = async () => {
    try {
      setIsLoading(true);
      const [config, identityPath] = await Promise.all([
        getSSHConfig(),
        getIdentityFilePath(),
      ]);

      setSSHConfig(config);
      setHasIdentityFile(!!identityPath);
    } catch (error) {
      console.error('[Home] Failed to load config:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  /**
   * Handle test SSH connection
   */
  const handleTestConnection = async () => {
    if (!isConfigured) {
      Alert.alert('Error', 'No configuration found. Please configure your gateway first.');
      return;
    }

    setIsTesting(true);

    try {
      const result = await testSSHConnection();

      if (result.success) {
        Alert.alert(
          '✅ Connection Test Successful',
          result.details || result.message,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          '❌ Connection Test Failed',
          `${result.message}\n\n${result.details || ''}`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('[Home] Test failed:', error);
      Alert.alert(
        'Test Failed',
        error instanceof Error ? error.message : 'Unknown error occurred',
        [{ text: 'OK' }]
      );
    } finally {
      setIsTesting(false);
    }
  };

  /**
   * Handle reconfigure Gateway
   */
  const handleReconfigure = () => {
    Alert.alert(
      'Reconfigure Gateway',
      'This will disconnect and clear your current configuration. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reconfigure',
          style: 'destructive',
          onPress: async () => {
            try {
              await disconnect();
              await clearAllBridgeData();
              await refreshConfigStatus();
              router.replace('/gateway-setup');
            } catch (error) {
              console.error('[Home] Failed to clear config:', error);
              Alert.alert('Error', 'Failed to clear configuration');
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
            <Text variant="h1" style={{ color: '#111827' }}>
              Mote
            </Text>
            <Text variant="lead" style={{ color: '#6B7280' }}>
              Voice companion for clawd.bot
            </Text>
          </View>

          {/* Connection Status */}
          <BridgeStatusCard />

          {/* SSH Configuration */}
          {isConfigured && sshConfig && (
            <Card className="bg-white border border-gray-200 rounded-xl">
              <Card.Body className="p-4">
                <Text variant="h4" className="mb-4" style={{ color: '#111827' }}>
                  Gateway Configuration
                </Text>

                <View className="gap-3">
                  {/* SSH Host */}
                  <View>
                    <Text variant="small" style={{ color: '#6B7280' }}>
                      SSH Host
                    </Text>
                    <Text variant="p" style={{ color: '#111827' }}>
                      {sshConfig.host}:{sshConfig.port}
                    </Text>
                  </View>

                  {/* Username */}
                  <View>
                    <Text variant="small" style={{ color: '#6B7280' }}>
                      Username
                    </Text>
                    <Text variant="p" style={{ color: '#111827' }}>
                      {sshConfig.username}
                    </Text>
                  </View>

                  {/* Project Root */}
                  <View>
                    <Text variant="small" style={{ color: '#6B7280' }}>
                      Project Root
                    </Text>
                    <Text variant="p" style={{ color: '#111827' }}>
                      {sshConfig.projectRoot}
                    </Text>
                  </View>

                  {/* CLI Path */}
                  <View>
                    <Text variant="small" style={{ color: '#6B7280' }}>
                      CLI Path
                    </Text>
                    <Text variant="p" style={{ color: '#111827' }}>
                      {sshConfig.cliPath}
                    </Text>
                  </View>

                  {/* SSH Key Status */}
                  <View>
                    <Text variant="small" style={{ color: '#6B7280' }}>
                      SSH Key
                    </Text>
                    <View className="flex-row items-center gap-2 mt-1">
                      <View
                        className={`h-2 w-2 rounded-full ${
                          hasIdentityFile ? 'bg-green-500' : 'bg-red-500'
                        }`}
                      />
                      <Text
                        variant="p"
                        style={{
                          color: hasIdentityFile ? '#10b981' : '#ef4444',
                        }}
                      >
                        {hasIdentityFile
                          ? 'Private key configured'
                          : 'No private key found'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Action Buttons */}
                <View className="mt-4 gap-3">
                  <Button
                    onPress={handleTestConnection}
                    isLoading={isTesting}
                    isDisabled={isTesting}
                    variant="bordered"
                    size="md"
                    className="w-full"
                  >
                    Test Connection
                  </Button>

                  <Button
                    onPress={handleReconfigure}
                    variant="bordered"
                    color="danger"
                    size="md"
                    className="w-full"
                  >
                    Reconfigure Gateway
                  </Button>
                </View>
              </Card.Body>
            </Card>
          )}

          {/* Not Configured */}
          {!isConfigured && !isLoading && (
            <Card className="bg-white border border-gray-200 rounded-xl">
              <Card.Body className="p-4">
                <Text variant="h4" className="mb-2" style={{ color: '#111827' }}>
                  No Gateway Configured
                </Text>
                <Text variant="p" className="mb-4" style={{ color: '#6B7280' }}>
                  Configure your SSH connection to clawd.bot Gateway to get started.
                </Text>
                <Button
                  onPress={() => router.push('/gateway-setup')}
                  color="primary"
                  size="md"
                  className="w-full"
                >
                  Configure Gateway
                </Button>
              </Card.Body>
            </Card>
          )}

          {/* Info Card */}
          <View className="rounded-lg bg-white/60 p-4">
            <Text variant="small" style={{ color: '#6B7280', lineHeight: 20 }}>
              Mote connects to your clawd.bot Gateway server via SSH tunnel.
              {'\n\n'}
              🔐 All credentials are stored securely on your device.
              {'\n'}
              🔄 Auto-reconnect keeps your connection alive.
              {'\n'}
              📡 Use the status indicator above to monitor connection health.
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}
