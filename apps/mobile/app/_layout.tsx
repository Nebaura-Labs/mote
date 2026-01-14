import { Stack } from 'expo-router'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '../global.css'

const queryClient = new QueryClient()

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <Stack
          screenOptions={{
            headerStyle: {
              backgroundColor: '#0ea5e9',
            },
            headerTintColor: '#fff',
            headerTitleStyle: {
              fontWeight: 'bold',
            },
          }}
        >
          <Stack.Screen
            name="(tabs)"
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="(auth)"
            options={{
              headerShown: false,
            }}
          />
        </Stack>
      </QueryClientProvider>
    </SafeAreaProvider>
  )
}
