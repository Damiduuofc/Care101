import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  ImageSourcePropType,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { useRouter, Redirect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/auth';

const { width, height } = Dimensions.get('window');

// Phone mockup sized from screen height so it fits every device
const SCREEN_H = Math.min(height * 0.5, 470);
const SCREEN_W = SCREEN_H * (402 / 874);
const BEZEL = 7;

type IconName = keyof typeof Ionicons.glyphMap;

type Slide = {
  id: string;
  tag: string;
  title: string;
  highlight: string;
  screenshot: ImageSourcePropType;
  callouts: [{ icon: IconName; label: string }, { icon: IconName; label: string }];
};

const slides: Slide[] = [
  {
    id: 'doctor',
    tag: 'For Doctors',
    title: 'Your whole day,',
    highlight: 'in one view.',
    screenshot: require('../assets/onboarding/doctor.png'),
    callouts: [
      { icon: 'people', label: 'Live patient queue' },
      { icon: 'time', label: 'Hourly scheduling' },
    ],
  },
  {
    id: 'patient',
    tag: 'For Patients',
    title: 'Book, track & pay',
    highlight: 'in seconds.',
    screenshot: require('../assets/onboarding/patient.png'),
    callouts: [
      { icon: 'calendar', label: 'Easy booking' },
      { icon: 'card', label: 'Pay bills in-app' },
    ],
  },
  {
    id: 'records',
    tag: 'Doctors & Patients',
    title: 'Records that',
    highlight: 'follow the patient.',
    screenshot: require('../assets/onboarding/records.png'),
    callouts: [
      { icon: 'flask', label: 'Lab results' },
      { icon: 'document-text', label: 'Full history' },
    ],
  },
];

function PhoneMockup({ source }: { source: ImageSourcePropType }) {
  return (
    <View style={styles.phone}>
      <View style={styles.screen}>
        <Image source={source} style={styles.screenshot} resizeMode="cover" />
        <View style={styles.island} />
      </View>
    </View>
  );
}

export default function OnboardingScreen() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList<Slide>>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const router = useRouter();
  const { user, token, isLoading } = useAuth();

  // Track the visible slide from the live scroll position, so swipes in
  // either direction and button taps always agree on where we are
  useEffect(() => {
    const id = scrollX.addListener(({ value }) => {
      const next = Math.min(slides.length - 1, Math.max(0, Math.round(value / width)));
      setCurrentIndex((prev) => (prev === next ? prev : next));
    });
    return () => scrollX.removeListener(id);
  }, [scrollX]);

  if (isLoading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#06b6d4" />
      </View>
    );
  }

  // Already signed in: skip onboarding
  if (user && token) {
    return <Redirect href={user.role === 'patient' ? ('/patient-dashboard' as any) : '/dashboard'} />;
  }

  const isLast = currentIndex === slides.length - 1;

  const goToLogin = () => router.replace('/login');

  const handleNext = () => {
    if (isLast) return goToLogin();
    flatListRef.current?.scrollToOffset({ offset: (currentIndex + 1) * width, animated: true });
  };

  const renderItem = ({ item, index }: { item: Slide; index: number }) => {
    const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
    const phoneShift = scrollX.interpolate({ inputRange, outputRange: [60, 0, -60], extrapolate: 'clamp' });
    const phoneScale = scrollX.interpolate({ inputRange, outputRange: [0.88, 1, 0.88], extrapolate: 'clamp' });
    const textOpacity = scrollX.interpolate({ inputRange, outputRange: [0, 1, 0], extrapolate: 'clamp' });
    // Callouts drift faster than the phone for a subtle parallax
    const calloutShift = scrollX.interpolate({ inputRange, outputRange: [120, 0, -120], extrapolate: 'clamp' });

    return (
      <View style={styles.slide}>
        <Animated.View style={[styles.copy, { opacity: textOpacity }]}>
          <Text style={styles.tag}>{item.tag}</Text>
          <Text style={styles.title}>
            {item.title}
            {'\n'}
            <Text style={styles.titleHighlight}>{item.highlight}</Text>
          </Text>
        </Animated.View>

        <View style={styles.stage}>
          <View style={styles.halo} />
          <Animated.View style={{ transform: [{ translateX: phoneShift }, { scale: phoneScale }] }}>
            <PhoneMockup source={item.screenshot} />
          </Animated.View>

          <Animated.View style={[styles.callout, styles.calloutLeft, { transform: [{ translateX: calloutShift }] }]}>
            <View style={styles.calloutIcon}>
              <Ionicons name={item.callouts[0].icon} size={14} color="#fff" />
            </View>
            <Text style={styles.calloutText}>{item.callouts[0].label}</Text>
          </Animated.View>
          <Animated.View style={[styles.callout, styles.calloutRight, { transform: [{ translateX: calloutShift }] }]}>
            <View style={styles.calloutIcon}>
              <Ionicons name={item.callouts[1].icon} size={14} color="#fff" />
            </View>
            <Text style={styles.calloutText}>{item.callouts[1].label}</Text>
          </Animated.View>
        </View>
      </View>
    );
  };

  return (
    <LinearGradient colors={['#0f172a', '#0e3a4a']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.container}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <Text style={styles.brand}>
            Care<Text style={{ color: '#22d3ee' }}>101</Text>
          </Text>
          {!isLast && (
            <TouchableOpacity onPress={goToLogin} hitSlop={12}>
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
          )}
        </View>

        <Animated.FlatList
          ref={flatListRef}
          data={slides}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          horizontal
          pagingEnabled
          bounces={false}
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
            useNativeDriver: false, // dot width can't animate natively
          })}
          getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
          style={{ flex: 1 }}
        />

        <View style={styles.footer}>
          <View style={styles.dots}>
            {slides.map((s, i) => {
              const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
              const dotWidth = scrollX.interpolate({ inputRange, outputRange: [8, 26, 8], extrapolate: 'clamp' });
              const dotOpacity = scrollX.interpolate({ inputRange, outputRange: [0.3, 1, 0.3], extrapolate: 'clamp' });
              return <Animated.View key={s.id} style={[styles.dot, { width: dotWidth, opacity: dotOpacity }]} />;
            })}
          </View>

          <TouchableOpacity activeOpacity={0.85} onPress={handleNext}>
            <LinearGradient
              colors={['#06b6d4', '#0891b2']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.cta, isLast && styles.ctaWide]}
            >
              {isLast && <Text style={styles.ctaText}>Get Started</Text>}
              <Ionicons name="arrow-forward" size={isLast ? 20 : 24} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  center: { justifyContent: 'center', alignItems: 'center' },

  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    height: 48,
  },
  brand: { color: '#fff', fontSize: 20, fontWeight: '800', letterSpacing: 0.3 },
  skipText: { color: '#94a3b8', fontSize: 15, fontWeight: '600' },

  slide: { width, flex: 1 },
  copy: { paddingHorizontal: 28, marginTop: 12 },
  tag: { color: '#22d3ee', fontSize: 13, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },
  title: { color: '#fff', fontSize: 30, fontWeight: '800', lineHeight: 36, marginTop: 8, letterSpacing: -0.5 },
  titleHighlight: { color: '#22d3ee' },

  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  halo: {
    position: 'absolute',
    width: SCREEN_W * 1.9,
    height: SCREEN_W * 1.9,
    borderRadius: SCREEN_W,
    backgroundColor: '#06b6d4',
    opacity: 0.14,
  },

  phone: {
    padding: BEZEL,
    borderRadius: 44,
    backgroundColor: '#020617',
    borderWidth: 1.5,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 20,
  },
  screen: { width: SCREEN_W, height: SCREEN_H, borderRadius: 37, overflow: 'hidden', backgroundColor: '#f8fafc' },
  screenshot: { width: '100%', height: '100%' },
  island: {
    position: 'absolute',
    top: 9,
    alignSelf: 'center',
    width: SCREEN_W * 0.3,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#020617',
  },

  callout: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 6,
    paddingRight: 14,
    paddingVertical: 6,
    borderRadius: 22,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 10,
  },
  calloutLeft: { top: '22%', left: width / 2 - SCREEN_W / 2 - 44 },
  calloutRight: { bottom: '18%', right: width / 2 - SCREEN_W / 2 - 44 },
  calloutIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#06b6d4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calloutText: { color: '#0f172a', fontSize: 13, fontWeight: '700' },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    paddingTop: 8,
    paddingBottom: 12,
  },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { height: 8, borderRadius: 4, backgroundColor: '#22d3ee' },
  cta: {
    height: 60,
    minWidth: 60,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#06b6d4',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 8,
  },
  ctaWide: { paddingHorizontal: 28 },
  ctaText: { color: '#fff', fontSize: 17, fontWeight: '700', letterSpacing: 0.3 },
});
