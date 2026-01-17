/**
 * Header Status Bar
 *
 * Displays Gateway and Mote hardware connection status in the header.
 * When Mote is connected, tapping shows a volume control popover.
 */

import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, useColorScheme } from 'react-native';
import { Popover, Button } from 'heroui-native';
import { SpeakerHigh, SpeakerLow, Minus, Plus, BluetoothConnected, BluetoothSlash } from 'phosphor-react-native';
import { useBridge, isConnectedStatus, isConnectingStatus, getStatusMessage } from '@/contexts/BridgeContext';
import { useMoteHardware } from '@/contexts/MoteHardwareContext';

/**
 * Gateway Status Badge (compact)
 */
function GatewayStatusBadge() {
  const { status } = useBridge();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const getBadgeColor = () => {
    if (isConnectedStatus(status)) return '#10b981'; // green
    if (isConnectingStatus(status)) return '#f59e0b'; // yellow
    if (status === 'error') return '#ef4444'; // red
    return '#6b7280'; // gray
  };

  const getLabel = () => {
    if (isConnectedStatus(status)) return 'Gateway';
    if (isConnectingStatus(status)) return 'Connecting...';
    return 'Gateway';
  };

  return (
    <View
      className="flex-row items-center gap-1.5 rounded-full px-2.5 py-1"
      style={{ backgroundColor: isDark ? '#2a2a2a' : '#f3f4f6' }}
    >
      <View className="h-2 w-2 rounded-full" style={{ backgroundColor: getBadgeColor() }} />
      <Text className="text-xs font-medium" style={{ color: isDark ? '#e5e5e5' : '#111827' }}>
        {getLabel()}
      </Text>
    </View>
  );
}

/**
 * Volume Control Slider (custom implementation)
 */
function VolumeControl({
  volume,
  onVolumeChange,
}: {
  volume: number;
  onVolumeChange: (volume: number) => void;
}) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const decreaseVolume = () => {
    const newVolume = Math.max(0, volume - 10);
    onVolumeChange(newVolume);
  };

  const increaseVolume = () => {
    const newVolume = Math.min(100, volume + 10);
    onVolumeChange(newVolume);
  };

  return (
    <View className="flex-row items-center gap-3 px-2 py-1">
      {/* Decrease button */}
      <TouchableOpacity
        onPress={decreaseVolume}
        className="h-8 w-8 items-center justify-center rounded-full"
        style={{ backgroundColor: isDark ? '#3a3a3a' : '#e5e7eb' }}
        activeOpacity={0.7}
      >
        <Minus size={16} color={isDark ? '#e5e5e5' : '#374151'} weight="bold" />
      </TouchableOpacity>

      {/* Volume display */}
      <View className="flex-row items-center gap-2" style={{ minWidth: 60 }}>
        {volume < 50 ? (
          <SpeakerLow size={18} color={isDark ? '#e5e5e5' : '#374151'} weight="fill" />
        ) : (
          <SpeakerHigh size={18} color={isDark ? '#e5e5e5' : '#374151'} weight="fill" />
        )}
        <Text
          className="text-base font-semibold"
          style={{ color: isDark ? '#e5e5e5' : '#111827', minWidth: 35 }}
        >
          {volume}%
        </Text>
      </View>

      {/* Increase button */}
      <TouchableOpacity
        onPress={increaseVolume}
        className="h-8 w-8 items-center justify-center rounded-full"
        style={{ backgroundColor: isDark ? '#3a3a3a' : '#e5e7eb' }}
        activeOpacity={0.7}
      >
        <Plus size={16} color={isDark ? '#e5e5e5' : '#374151'} weight="bold" />
      </TouchableOpacity>
    </View>
  );
}

/**
 * Mote Hardware Status Button with Volume Popover
 */
function MoteStatusButton() {
  const { isConnected, isConnecting, deviceStatus, sendVolume } = useMoteHardware();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [localVolume, setLocalVolume] = useState(deviceStatus?.volume ?? 70);

  // Update local volume when device status changes
  React.useEffect(() => {
    if (deviceStatus?.volume !== undefined) {
      setLocalVolume(deviceStatus.volume);
    }
  }, [deviceStatus?.volume]);

  const getBadgeColor = () => {
    if (isConnected) return '#3b82f6'; // blue for BLE connected
    if (isConnecting) return '#f59e0b'; // yellow
    return '#6b7280'; // gray
  };

  const getLabel = () => {
    if (isConnected) return 'Mote';
    if (isConnecting) return 'Connecting...';
    return 'Mote';
  };

  const handleVolumeChange = useCallback(async (newVolume: number) => {
    setLocalVolume(newVolume);
    try {
      await sendVolume(newVolume);
    } catch (error) {
      console.error('[HeaderStatusBar] Failed to send volume:', error);
    }
  }, [sendVolume]);

  // If not connected, just show status badge without popover
  if (!isConnected) {
    return (
      <View
        className="flex-row items-center gap-1.5 rounded-full px-2.5 py-1"
        style={{ backgroundColor: isDark ? '#2a2a2a' : '#f3f4f6' }}
      >
        <BluetoothSlash size={12} color="#6b7280" weight="bold" />
        <Text className="text-xs font-medium" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
          {getLabel()}
        </Text>
      </View>
    );
  }

  // When connected, show button that opens volume popover
  return (
    <Popover isOpen={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
      <Popover.Trigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="flex-row items-center gap-1.5 rounded-full px-2.5 py-1"
          style={{ backgroundColor: isDark ? '#1e3a5f' : '#dbeafe', minHeight: 28 }}
        >
          <BluetoothConnected size={12} color={getBadgeColor()} weight="bold" />
          <Text className="text-xs font-medium" style={{ color: getBadgeColor() }}>
            {getLabel()}
          </Text>
        </Button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Overlay />
        <Popover.Content
          placement="bottom"
          align="center"
          offset={8}
          className="rounded-xl"
          style={{
            backgroundColor: isDark ? '#2a2a2a' : '#ffffff',
            borderWidth: 1,
            borderColor: isDark ? '#3a3a3a' : '#e5e7eb',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 12,
            elevation: 8,
          }}
        >
          <Popover.Arrow fill={isDark ? '#2a2a2a' : '#ffffff'} />

          <View className="p-3">
            <Text
              className="mb-2 text-center text-xs font-medium"
              style={{ color: isDark ? '#9ca3af' : '#6b7280' }}
            >
              Speaker Volume
            </Text>
            <VolumeControl volume={localVolume} onVolumeChange={handleVolumeChange} />
          </View>
        </Popover.Content>
      </Popover.Portal>
    </Popover>
  );
}

/**
 * Header Status Bar - combines Gateway and Mote status
 */
export function HeaderStatusBar() {
  return (
    <View className="flex-row items-center gap-2">
      <GatewayStatusBadge />
      <MoteStatusButton />
    </View>
  );
}
