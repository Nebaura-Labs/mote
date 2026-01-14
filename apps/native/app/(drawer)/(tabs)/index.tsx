import { Text, View } from "react-native";
import { Container } from "@/components/container";

export default function Home() {
  return (
    <Container className="p-6">
      <View className="flex-1 justify-center items-center">
        <Text className="text-2xl font-bold">Mote</Text>
        <Text className="text-base text-gray-600 mt-2">Voice companion for Clawd</Text>
      </View>
    </Container>
  );
}
