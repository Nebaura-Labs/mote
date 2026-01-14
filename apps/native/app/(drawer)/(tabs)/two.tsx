import { Card } from "heroui-native";
import { Text, View } from "react-native";

import { Container } from "@/components/container";

export default function TabTwo() {
  return (
    <Container className="p-6">
      <View className="flex-1 justify-center items-center">
        <Card variant="secondary" className="p-8 items-center">
          <Card.Title className="text-3xl mb-2">TabTwo</Card.Title>
        </Card>
      </View>
    </Container>
  );
}
