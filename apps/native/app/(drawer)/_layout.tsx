import { Drawer } from "expo-router/drawer";
import React, { useCallback, useEffect } from "react";
import { Text, View, useColorScheme } from "react-native";
import { Chat, GitFork, List, Gear, WifiHigh } from "phosphor-react-native";
import { LoadingScreen } from "@/components/loading-screen";
import { HeaderStatusBar } from "@/components/HeaderStatusBar";
import { useAuth } from "@/contexts/auth-context";
import { useBridge } from "@/contexts/BridgeContext";
import { useRouter, useRootNavigationState } from "expo-router";

function DrawerLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { isAuthenticated, isLoading } = useAuth();
  const { isConfigured } = useBridge();
  const router = useRouter();
  const navigationState = useRootNavigationState();

  // Redirect to auth if not authenticated
  useEffect(() => {
    if (!navigationState?.key || isLoading) return;

    if (!isAuthenticated) {
      router.replace("/(auth)");
    }
  }, [isAuthenticated, isLoading, router, navigationState?.key]);

  const renderHeaderRight = useCallback(() => (
    <View style={{ marginRight: 16 }}>
      <HeaderStatusBar />
    </View>
  ), []);

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <Drawer
      screenOptions={{
        headerTintColor: isDark ? '#e5e5e5' : '#111827',
        headerStyle: {
          backgroundColor: isDark ? '#1a1a1a' : '#ffffff',
          borderBottomWidth: 2,
          borderBottomColor: '#007AFF',
        },
        headerTitleStyle: {
          fontWeight: "600",
          color: isDark ? '#e5e5e5' : '#111827',
          fontSize: 20,
        },
        headerTitleAlign: 'left',
        headerRight: renderHeaderRight,
        drawerStyle: { backgroundColor: isDark ? '#1a1a1a' : '#f0efea' },
        drawerActiveTintColor: '#007AFF',
        drawerInactiveTintColor: isDark ? '#9CA3AF' : '#6B7280',
        drawerLabelStyle: {
          marginLeft: -16,
        },
        drawerIcon: ({ color, size }) => (
          <List size={size} color={color} weight="bold" />
        ),
      }}
    >
      <Drawer.Screen
        name="index"
        options={{
          headerTitle: "Chat",
          drawerLabel: ({ color }) => (
            <Text style={{ color }}>Home</Text>
          ),
          drawerIcon: ({ size, color }) => (
            <Chat
              size={size}
              color={color}
              weight="bold"
            />
          ),
        }}
      />
      <Drawer.Screen
        name="connection"
        options={{
          headerTitle: "Connection",
          drawerLabel: ({ color }) => (
            <Text style={{ color }}>Connection</Text>
          ),
          drawerIcon: ({ size, color }) => (
            <GitFork
              size={size}
              color={color}
              weight="bold"
            />
          ),
        }}
      />
      <Drawer.Screen
        name="hardware"
        options={{
          headerTitle: "Hardware",
          drawerLabel: ({ color }) => (
            <Text style={{ color }}>Hardware</Text>
          ),
          drawerIcon: ({ size, color }) => (
            <WifiHigh
              size={size}
              color={color}
              weight="bold"
            />
          ),
        }}
      />
      <Drawer.Screen
        name="settings"
        options={{
          headerTitle: "Settings",
          drawerLabel: ({ color }) => (
            <Text style={{ color }}>Settings</Text>
          ),
          drawerIcon: ({ size, color }) => (
            <Gear
              size={size}
              color={color}
              weight="bold"
            />
          ),
        }}
      />
    </Drawer>
  );
}

export default DrawerLayout;
