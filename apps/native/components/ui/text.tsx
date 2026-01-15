import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import React from "react";
import { Text as RNText, type TextProps as RNTextProps } from "react-native";

const textVariants = cva("text-gray-900", {
  variants: {
    variant: {
      h1: "text-4xl font-bold tracking-tight",
      h2: "text-3xl font-bold tracking-tight",
      h3: "text-2xl font-semibold tracking-tight",
      h4: "text-xl font-semibold tracking-tight",
      p: "text-base leading-7",
      blockquote: "text-base italic border-l-2 border-gray-300 pl-4",
      code: "text-sm font-mono bg-gray-100 px-1 py-0.5 rounded",
      lead: "text-lg text-gray-600",
      large: "text-lg font-semibold",
      small: "text-sm font-medium",
      muted: "text-sm text-gray-500",
    },
  },
  defaultVariants: {
    variant: "p",
  },
});

export interface TextProps extends RNTextProps, VariantProps<typeof textVariants> {}

export function Text({ variant, className, ...props }: TextProps) {
  return <RNText className={cn(textVariants({ variant }), className)} {...props} />;
}
