import { View, Text, ScrollView, TouchableOpacity } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { Plus } from 'lucide-react-native'

export default function DevicesScreen() {
  return (
    <View className="flex-1 bg-white">
      <StatusBar style="light" />
      <ScrollView className="flex-1 p-6">
        <Text className="text-2xl font-bold text-gray-900 mb-4">
          My Devices
        </Text>

        <View className="bg-gray-50 border border-gray-200 rounded-lg p-8 items-center mb-6">
          <Text className="text-base text-gray-600 text-center mb-4">
            No devices connected yet
          </Text>
          <TouchableOpacity
            className="bg-primary-500 rounded-lg px-6 py-3 flex-row items-center"
            activeOpacity={0.7}
          >
            <Plus color="#fff" size={20} />
            <Text className="text-white font-semibold ml-2">
              Pair New Device
            </Text>
          </TouchableOpacity>
        </View>

        <View className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <Text className="text-sm font-semibold text-blue-900 mb-2">
            How to Pair
          </Text>
          <Text className="text-sm text-blue-700">
            1. Turn on your Mote device{'\n'}
            2. Make sure Bluetooth is enabled{'\n'}
            3. Tap "Pair New Device" above{'\n'}
            4. Select your Mote from the list
          </Text>
        </View>
      </ScrollView>
    </View>
  )
}
