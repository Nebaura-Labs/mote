import { LoadingScreen } from "@/components/loading-screen";
import { useAuth } from "@/contexts/auth-context";
import { Stack, useRouter, useRootNavigationState } from "expo-router";
import { useEffect } from "react";

export default function AuthLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const navigationState = useRootNavigationState();

  useEffect(() => {
    if (!navigationState?.key || isLoading) return;

    if (isAuthenticated) {
      router.replace("/(drawer)");
    }
  }, [isAuthenticated, isLoading, router, navigationState?.key]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        gestureEnabled: false,
      }}
    >
      <Stack.Screen name="index" />
    </Stack>
  );
}
