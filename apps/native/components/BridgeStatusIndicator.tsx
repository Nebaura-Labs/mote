/**
 * Bridge Status Indicator
 *
 * Displays current connection status to clawd.bot Gateway.
 * Shows connection state with color-coded indicator and status text.
 */

import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useBridge } from '@/contexts/BridgeContext';
import {
  getStatusMessage,
  isConnectedStatus,
  isConnectingStatus,
} from '@/contexts/BridgeContext';
import type { ConnectionStatus } from '@/lib/bridge-connection-manager';

export interface BridgeStatusIndicatorProps {
  /** Show detailed status message */
  showMessage?: boolean;
  /** Enable tap to reconnect when disconnected */
  enableTapToReconnect?: boolean;
  /** Custom className for styling */
  className?: string;
}

export function BridgeStatusIndicator({
  showMessage = true,
  enableTapToReconnect = true,
  className,
}: BridgeStatusIndicatorProps) {
  const { status, connect } = useBridge();

  const handleTap = () => {
    if (enableTapToReconnect && status === 'disconnected') {
      connect();
    }
  };

  const canTap = enableTapToReconnect && status === 'disconnected';

  return (
    <TouchableOpacity
      onPress={handleTap}
      disabled={!canTap}
      activeOpacity={canTap ? 0.7 : 1}
      className={className}
    >
      <View className="flex-row items-center gap-2">
        {/* Status Indicator */}
        <StatusDot status={status} />

        {/* Status Message */}
        {showMessage && (
          <Text className="text-sm text-foreground-secondary">
            {getStatusMessage(status)}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

/**
 * Status Dot Component
 */
function StatusDot({ status }: { status: ConnectionStatus }) {
  // Connected or Paired - Green
  if (isConnectedStatus(status)) {
    return (
      <View className="h-3 w-3 rounded-full bg-success" />
    );
  }

  // Connecting or Reconnecting - Yellow with spinner
  if (isConnectingStatus(status)) {
    return (
      <View className="relative h-3 w-3">
        <View className="absolute inset-0 rounded-full bg-warning" />
        <ActivityIndicator size="small" color="#ffffff" className="absolute inset-0" />
      </View>
    );
  }

  // Error - Red
  if (status === 'error') {
    return (
      <View className="h-3 w-3 rounded-full bg-danger" />
    );
  }

  // Disconnected - Gray
  return (
    <View className="h-3 w-3 rounded-full bg-default-300" />
  );
}

/**
 * Compact Status Badge (for headers, etc.)
 */
export function BridgeStatusBadge() {
  const { status } = useBridge();

  const getBadgeColor = () => {
    if (isConnectedStatus(status)) return '#10b981'; // green
    if (isConnectingStatus(status)) return '#f59e0b'; // yellow
    if (status === 'error') return '#ef4444'; // red
    return '#d1d5db'; // gray
  };

  return (
    <View className="flex-row items-center gap-2 rounded-full bg-gray-100 px-3 py-1.5">
      <View className="h-2 w-2 rounded-full" style={{ backgroundColor: getBadgeColor() }} />
      <Text className="text-xs font-medium" style={{ color: '#111827' }}>
        {getStatusMessage(status)}
      </Text>
    </View>
  );
}

/**
 * Detailed Status Card (for settings or debug screens)
 */
export function BridgeStatusCard() {
  const { status, error, connect, disconnect } = useBridge();

  return (
    <View className="rounded-xl bg-white border border-gray-200 p-4">
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="text-base font-semibold" style={{ color: '#111827' }}>
          Gateway Connection
        </Text>
        <BridgeStatusBadge />
      </View>

      {/* Error Message */}
      {error && (
        <View className="mb-3 rounded-md bg-red-50 p-3">
          <Text className="text-sm font-medium" style={{ color: '#ef4444' }}>
            {error.code}
          </Text>
          <Text className="mt-1 text-xs" style={{ color: '#f87171' }}>
            {error.message}
          </Text>
        </View>
      )}

      {/* Action Buttons */}
      <View className="flex-row gap-2">
        {status === 'disconnected' && (
          <TouchableOpacity
            onPress={connect}
            className="flex-1 rounded-lg px-4 py-2"
            style={{ backgroundColor: '#3b82f6' }}
          >
            <Text className="text-center text-sm font-medium" style={{ color: '#ffffff' }}>
              Connect
            </Text>
          </TouchableOpacity>
        )}

        {(isConnectedStatus(status) || isConnectingStatus(status)) && (
          <TouchableOpacity
            onPress={disconnect}
            className="flex-1 rounded-lg px-4 py-2"
            style={{ backgroundColor: '#ef4444' }}
          >
            <Text className="text-center text-sm font-medium" style={{ color: '#ffffff' }}>
              Disconnect
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
