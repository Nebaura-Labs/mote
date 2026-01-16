/**
 * Hardware Screen
 *
 * Configure and manage connection to Mote hardware device.
 * Allows user to connect to Mote's WiFi AP and configure WiFi/Gateway settings.
 */

import { View, Text, ScrollView, Alert, Platform, Linking } from 'react-native';
import { Button, Card, TextField, Chip } from 'heroui-native';
import { useMoteHardware } from '@/contexts/MoteHardwareContext';
import { useState } from 'react';

export default function HardwareScreen() {
  const {
    isConnected,
    isConnecting,
    connectionError,
    deviceStatus,
    connect,
    disconnect,
    sendConfig,
    clearError,
  } = useMoteHardware();

  // Configuration form state
  const [wifiSsid, setWifiSsid] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');
  const [serverUrl, setServerUrl] = useState('wss://gateway.example.com');
  const [serverPort, setServerPort] = useState('3000');
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * Handle connection button press
   * iOS: Opens Settings for manual WiFi connection
   * Android: Attempts auto-connection (may not work on Android 10+)
   */
  const handleConnect = async () => {
    clearError();

    if (Platform.OS === 'ios') {
      // iOS requires manual WiFi connection
      Alert.alert(
        'Connect to Mote WiFi',
        'Please open Settings and connect to the "Mote" WiFi network, then return to this app and tap "I\'m Connected".',
        [
          {
            text: 'Open Settings',
            onPress: () => {
              Linking.openURL('App-Prefs:WIFI').catch((err) => {
                console.error('Failed to open WiFi settings:', err);
                Alert.alert('Error', 'Could not open WiFi settings. Please open Settings manually.');
              });
            },
          },
          {
            text: 'Cancel',
            style: 'cancel',
          },
        ]
      );
    } else {
      // Android - attempt auto-connect (may fail on Android 10+)
      Alert.alert(
        'Connect to Mote WiFi',
        'Please connect to the "Mote" WiFi network in your device settings, then tap "I\'m Connected".',
        [
          {
            text: 'I\'m Connected',
            onPress: () => connect(),
          },
          {
            text: 'Cancel',
            style: 'cancel',
          },
        ]
      );
    }
  };

  /**
   * Attempt WebSocket connection after user confirms WiFi connection
   */
  const handleConfirmConnection = async () => {
    await connect();
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
    <ScrollView className="flex-1 bg-background">
      <View className="p-4 gap-4">
        {/* Connection Status Card */}
        <Card>
          <View className="gap-3">
            <Text className="text-lg font-semibold text-foreground">Connection Status</Text>

            <View className="flex-row gap-2 flex-wrap">
              <Chip color={isConnected ? 'success' : 'default'} size="sm">
                {isConnected ? 'Connected' : 'Disconnected'}
              </Chip>
              {isConnecting && <Chip color="primary" size="sm">Connecting...</Chip>}
            </View>

            {connectionError && (
              <View className="p-3 bg-danger-50 dark:bg-danger-900/20 rounded-lg">
                <Text className="text-sm text-danger">{connectionError}</Text>
              </View>
            )}

            {!isConnected && !isConnecting && (
              <Button onPress={handleConnect} color="primary">
                Connect to Mote
              </Button>
            )}

            {!isConnected && Platform.OS === 'ios' && (
              <Button onPress={handleConfirmConnection} color="primary" variant="flat">
                I'm Connected (Test Connection)
              </Button>
            )}

            {isConnected && (
              <Button onPress={disconnect} color="danger" variant="flat">
                Disconnect
              </Button>
            )}
          </View>
        </Card>

        {/* Device Info Card */}
        {deviceStatus && (
          <Card>
            <View className="gap-3">
              <Text className="text-lg font-semibold text-foreground">Device Information</Text>

              <View className="gap-2">
                <View className="flex-row justify-between">
                  <Text className="text-sm text-foreground-600">Device ID:</Text>
                  <Text className="text-sm text-foreground font-mono">{deviceStatus.deviceId}</Text>
                </View>

                <View className="flex-row justify-between">
                  <Text className="text-sm text-foreground-600">Firmware:</Text>
                  <Text className="text-sm text-foreground">{deviceStatus.firmwareVersion}</Text>
                </View>

                <View className="flex-row justify-between">
                  <Text className="text-sm text-foreground-600">Battery:</Text>
                  <Text className="text-sm text-foreground">
                    {deviceStatus.batteryPercent}% ({deviceStatus.batteryVoltage.toFixed(2)}V)
                  </Text>
                </View>

                {deviceStatus.ipAddress && (
                  <View className="flex-row justify-between">
                    <Text className="text-sm text-foreground-600">IP Address:</Text>
                    <Text className="text-sm text-foreground font-mono">{deviceStatus.ipAddress}</Text>
                  </View>
                )}
              </View>

              <View className="flex-row gap-2 flex-wrap">
                <Chip color={deviceStatus.wifiConnected ? 'success' : 'default'} size="sm">
                  WiFi: {deviceStatus.wifiConnected ? 'Connected' : 'Disconnected'}
                </Chip>
                <Chip color={deviceStatus.websocketConnected ? 'success' : 'default'} size="sm">
                  Gateway: {deviceStatus.websocketConnected ? 'Connected' : 'Disconnected'}
                </Chip>
              </View>
            </View>
          </Card>
        )}

        {/* Configuration Form */}
        {isConnected && (
          <Card>
            <View className="gap-4">
              <Text className="text-lg font-semibold text-foreground">WiFi Configuration</Text>

              <TextField
                label="Home WiFi SSID"
                placeholder="Enter your WiFi network name"
                value={wifiSsid}
                onChangeText={setWifiSsid}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <TextField
                label="WiFi Password"
                placeholder="Enter WiFi password"
                value={wifiPassword}
                onChangeText={setWifiPassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
              />

              <TextField
                label="Gateway Server URL"
                placeholder="wss://gateway.example.com"
                value={serverUrl}
                onChangeText={setServerUrl}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />

              <TextField
                label="Server Port"
                placeholder="3000"
                value={serverPort}
                onChangeText={setServerPort}
                keyboardType="number-pad"
              />

              <Button
                onPress={handleSendConfig}
                color="primary"
                isLoading={isSubmitting}
                isDisabled={!wifiSsid.trim() || !serverUrl.trim()}
              >
                Save Configuration
              </Button>
            </View>
          </Card>
        )}

        {/* Setup Instructions Card */}
        {!isConnected && (
          <Card>
            <View className="gap-3">
              <Text className="text-lg font-semibold text-foreground">Setup Instructions</Text>

              <View className="gap-2">
                <Text className="text-sm text-foreground-600">1. Power on your Mote device</Text>
                <Text className="text-sm text-foreground-600">
                  2. Wait for it to create a WiFi network named "Mote"
                </Text>
                <Text className="text-sm text-foreground-600">3. Tap "Connect to Mote" above</Text>
                {Platform.OS === 'ios' ? (
                  <>
                    <Text className="text-sm text-foreground-600">
                      4. In Settings, connect to "Mote" WiFi
                    </Text>
                    <Text className="text-sm text-foreground-600">
                      5. Return to this app and tap "I'm Connected"
                    </Text>
                  </>
                ) : (
                  <Text className="text-sm text-foreground-600">
                    4. Connect to "Mote" in WiFi settings, then tap "I'm Connected"
                  </Text>
                )}
              </View>

              <View className="p-3 bg-warning-50 dark:bg-warning-900/20 rounded-lg">
                <Text className="text-xs text-warning-700 dark:text-warning-400">
                  Note: The "Mote" network is open (no password) for easy setup. Your WiFi password will
                  be transmitted securely to configure your device.
                </Text>
              </View>
            </View>
          </Card>
        )}
      </View>
    </ScrollView>
  );
}
