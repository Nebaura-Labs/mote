import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import React from "react";
import { Platform, Pressable, StyleSheet, Text } from "react-native";
import type { PressableProps } from "react-native";

const buttonVariants = cva(
  "flex-row items-center justify-center rounded-2xl transition-colors active:opacity-90",
  {
    variants: {
      variant: {
        default: "",
        destructive: "bg-red-600 active:bg-red-700",
        outline: "border border-gray-300 bg-transparent active:bg-gray-100",
        secondary: "bg-gray-200 active:bg-gray-300",
        ghost: "bg-transparent active:bg-gray-100",
        link: "bg-transparent",
      },
      size: {
        default: "h-12 px-6",
        sm: "h-10 px-4",
        lg: "h-14 px-8",
        icon: "h-12 w-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

const buttonTextVariants = cva("font-semibold text-center", {
  variants: {
    variant: {
      default: "text-white",
      destructive: "text-white",
      outline: "text-gray-900",
      secondary: "text-gray-900",
      ghost: "text-gray-900",
      link: "text-gray-900 underline",
    },
    size: {
      default: "text-base",
      sm: "text-sm",
      lg: "text-lg",
      icon: "text-base",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});

export interface ButtonProps extends PressableProps, VariantProps<typeof buttonVariants> {
  children?: React.ReactNode;
}

export function Button({ children, variant, size, disabled, className, style, ...props }: ButtonProps) {
  const isDefault = variant === "default" || !variant;

  return (
    <Pressable
      disabled={disabled}
      className={cn(buttonVariants({ variant, size }), disabled && "opacity-50", className)}
      style={(state) => [
        isDefault && styles.defaultButton,
        disabled && styles.disabled,
        typeof style === "function" ? style(state) : style,
      ]}
      {...props}
    >
      {typeof children === "string" ? (
        <Text className={cn(buttonTextVariants({ variant, size }))}>{children}</Text>
      ) : (
        children
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  defaultButton: {
    backgroundColor: "#04BDFF",
  },
  disabled: {
    opacity: 0.5,
  },
});
