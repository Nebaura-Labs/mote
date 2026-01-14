import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { Link } from 'expo-router'
import { useState } from 'react'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-white"
    >
      <StatusBar style="dark" />
      <View className="flex-1 justify-center px-6">
        <Text className="text-4xl font-bold text-gray-900 mb-2">
          Welcome back
        </Text>
        <Text className="text-base text-gray-600 mb-8">
          Sign in to continue to Mote
        </Text>

        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 mb-2">
            Email
          </Text>
          <TextInput
            className="bg-gray-50 border border-gray-300 rounded-lg px-4 py-3 text-base"
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
        </View>

        <View className="mb-6">
          <Text className="text-sm font-medium text-gray-700 mb-2">
            Password
          </Text>
          <TextInput
            className="bg-gray-50 border border-gray-300 rounded-lg px-4 py-3 text-base"
            placeholder="Enter your password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
          />
        </View>

        <TouchableOpacity
          className="bg-primary-500 rounded-lg py-4 items-center mb-4"
          activeOpacity={0.8}
        >
          <Text className="text-white font-semibold text-base">
            Sign In
          </Text>
        </TouchableOpacity>

        <View className="flex-row justify-center">
          <Text className="text-sm text-gray-600">
            Don't have an account?{' '}
          </Text>
          <Link href="/(auth)/signup" asChild>
            <TouchableOpacity>
              <Text className="text-sm text-primary-600 font-semibold">
                Sign Up
              </Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}
