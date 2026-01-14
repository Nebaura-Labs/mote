import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { Link } from 'expo-router'
import { useState } from 'react'

export default function SignupScreen() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-white"
    >
      <StatusBar style="dark" />
      <ScrollView className="flex-1" contentContainerClassName="px-6 py-12">
        <Text className="text-4xl font-bold text-gray-900 mb-2">
          Create account
        </Text>
        <Text className="text-base text-gray-600 mb-8">
          Sign up to get started with Mote
        </Text>

        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 mb-2">
            Name
          </Text>
          <TextInput
            className="bg-gray-50 border border-gray-300 rounded-lg px-4 py-3 text-base"
            placeholder="Your name"
            value={name}
            onChangeText={setName}
            autoComplete="name"
          />
        </View>

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

        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 mb-2">
            Password
          </Text>
          <TextInput
            className="bg-gray-50 border border-gray-300 rounded-lg px-4 py-3 text-base"
            placeholder="Create a password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password-new"
          />
        </View>

        <View className="mb-6">
          <Text className="text-sm font-medium text-gray-700 mb-2">
            Confirm Password
          </Text>
          <TextInput
            className="bg-gray-50 border border-gray-300 rounded-lg px-4 py-3 text-base"
            placeholder="Confirm your password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoComplete="password-new"
          />
        </View>

        <TouchableOpacity
          className="bg-primary-500 rounded-lg py-4 items-center mb-4"
          activeOpacity={0.8}
        >
          <Text className="text-white font-semibold text-base">
            Create Account
          </Text>
        </TouchableOpacity>

        <View className="flex-row justify-center">
          <Text className="text-sm text-gray-600">
            Already have an account?{' '}
          </Text>
          <Link href="/(auth)/login" asChild>
            <TouchableOpacity>
              <Text className="text-sm text-primary-600 font-semibold">
                Sign In
              </Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
