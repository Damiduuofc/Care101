import * as React from 'react';
import { StyleSheet, type TextProps, type TextInputProps } from 'react-native';
import { cssInterop } from 'nativewind';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  Inter_900Black,
} from '@expo-google-fonts/inter';

/**
 * App-wide font.
 *
 * Without an explicit fontFamily, Android falls back to the phone maker's system font
 * (Samsung One UI, Oppo/Realme/OnePlus Sans, user-picked fonts...). React Native measures
 * text with one font and the OEM draws it with another, so bold text gets clipped or
 * wrapped ("Forgot Password?" → "Forgot"). Bundling one font makes measuring and drawing
 * identical on every device.
 */
export const appFonts = {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  Inter_900Black,
};

const FAMILY_BY_WEIGHT: Record<string, keyof typeof appFonts> = {
  '100': 'Inter_400Regular',
  '200': 'Inter_400Regular',
  '300': 'Inter_400Regular',
  '400': 'Inter_400Regular',
  normal: 'Inter_400Regular',
  '500': 'Inter_500Medium',
  '600': 'Inter_600SemiBold',
  '700': 'Inter_700Bold',
  bold: 'Inter_700Bold',
  '800': 'Inter_800ExtraBold',
  '900': 'Inter_900Black',
};

// Respect large system font sizes, but stop them from breaking fixed-size layouts.
const MAX_FONT_SIZE_MULTIPLIER = 1.3;

function withAppFont<P extends TextProps | TextInputProps>(style: P['style']) {
  const flat = StyleSheet.flatten(style) ?? {};
  // Leave explicit font families alone (icon fonts, monospace, etc.).
  if (flat.fontFamily) return style;
  const family = FAMILY_BY_WEIGHT[String(flat.fontWeight ?? '400')] ?? 'Inter_400Regular';
  // Each weight is its own font file, so reset fontWeight to avoid Android faking bold on top.
  return [style, { fontFamily: family, fontWeight: 'normal' as const }];
}

let installed = false;

/** Makes every <Text> and <TextInput> in the app use the bundled font. Call once at startup. */
export function installAppFont() {
  if (installed) return;
  installed = true;

  // Use require() to get react-native's real exports object (an `import * as` copy can't be patched).
  const ReactNative = require('react-native');
  const BaseText = ReactNative.Text;
  const BaseTextInput = ReactNative.TextInput;

  function AppText(props: TextProps & { ref?: React.Ref<any> }) {
    return (
      <BaseText
        maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
        {...props}
        style={withAppFont<TextProps>(props.style)}
      />
    );
  }
  AppText.displayName = 'Text';

  function AppTextInput(props: TextInputProps & { ref?: React.Ref<any> }) {
    return (
      <BaseTextInput
        maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
        {...props}
        style={withAppFont<TextInputProps>(props.style)}
      />
    );
  }
  AppTextInput.displayName = 'TextInput';
  // Keep static helpers like TextInput.State working.
  Object.assign(AppTextInput, BaseTextInput);

  // Resolve NativeWind classNames (e.g. "font-bold") into style before we read fontWeight.
  cssInterop(AppText, { className: 'style' });
  cssInterop(AppTextInput, {
    className: { target: 'style', nativeStyleToProp: { textAlign: true } },
  });

  // react-native's exports are lazy getters, so replacing them here affects every
  // `import { Text } from 'react-native'` that renders after this runs.
  Object.defineProperty(ReactNative, 'Text', { configurable: true, enumerable: true, get: () => AppText });
  Object.defineProperty(ReactNative, 'TextInput', { configurable: true, enumerable: true, get: () => AppTextInput });
}
