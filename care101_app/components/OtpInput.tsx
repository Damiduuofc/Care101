import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { View, Text, TextInput, Platform, StyleSheet, Pressable } from 'react-native';
import { MotiView, MotiText, useAnimationState } from 'moti';

type Props = {
  value: string;
  onChange: (code: string) => void;
  /** Called once all digits are in (typed, pasted or autofilled from the SMS) */
  onComplete?: (code: string) => void;
  length?: number;
  error?: boolean;
  disabled?: boolean;
};

export type OtpInputHandle = { focus: () => void; shake: () => void };

// One real (invisible) TextInput on top of animated boxes. Keeping a single real field is
// what lets iOS offer the SMS code above the keyboard (textContentType="oneTimeCode") and
// Android autofill it (autoComplete="sms-otp").
const OtpInput = forwardRef<OtpInputHandle, Props>(function OtpInput(
  { value, onChange, onComplete, length = 6, error = false, disabled = false },
  ref
) {
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const shakeState = useAnimationState({
    still: { translateX: 0 },
    left: { translateX: -10 },
    right: { translateX: 10 },
  });

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
    shake: () => {
      // quick left-right wobble on a wrong code
      shakeState.transitionTo('left');
      setTimeout(() => shakeState.transitionTo('right'), 70);
      setTimeout(() => shakeState.transitionTo('left'), 140);
      setTimeout(() => shakeState.transitionTo('still'), 210);
    },
  }));

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 350);
    return () => clearTimeout(t);
  }, []);

  const handleChange = (text: string) => {
    // Autofill and paste can bring spaces or a whole sentence: keep only the digits
    const digits = text.replace(/\D/g, '').slice(0, length);
    onChange(digits);
    if (digits.length === length) onComplete?.(digits);
  };

  return (
    <Pressable onPress={() => inputRef.current?.focus()} accessibilityLabel={`Verification code, ${length} digits`}>
      <MotiView state={shakeState} transition={{ type: 'timing', duration: 70 }} style={styles.row}>
        {Array.from({ length }).map((_, i) => {
          const digit = value[i];
          const isActive = focused && !disabled && (i === value.length || (i === length - 1 && value.length === length));
          return (
            <MotiView
              key={i}
              animate={{
                scale: isActive ? 1.06 : 1,
                borderColor: error ? '#ef4444' : isActive ? '#06b6d4' : digit ? '#67e8f9' : '#e2e8f0',
                backgroundColor: error ? '#fef2f2' : digit ? '#ecfeff' : '#f8fafc',
              }}
              transition={{ type: 'timing', duration: 180 }}
              style={styles.box}
            >
              {digit ? (
                // Digit lands: starts large, faint and soft, then settles sharp (blur-in motion)
                <MotiText
                  key={`${i}-${digit}`}
                  from={{ opacity: 0, scale: 1.6, translateY: -6 }}
                  animate={{ opacity: 1, scale: 1, translateY: 0 }}
                  transition={{ type: 'spring', damping: 14, stiffness: 220 }}
                  style={[styles.digit, error && { color: '#dc2626' }]}
                >
                  {digit}
                </MotiText>
              ) : isActive ? (
                <MotiView
                  from={{ opacity: 1 }}
                  animate={{ opacity: 0 }}
                  transition={{ type: 'timing', duration: 550, loop: true }}
                  style={styles.cursor}
                />
              ) : null}
            </MotiView>
          );
        })}
      </MotiView>

      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
        importantForAutofill="yes"
        maxLength={length + 4 /* room for pasted separators before we strip them */}
        editable={!disabled}
        caretHidden
        selectionColor="transparent"
        style={styles.hiddenInput}
        accessibilityLabel="Verification code"
      />
    </Pressable>
  );
});

export default OtpInput;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  box: {
    flex: 1,
    maxWidth: 52,
    height: 58,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digit: { fontSize: 24, fontWeight: '700', color: '#0f172a' },
  cursor: { width: 2, height: 24, borderRadius: 1, backgroundColor: '#06b6d4' },
  // Covers the boxes so taps focus it, but draws nothing itself
  hiddenInput: { ...StyleSheet.absoluteFillObject, color: 'transparent', opacity: 0.02, fontSize: 1 },
});
