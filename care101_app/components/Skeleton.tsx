import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

type Props = {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

// Placeholder block with a sweeping shimmer, shown while content loads
export default function Skeleton({ width, height = 14, radius = 8, style }: Props) {
  const progress = useRef(new Animated.Value(0)).current;
  const [boxWidth, setBoxWidth] = useState(0);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: 1300,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [progress]);

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-boxWidth, boxWidth],
  });

  return (
    <View
      onLayout={(e) => setBoxWidth(e.nativeEvent.layout.width)}
      style={[styles.base, { width, height, borderRadius: radius }, style]}
    >
      {boxWidth > 0 && (
        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX }] }]}>
          <LinearGradient
            colors={['transparent', 'rgba(255,255,255,0.6)', 'transparent']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: '#e2e8f0',
    overflow: 'hidden',
  },
});

// ---- Ready-made layouts so every screen loads the same way ----

/** Stack of list cards (icon + two text lines) */
export function SkeletonList({ rows = 5, style }: { rows?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ gap: 12, padding: 20 }, style]}>
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={presetStyles.card}>
          <Skeleton width={44} height={44} radius={12} />
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton width="65%" height={14} />
            <Skeleton width="40%" height={11} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Horizontal row of chips/cards, e.g. a doctor picker */
export function SkeletonRow({ items = 3, itemWidth = 140, height = 90, style }: { items?: number; itemWidth?: number; height?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ flexDirection: 'row', gap: 12, overflow: 'hidden' }, style]}>
      {Array.from({ length: items }).map((_, i) => (
        <Skeleton key={i} width={itemWidth} height={height} radius={14} />
      ))}
    </View>
  );
}

/** Grid of small blocks, e.g. time slots or dates */
export function SkeletonGrid({ items = 8, columns = 4, height = 40, style }: { items?: number; columns?: number; height?: number; style?: StyleProp<ViewStyle> }) {
  const pct = `${Math.floor(100 / columns) - 3}%` as `${number}%`;
  return (
    <View style={[{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, style]}>
      {Array.from({ length: items }).map((_, i) => (
        <Skeleton key={i} width={pct} height={height} radius={10} />
      ))}
    </View>
  );
}

/** Whole screen: header bar, a hero block and a list. `variant="detail"` shows a profile/detail layout */
export function SkeletonScreen({ variant = 'list' }: { variant?: 'list' | 'detail' }) {
  return (
    <View style={presetStyles.screen}>
      <View style={presetStyles.header}>
        <Skeleton width={40} height={40} radius={20} />
        <View style={{ flex: 1, gap: 6 }}>
          <Skeleton width="50%" height={16} />
          <Skeleton width="30%" height={11} />
        </View>
      </View>
      {variant === 'detail' ? (
        <View style={{ padding: 20, gap: 16 }}>
          <View style={{ alignItems: 'center', gap: 10 }}>
            <Skeleton width={96} height={96} radius={48} />
            <Skeleton width={160} height={18} />
            <Skeleton width={110} height={12} />
          </View>
          {Array.from({ length: 4 }).map((_, i) => (
            <View key={i} style={[presetStyles.card, { flexDirection: 'column', alignItems: 'stretch' }]}>
              <Skeleton width="35%" height={12} />
              <Skeleton height={14} />
              <Skeleton width="80%" height={14} />
            </View>
          ))}
        </View>
      ) : (
        <>
          <Skeleton height={140} radius={16} style={{ margin: 20, marginBottom: 0 }} />
          <SkeletonList rows={5} />
        </>
      )}
    </View>
  );
}

const presetStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc', paddingTop: 50 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', backgroundColor: '#fff' },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#f1f5f9' },
});
