/**
 * Hardware Screen (BLE Version)
 *
 * Scan for and connect to Mote devices via Bluetooth Low Energy.
 * Configure WiFi credentials and Gateway server settings.
 */

import { View, Text, ScrollView, Alert, FlatList, StyleSheet, useColorScheme, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { Button, Card, Chip } from 'heroui-native';
import { ScreenWrapper } from '@/components/ui/screen-wrapper';
import { useMoteHardware } from '@/contexts/MoteHardwareContext';
import { useState, useEffect } from 'react';
import { getSSHConfig } from '@/utils/bridge-storage';

const getStyles = (isDark: boolean) => StyleSheet.create({
  card: {
    backgroundColor: isDark ? '#2a2a2a' : '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: isDark ? '#3a3a3a' : '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isDark ? 0.3 : 0.1,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 16,
  },
  text: {
    color: isDark ? '#e5e5e5' : '#111827',
  },
  textMuted: {
    color: isDark ? '#9CA3AF' : '#6B7280',
  },
  inputContainer: {
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: isDark ? '#e5e5e5' : '#111827',
  },
  input: {
    backgroundColor: isDark ? '#1a1a1a' : '#f9fafb',
    borderWidth: 1,
    borderColor: isDark ? '#3a3a3a' : '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: isDark ? '#e5e5e5' : '#111827',
  },
});

export default function HardwareScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const styles = getStyles(isDark);

  const {
    isConnected,
    isScanning,
    isConnecting,
    connectionError,
    deviceStatus,
    discoveredDevices,
    scanForDevices,
    connect,
    disconnect,
    sendConfig,
    clearError,
  } = useMoteHardware();

  // Configuration form state
  const [wifiSsid, setWifiSsid] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [serverPort, setServerPort] = useState('443');
  const [gatewayToken, setGatewayToken] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * Load stored Gateway configuration on mount
   */
  useEffect(() => {
    const loadStoredConfig = async () => {
      console.log('[Hardware] Loading stored SSH config...');
      const sshConfig = await getSSHConfig();
      console.log('[Hardware] SSH config:', sshConfig);
      if (sshConfig) {
        // Use the actual remote server address (not localhost)
        // Mote device needs to connect directly to the server
        const url = `wss://${sshConfig.host}`;
        console.log('[Hardware] Auto-populating Gateway URL:', url);
        setServerUrl(url);
        setServerPort('18789'); // Your Gateway port
      } else {
        console.log('[Hardware] No SSH config found');
      }
    };
    loadStoredConfig();
  }, []);

  /**
   * Prefill form from Mote device status when connected via BLE
   * This populates fields with the device's current configuration
   * Always overwrites form values with device config when connected
   */
  useEffect(() => {
    if (isConnected && deviceStatus) {
      console.log('[Hardware] Prefilling form from device status:', deviceStatus);

      // Always prefill WiFi SSID from device when available
      if (deviceStatus.wifiSsid) {
        console.log('[Hardware] Prefilling WiFi SSID:', deviceStatus.wifiSsid);
        setWifiSsid(deviceStatus.wifiSsid);
      }

      // Always prefill Gateway server from device when available
      if (deviceStatus.gatewayServer) {
        console.log('[Hardware] Prefilling Gateway server:', deviceStatus.gatewayServer);
        setServerUrl(deviceStatus.gatewayServer);
      }

      // Always prefill Gateway port from device when available
      if (deviceStatus.gatewayPort) {
        console.log('[Hardware] Prefilling Gateway port:', deviceStatus.gatewayPort);
        setServerPort(String(deviceStatus.gatewayPort));
      }
    }
  }, [isConnected, deviceStatus]);

  /**
   * Handle BLE scan button
   */
  const handleScan = async () => {
    clearError();
    await scanForDevices();
  };

  /**
   * Handle device selection from scan results
   */
  const handleDeviceSelect = async (deviceId: string) => {
    clearError();
    await connect(deviceId);
  };

  /**
   * Send configuration to Mote device
   */
  const handleSendConfig = async () => {
    // Validate inputs
    if (!wifiSsid.trim()) {
      Alert.alert('Validation Error', 'Please enter your home WiFi SSID');
      return;
    }

    if (!serverUrl.trim()) {
      Alert.alert('Validation Error', 'Please enter the Gateway server URL');
      return;
    }

    if (!gatewayToken.trim()) {
      Alert.alert('Validation Error', 'Please enter your Gateway token');
      return;
    }

    const port = parseInt(serverPort, 10);
    if (isNaN(port) || port < 1 || port > 65535) {
      Alert.alert('Validation Error', 'Please enter a valid port number (1-65535)');
      return;
    }

    setIsSubmitting(true);
    clearError();

    try {
      await sendConfig({
        wifiSsid: wifiSsid.trim(),
        wifiPassword: wifiPassword.trim(),
        websocketServer: serverUrl.trim(),
        websocketPort: port,
        gatewayToken: gatewayToken.trim(),
      });

      Alert.alert(
        'Configuration Sent',
        'Your Mote device will now connect to your WiFi network and Gateway server. This may take a few moments.',
        [
          {
            text: 'OK',
            onPress: () => {
              // Clear form
              setWifiSsid('');
              setWifiPassword('');
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert(
        'Configuration Error',
        error instanceof Error ? error.message : 'Failed to send configuration to Mote device'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScreenWrapper style={{ backgroundColor: isDark ? '#1a1a1a' : '#f0efea' }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={100}
      >
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          <View className="p-4 gap-4">
        {/* Connection Status Card */}
        <View style={styles.card}>
          <View className="gap-3">
            <Text style={[styles.text, { fontSize: 18, fontWeight: '600' }]}>Connection Status</Text>

            <View style={{
              padding: 12,
              backgroundColor: isConnected ? (isDark ? '#10b981' : '#10b981') : (isDark ? '#3a3a3a' : '#e5e7eb'),
              borderRadius: 8,
            }}>
              <Text style={{ color: isConnected ? '#ffffff' : (isDark ? '#9CA3AF' : '#6B7280'), fontSize: 14, fontWeight: '600' }}>
                {isConnected ? 'Connected' : 'Disconnected'}
              </Text>
            </View>

            {isScanning && (
              <View style={{ padding: 12, backgroundColor: '#007AFF', borderRadius: 8 }}>
                <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '600' }}>Scanning...</Text>
              </View>
            )}

            {isConnecting && (
              <View style={{ padding: 12, backgroundColor: '#007AFF', borderRadius: 8 }}>
                <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '600' }}>Connecting...</Text>
              </View>
            )}

            {connectionError && (
              <View className="p-3 bg-danger-50 dark:bg-danger-900/20 rounded-lg">
                <Text className="text-sm text-danger">{connectionError}</Text>
              </View>
            )}

            {!isConnected && !isConnecting && !isScanning && (
              <Button onPress={handleScan} color="primary">
                Scan for Mote Devices
              </Button>
            )}

            {isConnected && (
              <Button onPress={disconnect} color="danger">
                Disconnect
              </Button>
            )}
          </View>
        </View>

        {/* Discovered Devices List */}
        {!isConnected && discoveredDevices.length > 0 && (
          <View style={styles.card}>
            <View className="gap-3">
              <Text style={[styles.text, { fontSize: 18, fontWeight: '600' }]}>
                Found {discoveredDevices.length} Device(s)
              </Text>

              <FlatList
                data={discoveredDevices}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                renderItem={({ item }) => (
                  <View style={{
                    padding: 12,
                    backgroundColor: isDark ? '#3a3a3a' : '#f3f4f6',
                    borderRadius: 8,
                    marginBottom: 8,
                  }}>
                    <View className="flex-row justify-between items-center">
                      <View className="flex-1">
                        <Text style={[styles.text, { fontWeight: '600' }]}>{item.name || 'Mote'}</Text>
                        <Text style={[styles.textMuted, { fontSize: 12, fontFamily: 'monospace' }]}>{item.id}</Text>
                      </View>
                      <Button
                        onPress={() => handleDeviceSelect(item.id)}
                        color="primary"
                        size="sm"
                        isLoading={isConnecting}
                      >
                        Connect
                      </Button>
                    </View>
                  </View>
                )}
              />

              <Button onPress={handleScan} color="primary" size="sm">
                Scan Again
              </Button>
            </View>
          </View>
        )}

        {/* Device Info Card */}
        {isConnected && deviceStatus && (
          <View style={styles.card}>
            <View className="gap-3">
              <Text style={[styles.text, { fontSize: 18, fontWeight: '600' }]}>Device Information</Text>

              <View className="gap-2">
                <View className="flex-row justify-between">
                  <Text style={[styles.textMuted, { fontSize: 14 }]}>Device ID:</Text>
                  <Text style={[styles.text, { fontSize: 14, fontFamily: 'monospace' }]}>{deviceStatus.deviceId}</Text>
                </View>

                <View className="flex-row justify-between">
                  <Text style={[styles.textMuted, { fontSize: 14 }]}>Firmware:</Text>
                  <Text style={[styles.text, { fontSize: 14 }]}>{deviceStatus.firmwareVersion}</Text>
                </View>

                <View className="flex-row justify-between">
                  <Text style={[styles.textMuted, { fontSize: 14 }]}>Battery:</Text>
                  <Text style={[styles.text, { fontSize: 14 }]}>
                    {deviceStatus.batteryPercent}% ({deviceStatus.batteryVoltage.toFixed(2)}V)
                  </Text>
                </View>
              </View>

              <View className="flex-row gap-2 flex-wrap">
                <Chip
                  color={deviceStatus.wifiConnected ? 'success' : deviceStatus.wifiConfigured ? 'warning' : 'default'}
                  size="sm"
                >
                  WiFi: {deviceStatus.wifiConnected ? 'Connected' : deviceStatus.wifiConfigured ? 'Disconnected' : 'Not Configured'}
                </Chip>
                <Chip
                  color={deviceStatus.gatewayConnected ? 'success' : deviceStatus.gatewayConfigured ? 'warning' : 'default'}
                  size="sm"
                >
                  Gateway: {deviceStatus.gatewayConnected ? 'Connected' : deviceStatus.gatewayConfigured ? 'Disconnected' : 'Not Configured'}
                </Chip>
              </View>
            </View>
          </View>
        )}

        {/* Configuration Form */}
        {isConnected && (
          <View style={styles.card}>
            <View className="gap-4">
              <Text style={[styles.text, { fontSize: 18, fontWeight: '600' }]}>WiFi Configuration</Text>
              <Text style={[styles.textMuted, { fontSize: 12 }]}>
                Configure your device to connect to WiFi and Gateway server
              </Text>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Home WiFi SSID</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your WiFi network name"
                  placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                  value={wifiSsid}
                  onChangeText={setWifiSsid}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>WiFi Password</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter WiFi password"
                  placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                  value={wifiPassword}
                  onChangeText={setWifiPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Gateway Server URL</Text>
                <TextInput
                  style={styles.input}
                  placeholder="wss://gateway.example.com"
                  placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                  value={serverUrl}
                  onChangeText={setServerUrl}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Server Port</Text>
                <TextInput
                  style={styles.input}
                  placeholder="3000"
                  placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                  value={serverPort}
                  onChangeText={setServerPort}
                  keyboardType="number-pad"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Gateway Token</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your Gateway authentication token"
                  placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                  value={gatewayToken}
                  onChangeText={setGatewayToken}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <Button
                onPress={handleSendConfig}
                color="primary"
                isLoading={isSubmitting}
                isDisabled={!wifiSsid.trim() || !serverUrl.trim() || !gatewayToken.trim()}
              >
                Save Configuration
              </Button>
            </View>
          </View>
        )}

        {/* Setup Instructions Card */}
        {!isConnected && discoveredDevices.length === 0 && !isScanning && (
          <View style={styles.card}>
            <View className="gap-3">
              <Text style={[styles.text, { fontSize: 18, fontWeight: '600' }]}>Setup Instructions</Text>

              <View className="gap-2">
                <Text style={[styles.textMuted, { fontSize: 14 }]}>1. Power on your Mote device</Text>
                <Text style={[styles.textMuted, { fontSize: 14 }]}>
                  2. Wait for the RGB LED to pulse blue (BLE advertising)
                </Text>
                <Text style={[styles.textMuted, { fontSize: 14 }]}>
                  3. Tap "Scan for Mote Devices" above
                </Text>
                <Text style={[styles.textMuted, { fontSize: 14 }]}>4. Select your Mote from the list</Text>
                <Text style={[styles.textMuted, { fontSize: 14 }]}>5. Configure WiFi and Gateway settings</Text>
              </View>

              <View style={{
                padding: 12,
                backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                borderRadius: 8,
              }}>
                <Text style={{ fontSize: 12, color: '#3b82f6' }}>
                  ℹ️ Bluetooth Low Energy (BLE) provides secure, stable communication with your Mote
                  device without interrupting your WiFi connection.
                </Text>
              </View>
            </View>
          </View>
        )}
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenWrapper>
  );
}
