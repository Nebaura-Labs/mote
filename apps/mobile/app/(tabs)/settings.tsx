import { View, Text, ScrollView, TouchableOpacity } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { ChevronRight, User, Bell, Shield, Info } from 'lucide-react-native'

export default function SettingsScreen() {
  return (
    <View className="flex-1 bg-white">
      <StatusBar style="light" />
      <ScrollView className="flex-1 p-6">
        <Text className="text-2xl font-bold text-gray-900 mb-6">
          Settings
        </Text>

        <View className="bg-white border border-gray-200 rounded-lg mb-4">
          <SettingsItem
            icon={<User color="#6b7280" size={20} />}
            title="Account"
            subtitle="Manage your profile"
          />
          <SettingsItem
            icon={<Bell color="#6b7280" size={20} />}
            title="Notifications"
            subtitle="Configure alerts"
          />
          <SettingsItem
            icon={<Shield color="#6b7280" size={20} />}
            title="Privacy & Security"
            subtitle="Manage your data"
          />
          <SettingsItem
            icon={<Info color="#6b7280" size={20} />}
            title="About"
            subtitle="Version 1.0.0"
            isLast
          />
        </View>

        <TouchableOpacity
          className="bg-red-50 border border-red-200 rounded-lg p-4 items-center"
          activeOpacity={0.7}
        >
          <Text className="text-red-600 font-semibold">Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  )
}

interface SettingsItemProps {
  icon: React.ReactNode
  title: string
  subtitle: string
  isLast?: boolean
}

function SettingsItem({ icon, title, subtitle, isLast }: SettingsItemProps) {
  return (
    <TouchableOpacity
      className={`flex-row items-center p-4 ${!isLast ? 'border-b border-gray-200' : ''}`}
      activeOpacity={0.7}
    >
      <View className="mr-3">{icon}</View>
      <View className="flex-1">
        <Text className="text-base font-medium text-gray-900">{title}</Text>
        <Text className="text-sm text-gray-500">{subtitle}</Text>
      </View>
      <ChevronRight color="#9ca3af" size={20} />
    </TouchableOpacity>
  )
}
