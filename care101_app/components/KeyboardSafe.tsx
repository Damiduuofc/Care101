import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleProp, ViewStyle } from 'react-native';

type Props = {
  children: React.ReactNode;
  /** Style of the outer (keyboard-aware) container */
  style?: StyleProp<ViewStyle>;
  /** Wrap the children in a ScrollView so long forms can scroll above the keyboard */
  scroll?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** Inside a <Modal>: Android already resizes modal windows, so only iOS needs padding */
  inModal?: boolean;
  /** Height of any fixed header above this view (iOS) */
  offset?: number;
};

// Keeps text fields visible above the keyboard on every screen and pop-up.
export default function KeyboardSafe({ children, style, scroll = true, contentContainerStyle, inModal = false, offset = 0 }: Props) {
  const behavior = Platform.OS === 'ios' ? 'padding' : inModal ? undefined : 'height';
  return (
    <KeyboardAvoidingView behavior={behavior} keyboardVerticalOffset={offset} style={[{ flex: 1 }, style]}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[{ flexGrow: 1 }, contentContainerStyle]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        children
      )}
    </KeyboardAvoidingView>
  );
}
