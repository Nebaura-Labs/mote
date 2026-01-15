import { ActivityIndicator, StyleSheet, View } from "react-native";
import { ScreenWrapper } from "./ui/screen-wrapper";

export function LoadingScreen() {
  return (
    <ScreenWrapper>
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#04BDFF" />
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
