import React from "react";
import { View, type ViewProps, useColorScheme } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface ScreenWrapperProps extends ViewProps {
  children: React.ReactNode;
  useSafeArea?: boolean;
  edges?: ("top" | "bottom" | "left" | "right")[];
}

export function ScreenWrapper({ children, useSafeArea = true, edges = ["bottom"], style, ...props }: ScreenWrapperProps) {
  const Container = useSafeArea ? SafeAreaView : View;
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Container style={[{ flex: 1, backgroundColor: isDark ? "#1a1a1a" : "#f0efea" }, style]} edges={edges as any}>
      {children}
    </Container>
  );
}
