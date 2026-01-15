import { Drawer } from "expo-router/drawer";
import React, { useCallback, useEffect } from "react";
import { Text, View } from "react-native";
import { Chat, GitFork, List } from "phosphor-react-native";
import { LoadingScreen } from "@/components/loading-screen";
import { BridgeStatusBadge } from "@/components/BridgeStatusIndicator";
import { useAuth } from "@/contexts/auth-context";
import { useBridge } from "@/contexts/BridgeContext";
import { useRouter, useRootNavigationState } from "expo-router";

function DrawerLayout() {
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

  // Redirect to Gateway setup if authenticated but not configured
  useEffect(() => {
    if (!navigationState?.key || isLoading) return;

    if (isAuthenticated && !isConfigured) {
      router.replace("/gateway-setup");
    }
  }, [isAuthenticated, isLoading, isConfigured, router, navigationState?.key]);

  const renderHeaderRight = useCallback(() => (
    <View style={{ marginRight: 16 }}>
      <BridgeStatusBadge />
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
        headerTintColor: '#111827',
        headerStyle: { backgroundColor: '#ffffff' },
        headerTitleStyle: {
          fontWeight: "600",
          color: '#111827',
          fontSize: 20,
        },
        headerTitleAlign: 'left',
        headerRight: renderHeaderRight,
        drawerStyle: { backgroundColor: '#f0efea' },
        drawerIcon: ({ color, size }) => (
          <List size={size} color={color} weight="bold" />
        ),
      }}
    >
      <Drawer.Screen
        name="index"
        options={{
          headerTitle: "Chat",
          drawerLabel: ({ color, focused }) => (
            <Text style={{ color: focused ? color : '#111827' }}>Home</Text>
          ),
          drawerIcon: ({ size, color, focused }) => (
            <Chat
              size={size}
              color={focused ? color : '#111827'}
              weight="bold"
            />
          ),
        }}
      />
      <Drawer.Screen
        name="connection"
        options={{
          headerTitle: "Connection",
          drawerLabel: ({ color, focused }) => (
            <Text style={{ color: focused ? color : '#111827' }}>Connection</Text>
          ),
          drawerIcon: ({ size, color, focused }) => (
            <GitFork
              size={size}
              color={focused ? color : '#111827'}
              weight="bold"
            />
          ),
        }}
      />
    </Drawer>
  );
}

export default DrawerLayout;
