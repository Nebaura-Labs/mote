/**
 * Gateway Setup Screen
 *
 * Configure connection to clawd.bot Gateway via SSH tunnel.
 * Required step during onboarding before accessing main app.
 */

import { useState } from 'react';
import { View, ScrollView, Alert, StyleSheet, useColorScheme } from 'react-native';
import { Stack, router } from 'expo-router';
import { Button } from 'heroui-native';
import * as DocumentPicker from 'expo-document-picker';
import { useBridge } from '@/contexts/BridgeContext';
import {
  saveSSHConfig,
  saveIdentityFile,
  savePastedIdentityKey,
  syncSSHConfigToAPI,
  testSSHConnection,
  type SSHConfig,
} from '@/utils/bridge-storage';
import { TextField } from 'heroui-native';
import { ScreenWrapper } from '@/components/ui/screen-wrapper';
import { Text } from '@/components/ui/text';

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
  },
});

export default function GatewaySetupScreen() {
  const { connect, refreshConfigStatus } = useBridge();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Form state
  const [host, setHost] = useState('');
  const [port, setPort] = useState('22');
  const [username, setUsername] = useState('');

  // Key auth (only authentication method supported)
  const [identityFileUri, setIdentityFileUri] = useState<string | null>(null);
  const [identityFileName, setIdentityFileName] = useState<string | null>(null);
  const [pastedKey, setPastedKey] = useState('');
  const [useFilePicker, setUseFilePicker] = useState(false); // Default to paste mode for simulator

  const [projectRoot, setProjectRoot] = useState('');
  const [cliPath, setCliPath] = useState('/root/.nvm/versions/node/v24.11.0/bin/clawdbot');

  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  /**
   * Test SSH connection and gateway port
   */
  const handleTestConnection = async () => {
    // Validation
    if (!host.trim()) {
      Alert.alert('Validation Error', 'Please enter SSH host');
      return;
    }

    if (!username.trim()) {
      Alert.alert('Validation Error', 'Please enter SSH username');
      return;
    }

    if (useFilePicker && !identityFileUri) {
      Alert.alert('Validation Error', 'Please select an SSH identity file');
      return;
    }

    if (!useFilePicker && !pastedKey.trim()) {
      Alert.alert('Validation Error', 'Please paste your SSH private key');
      return;
    }

    if (!projectRoot.trim()) {
      Alert.alert('Validation Error', 'Please enter project root path');
      return;
    }

    if (!cliPath.trim()) {
      Alert.alert('Validation Error', 'Please enter CLI path');
      return;
    }

    const portNumber = parseInt(port, 10);
    if (isNaN(portNumber) || portNumber < 1 || portNumber > 65535) {
      Alert.alert('Validation Error', 'Please enter a valid port (1-65535)');
      return;
    }

    setIsTesting(true);

    try {
      // Save identity file to secure storage
      let securePath: string;

      if (useFilePicker) {
        securePath = await saveIdentityFile(identityFileUri!);
      } else {
        securePath = await savePastedIdentityKey(pastedKey);
      }

      const config: SSHConfig = {
        host: host.trim(),
        port: portNumber,
        username: username.trim(),
        authMethod: 'key',
        identityFilePath: securePath,
        projectRoot: projectRoot.trim(),
        cliPath: cliPath.trim(),
      };

      // Save SSH config locally
      await saveSSHConfig(config);

      // Sync SSH config to web API
      await syncSSHConfigToAPI();

      // Test the connection
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
      console.error('[GatewaySetup] Test failed:', error);
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
   * Pick SSH identity file (private key)
   */
  const pickIdentityFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*', // Accept all files
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        const file = result.assets[0];
        setIdentityFileUri(file.uri);
        setIdentityFileName(file.name);
      }
    } catch (error) {
      console.error('[GatewaySetup] Error picking file:', error);
      Alert.alert('Error', 'Failed to pick identity file');
    }
  };

  /**
   * Save SSH configuration and connect
   */
  const handleSaveAndConnect = async () => {
    // Validation
    if (!host.trim()) {
      Alert.alert('Validation Error', 'Please enter SSH host');
      return;
    }

    if (!username.trim()) {
      Alert.alert('Validation Error', 'Please enter SSH username');
      return;
    }

    if (useFilePicker && !identityFileUri) {
      Alert.alert('Validation Error', 'Please select an SSH identity file');
      return;
    }

    if (!useFilePicker && !pastedKey.trim()) {
      Alert.alert('Validation Error', 'Please paste your SSH private key');
      return;
    }

    if (!projectRoot.trim()) {
      Alert.alert('Validation Error', 'Please enter project root path');
      return;
    }

    if (!cliPath.trim()) {
      Alert.alert('Validation Error', 'Please enter CLI path');
      return;
    }

    const portNumber = parseInt(port, 10);
    if (isNaN(portNumber) || portNumber < 1 || portNumber > 65535) {
      Alert.alert('Validation Error', 'Please enter a valid port (1-65535)');
      return;
    }

    setIsLoading(true);

    try {
      // Save identity file to secure storage
      let securePath: string;

      if (useFilePicker) {
        securePath = await saveIdentityFile(identityFileUri!);
      } else {
        securePath = await savePastedIdentityKey(pastedKey);
      }

      const config: SSHConfig = {
        host: host.trim(),
        port: portNumber,
        username: username.trim(),
        authMethod: 'key',
        identityFilePath: securePath,
        projectRoot: projectRoot.trim(),
        cliPath: cliPath.trim(),
      };

      // Save SSH config locally
      await saveSSHConfig(config);

      console.log('[GatewaySetup] Configuration saved locally');

      // Sync SSH config to web API for server-side tunneling
      try {
        await syncSSHConfigToAPI();
        console.log('[GatewaySetup] Configuration synced to server');
      } catch (syncError) {
        console.warn('[GatewaySetup] Failed to sync to server:', syncError);
        // Don't fail the whole setup if sync fails - user can retry later
      }

      // Refresh config status in BridgeContext
      await refreshConfigStatus();

      // Attempt connection via WebSocket
      await connect();

      Alert.alert(
        'Success',
        'Gateway configured and connected!',
        [
          {
            text: 'Continue',
            onPress: () => {
              // Navigate to main app
              router.replace('/(drawer)');
            },
          },
        ]
      );
    } catch (error) {
      console.error('[GatewaySetup] Setup failed:', error);

      Alert.alert(
        'Connection Failed',
        error instanceof Error ? error.message : 'Unknown error occurred',
        [
          {
            text: 'Try Again',
            style: 'default',
          },
        ]
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScreenWrapper>
      <Stack.Screen
        options={{
          title: 'Connect to Gateway',
          headerShown: false,
        }}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-6 mt-8">
          {/* Header */}
          <View className="gap-2" style={{ alignItems: 'center', width: '100%' }}>
            <Text variant="h1" style={{ color: isDark ? '#e5e5e5' : '#111827', textAlign: 'center', width: '100%' }}>
              Connect to Gateway
            </Text>
            <Text variant="lead" style={{ color: isDark ? '#9CA3AF' : '#6B7280', textAlign: 'center', width: '100%' }}>
              Configure SSH connection to your clawd.bot Gateway server
            </Text>
          </View>

          {/* SSH Host */}
          <TextField className="mb-4">
            <TextField.Label className="font-medium mb-1" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>
              SSH Host
            </TextField.Label>
            <TextField.Input
              placeholder="example.com or 192.168.1.100"
              value={host}
              onChangeText={setHost}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              style={{
                backgroundColor: isDark ? '#2a2a2a' : '#ffffff',
                borderColor: isDark ? '#3a3a3a' : '#e5e7eb',
                borderWidth: 1,
                borderRadius: 12,
                paddingHorizontal: 16,
                height: 56,
                color: isDark ? '#e5e5e5' : '#111827',
              }}
            />
          </TextField>

          {/* SSH Port */}
          <TextField className="mb-4">
            <TextField.Label className="font-medium mb-1" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>
              SSH Port
            </TextField.Label>
            <TextField.Input
              placeholder="22"
              value={port}
              onChangeText={setPort}
              keyboardType="number-pad"
              style={{
                backgroundColor: isDark ? '#2a2a2a' : '#ffffff',
                borderColor: isDark ? '#3a3a3a' : '#e5e7eb',
                borderWidth: 1,
                borderRadius: 12,
                paddingHorizontal: 16,
                height: 56,
                color: isDark ? '#e5e5e5' : '#111827',
              }}
            />
          </TextField>

          {/* Username */}
          <TextField className="mb-4">
            <TextField.Label className="font-medium mb-1" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>
              Username
            </TextField.Label>
            <TextField.Input
              placeholder="your-username"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              style={{
                backgroundColor: isDark ? '#2a2a2a' : '#ffffff',
                borderColor: isDark ? '#3a3a3a' : '#e5e7eb',
                borderWidth: 1,
                borderRadius: 12,
                paddingHorizontal: 16,
                height: 56,
                color: isDark ? '#e5e5e5' : '#111827',
              }}
            />
          </TextField>

          {/* SSH Identity File (Private Key) */}
          <View className="gap-2 mb-4">
            <Text variant="small" style={{ color: isDark ? '#e5e5e5' : '#374151', fontWeight: '600' }}>
              SSH Identity File (Private Key)
            </Text>

            {/* Toggle between file picker and paste */}
            <View className="flex-row gap-2 mb-2">
              <Button
                onPress={() => setUseFilePicker(true)}
                variant={useFilePicker ? 'solid' : 'bordered'}
                size="sm"
                className="flex-1"
                style={!useFilePicker && isDark ? { borderColor: '#3a3a3a' } : undefined}
              >
                <Text style={{ color: useFilePicker ? '#ffffff' : (isDark ? '#e5e5e5' : '#111827') }}>
                  Upload File
                </Text>
              </Button>
              <Button
                onPress={() => setUseFilePicker(false)}
                variant={!useFilePicker ? 'solid' : 'bordered'}
                size="sm"
                className="flex-1"
                style={useFilePicker && isDark ? { borderColor: '#3a3a3a' } : undefined}
              >
                <Text style={{ color: !useFilePicker ? '#ffffff' : (isDark ? '#e5e5e5' : '#111827') }}>
                  Paste Key
                </Text>
              </Button>
            </View>

            {useFilePicker ? (
              <>
                <Button
                  onPress={pickIdentityFile}
                  variant="bordered"
                  className="w-full"
                  style={isDark ? { borderColor: '#3a3a3a' } : undefined}
                >
                  <Text style={{ color: isDark ? '#e5e5e5' : '#111827' }}>
                    {identityFileName || 'Select Identity File'}
                  </Text>
                </Button>
                {identityFileName && (
                  <Text variant="small" style={{ color: isDark ? '#6B7280' : '#9CA3AF', fontSize: 12 }}>
                    Selected: {identityFileName}
                  </Text>
                )}
              </>
            ) : (
              <>
                <TextField className="mb-2">
                  <TextField.Input
                    placeholder="Paste your SSH private key here&#10;(e.g., -----BEGIN OPENSSH PRIVATE KEY-----)"
                    value={pastedKey}
                    onChangeText={setPastedKey}
                    multiline
                    numberOfLines={8}
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={{
                      backgroundColor: isDark ? '#2a2a2a' : '#ffffff',
                      borderColor: isDark ? '#3a3a3a' : '#e5e7eb',
                      borderWidth: 1,
                      borderRadius: 12,
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      minHeight: 128,
                      color: isDark ? '#e5e5e5' : '#111827',
                      textAlignVertical: 'top',
                    }}
                  />
                </TextField>
                <Text variant="small" style={{ color: isDark ? '#6B7280' : '#9CA3AF', fontSize: 12 }}>
                  Paste the entire contents of your private key file (e.g., ~/.ssh/id_rsa or ~/.ssh/id_ed25519)
                </Text>
              </>
            )}
          </View>

          {/* Project Root */}
          <TextField className="mb-4">
            <TextField.Label className="font-medium mb-1" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>
              Project Root Path
            </TextField.Label>
            <TextField.Input
              placeholder="/path/to/your/project"
              value={projectRoot}
              onChangeText={setProjectRoot}
              autoCapitalize="none"
              autoCorrect={false}
              style={{
                backgroundColor: isDark ? '#2a2a2a' : '#ffffff',
                borderColor: isDark ? '#3a3a3a' : '#e5e7eb',
                borderWidth: 1,
                borderRadius: 12,
                paddingHorizontal: 16,
                height: 56,
                color: isDark ? '#e5e5e5' : '#111827',
              }}
            />
          </TextField>

          {/* CLI Path */}
          <TextField className="mb-4">
            <TextField.Label className="font-medium mb-1" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>
              clawdbot CLI Path
            </TextField.Label>
            <TextField.Input
              placeholder="/root/.nvm/versions/node/v24.11.0/bin/clawdbot"
              value={cliPath}
              onChangeText={setCliPath}
              autoCapitalize="none"
              autoCorrect={false}
              style={{
                backgroundColor: isDark ? '#2a2a2a' : '#ffffff',
                borderColor: isDark ? '#3a3a3a' : '#e5e7eb',
                borderWidth: 1,
                borderRadius: 12,
                paddingHorizontal: 16,
                height: 56,
                color: isDark ? '#e5e5e5' : '#111827',
              }}
            />
          </TextField>

          {/* Action Buttons */}
          <View className="mt-4 gap-3">
            <Button
              onPress={handleTestConnection}
              isLoading={isTesting}
              isDisabled={isLoading || isTesting}
              variant="bordered"
              size="lg"
              className="w-full"
              style={isDark ? { borderColor: '#3a3a3a' } : undefined}
            >
              <Text style={{ color: isDark ? '#e5e5e5' : '#111827' }}>
                Test Connection
              </Text>
            </Button>

            <Button
              onPress={handleSaveAndConnect}
              isLoading={isLoading}
              isDisabled={isLoading || isTesting}
              color="primary"
              size="lg"
              className="w-full"
            >
              Save and Connect
            </Button>
          </View>

          {/* Info */}
          <View style={{ borderRadius: 8, backgroundColor: isDark ? '#2a2a2a' : 'rgba(255,255,255,0.6)', padding: 16, marginBottom: 24 }}>
            <Text variant="small" style={{ color: isDark ? '#9CA3AF' : '#6B7280', lineHeight: 20 }}>
              This information is securely stored on your device. Your Gateway
              must be running and accessible via SSH for connection to succeed.
              {'\n\n'}
              🔐 SSH key authentication is used for secure connection to your Gateway server.
              {'\n\n'}
              💡 Use "Test Connection" to verify SSH and gateway port connectivity before connecting.
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}
