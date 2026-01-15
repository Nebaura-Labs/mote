import React from "react";
import { View, type ViewProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface ScreenWrapperProps extends ViewProps {
  children: React.ReactNode;
  useSafeArea?: boolean;
}

export function ScreenWrapper({ children, useSafeArea = true, style, ...props }: ScreenWrapperProps) {
  const Container = useSafeArea ? SafeAreaView : View;

  return (
    <Container style={[{ flex: 1, backgroundColor: "#f0efea" }, style]} edges={["top", "bottom"]}>
      {children}
    </Container>
  );
}
