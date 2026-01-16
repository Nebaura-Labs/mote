import { Button } from "@/components/ui/button";
import { ScreenWrapper } from "@/components/ui/screen-wrapper";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/contexts/auth-context";
import * as Haptics from "expo-haptics";
import { TextField } from "heroui-native";
import { Image, Alert, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown, ZoomIn } from "react-native-reanimated";
import { useRef, useState } from "react";
import type { TextInput } from "react-native";

const validateName = (name: string): string | null => {
  if (!name) return "Name is required";
  if (name.length < 2) return "Name must be at least 2 characters";
  return null;
};

const validateEmail = (email: string): string | null => {
  if (!email) return "Email is required";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Invalid email format";
  return null;
};

const validatePassword = (password: string): string | null => {
  if (!password) return "Password is required";
  if (password.length < 8) return "Password must be at least 8 characters";
  return null;
};

export default function OnboardingScreen() {
  const { signIn, signUp } = useAuth();
  const insets = useSafeAreaInsets();
  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (isSignUp) {
      const nameError = validateName(name);
      const emailError = validateEmail(email);
      const passwordError = validatePassword(password);

      if (nameError || emailError || passwordError) {
        setErrors({
          name: nameError || undefined,
          email: emailError || undefined,
          password: passwordError || undefined,
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }

      setErrors({});
      Keyboard.dismiss();
      setIsSubmitting(true);

      try {
        await signUp(name, email, password);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (error) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert("Sign Up Failed", error instanceof Error ? error.message : "An error occurred");
      } finally {
        setIsSubmitting(false);
      }
    } else {
      const emailError = validateEmail(email);
      const passwordError = validatePassword(password);

      if (emailError || passwordError) {
        setErrors({ email: emailError || undefined, password: passwordError || undefined });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }

      setErrors({});
      Keyboard.dismiss();
      setIsSubmitting(true);

      try {
        await signIn(email, password);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (error) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert("Sign In Failed", error instanceof Error ? error.message : "An error occurred");
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    setErrors({});
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <ScreenWrapper>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo Area - Centered */}
          <View style={styles.logoContainer}>
            <Animated.View entering={ZoomIn.duration(600).delay(100)}>
              <Image
                source={require("@/assets/images/mote.png")}
                style={styles.logo}
                resizeMode="contain"
              />
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(300)} style={styles.titleContainer}>
              <Text variant="h1" style={{ color: isDark ? '#e5e5e5' : '#111827' }}>
                Mote
              </Text>
              <Text variant="lead" style={{ color: isDark ? '#9CA3AF' : '#6B7280', marginTop: 8 }}>
                Voice companion for Clawd
              </Text>
            </Animated.View>
          </View>

          {/* Auth Form - Bottom */}
          <Animated.View
            entering={FadeInDown.delay(500)}
            style={[styles.formContainer, { paddingBottom: insets.bottom + 20 }]}
          >
            <View style={styles.formFields}>
              <View style={[styles.nameFieldContainer, !isSignUp && styles.nameFieldHidden]}>
                <TextField isInvalid={!!errors.name} className="mb-4">
                  <TextField.Label className="font-medium mb-1" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>Name</TextField.Label>
                  <TextField.Input
                    placeholder="John Doe"
                    value={name}
                    onChangeText={(text) => {
                      setName(text);
                      if (errors.name) setErrors({ ...errors, name: undefined });
                    }}
                    autoCapitalize="words"
                    autoComplete="name"
                    returnKeyType="next"
                    onSubmitEditing={() => emailInputRef.current?.focus()}
                    editable={!isSubmitting && isSignUp}
                    style={{
                      backgroundColor: isDark ? '#2a2a2a' : '#ffffff',
                      borderColor: isDark ? '#3a3a3a' : '#e5e7eb',
                      borderWidth: 1,
                      borderRadius: 12,
                      paddingHorizontal: 16,
                      height: 56,
                      color: isDark ? '#e5e5e5' : '#111827',
                    }}
                  />
                  {errors.name && <TextField.ErrorMessage className="text-red-600 text-sm mt-1">{errors.name}</TextField.ErrorMessage>}
                </TextField>
              </View>

              <TextField isInvalid={!!errors.email} className="mb-4">
                <TextField.Label className="font-medium mb-1" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>Email</TextField.Label>
                <TextField.Input
                  ref={emailInputRef}
                  placeholder="you@example.com"
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (errors.email) setErrors({ ...errors, email: undefined });
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  returnKeyType="next"
                  onSubmitEditing={() => passwordInputRef.current?.focus()}
                  editable={!isSubmitting}
                  style={{
                    backgroundColor: isDark ? '#2a2a2a' : '#ffffff',
                    borderColor: isDark ? '#3a3a3a' : '#e5e7eb',
                    borderWidth: 1,
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    height: 56,
                    color: isDark ? '#e5e5e5' : '#111827',
                  }}
                />
                {errors.email && <TextField.ErrorMessage className="text-red-600 text-sm mt-1">{errors.email}</TextField.ErrorMessage>}
              </TextField>

              <TextField isInvalid={!!errors.password}>
                <TextField.Label className="font-medium mb-1" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>Password</TextField.Label>
                <TextField.Input
                  ref={passwordInputRef}
                  placeholder={isSignUp ? "Create a password" : "Enter your password"}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (errors.password) setErrors({ ...errors, password: undefined });
                  }}
                  secureTextEntry
                  autoCapitalize="none"
                  autoComplete={isSignUp ? "password-new" : "password"}
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit}
                  editable={!isSubmitting}
                  style={{
                    backgroundColor: isDark ? '#2a2a2a' : '#ffffff',
                    borderColor: isDark ? '#3a3a3a' : '#e5e7eb',
                    borderWidth: 1,
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    height: 56,
                    color: isDark ? '#e5e5e5' : '#111827',
                  }}
                />
                {errors.password && <TextField.ErrorMessage className="text-red-600 text-sm mt-1">{errors.password}</TextField.ErrorMessage>}
              </TextField>
            </View>

            <Button onPress={handleSubmit} disabled={isSubmitting} style={styles.button}>
              {isSubmitting ? (isSignUp ? "Creating Account..." : "Signing In...") : isSignUp ? "Sign Up" : "Sign In"}
            </Button>

            <View style={styles.toggleContainer}>
              <Text variant="small" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>
                {isSignUp ? "Already have an account? " : "Need an account? "}
              </Text>
              <Text variant="small" style={{ color: '#04BDFF', fontWeight: '600' }} onPress={toggleMode}>
                {isSignUp ? "Sign In" : "Sign Up"}
              </Text>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  logoContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 300,
  },
  logo: {
    width: 120,
    height: 120,
  },
  titleContainer: {
    alignItems: "center",
    marginTop: 24,
    width: '100%',
  },
  formContainer: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  formFields: {
    marginBottom: 24,
  },
  button: {
    width: "100%",
  },
  toggleContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 16,
  },
  nameFieldContainer: {
    marginBottom: 0,
  },
  nameFieldHidden: {
    height: 0,
    opacity: 0,
    pointerEvents: "none",
  },
});
