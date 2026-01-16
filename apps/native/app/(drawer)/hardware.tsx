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
import { useAuth } from '@/contexts/auth-context';
import { useState, useEffect } from 'react';

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

  // Get auth session for automatic token
  const { session } = useAuth();

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
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get session token for device authentication
  const sessionToken = (session as any)?.session?.token || (session as any)?.token || null;

  // Web backend URL - Mote connects here for voice (backend handles Gateway internally)
  const webBackendUrl = process.env.EXPO_PUBLIC_SERVER_URL || '';
  const parsedUrl = webBackendUrl ? new URL(webBackendUrl) : null;
  const webBackendHost = parsedUrl?.hostname || '';
  const webBackendPort = parsedUrl?.port ? parseInt(parsedUrl.port, 10) : (parsedUrl?.protocol === 'https:' ? 443 : 80);

  /**
   * Prefill WiFi SSID from Mote device status when connected via BLE
   */
  useEffect(() => {
    if (isConnected && deviceStatus) {
      console.log('[Hardware] Prefilling form from device status:', deviceStatus);

      // Prefill WiFi SSID from device when available
      if (deviceStatus.wifiSsid) {
        console.log('[Hardware] Prefilling WiFi SSID:', deviceStatus.wifiSsid);
        setWifiSsid(deviceStatus.wifiSsid);
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

    if (!webBackendHost) {
      Alert.alert('Configuration Error', 'Web backend URL not configured. Check EXPO_PUBLIC_SERVER_URL.');
      return;
    }

    if (!sessionToken) {
      Alert.alert('Authentication Error', 'No session token available. Please log in again.');
      return;
    }

    setIsSubmitting(true);
    clearError();

    try {
      await sendConfig({
        wifiSsid: wifiSsid.trim(),
        wifiPassword: wifiPassword.trim(),
        websocketServer: webBackendHost,
        websocketPort: webBackendPort,
        gatewayToken: sessionToken, // Use session token automatically
      });

      Alert.alert(
        'Configuration Sent',
        'Your Mote device will now connect to your WiFi network and the Mote backend. This may take a few moments.',
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

              {/* Backend Server (auto-configured) */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Mote Backend Server</Text>
                <View style={{
                  padding: 12,
                  backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                  borderRadius: 8,
                }}>
                  <Text style={{ fontSize: 14, color: '#3b82f6' }}>
                    {webBackendHost ? `wss://${webBackendHost}:${webBackendPort}` : 'Not configured'}
                  </Text>
                </View>
              </View>

              {/* Auth status */}
              {sessionToken && webBackendHost && (
                <View style={{
                  padding: 12,
                  backgroundColor: isDark ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                  borderRadius: 8,
                }}>
                  <Text style={{ fontSize: 12, color: '#10b981' }}>
                    ✓ Ready to configure (auth token + backend server)
                  </Text>
                </View>
              )}

              {!sessionToken && (
                <View style={{
                  padding: 12,
                  backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  borderRadius: 8,
                }}>
                  <Text style={{ fontSize: 12, color: '#ef4444' }}>
                    ⚠ No authentication token. Please log in again.
                  </Text>
                </View>
              )}

              <Button
                onPress={handleSendConfig}
                isLoading={isSubmitting}
                isDisabled={!wifiSsid.trim() || !webBackendHost || !sessionToken}
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
