import { View, Text, ScrollView } from 'react-native'
import { StatusBar } from 'expo-status-bar'

export default function HomeScreen() {
  return (
    <ScrollView className="flex-1 bg-white">
      <StatusBar style="light" />
      <View className="p-6">
        <Text className="text-3xl font-bold text-gray-900 mb-2">
          Welcome to Mote
        </Text>
        <Text className="text-base text-gray-600 mb-6">
          Your voice companion for Clawd
        </Text>

        <View className="bg-primary-50 border border-primary-200 rounded-lg p-4 mb-4">
          <Text className="text-lg font-semibold text-primary-900 mb-2">
            Getting Started
          </Text>
          <Text className="text-sm text-primary-700">
            1. Navigate to the Devices tab{'\n'}
            2. Pair your Mote device via Bluetooth{'\n'}
            3. Connect to Clawd to start voice interactions
          </Text>
        </View>

        <View className="bg-gray-50 rounded-lg p-4">
          <Text className="text-lg font-semibold text-gray-900 mb-2">
            Quick Stats
          </Text>
          <View className="flex-row justify-between mb-3">
            <Text className="text-sm text-gray-600">Connected Devices</Text>
            <Text className="text-sm font-medium text-gray-900">0</Text>
          </View>
          <View className="flex-row justify-between mb-3">
            <Text className="text-sm text-gray-600">Voice Sessions Today</Text>
            <Text className="text-sm font-medium text-gray-900">0</Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-sm text-gray-600">Battery Level</Text>
            <Text className="text-sm font-medium text-gray-900">--</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  )
}
