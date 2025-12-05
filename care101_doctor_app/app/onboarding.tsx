import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  FlatList,
  NativeSyntheticEvent,
  NativeScrollEvent,
  ActivityIndicator,
} from 'react-native';
import { useRouter, Redirect } from 'expo-router'; // Import Redirect
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/auth'; // Import your auth hook

const { width, height } = Dimensions.get('window');

const slides = [
  {
    id: '1',
    // Make sure these images exist in your assets folder!
    image: require('../assets/ads1.jpg'), 
    showSkip: true,
  },
  {
    id: '2',
    image: require('../assets/ads2.jpg'),
    showSkip: true,
  },
  {
    id: '3',
    image: require('../assets/ads3.jpg'),
    showSkip: false,
  },
];

export default function OnboardingScreen() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const router = useRouter();
  
  // 1. Get the user status
  const { user, isLoading } = useAuth();

  // 2. If we are still checking if they are logged in, show a spinner
  if (isLoading) {
    return (
      <View style={{flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000'}}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  // 3. LOGIC: If user is ALREADY logged in, skip ads and go to dashboard
  if (user) {
    return <Redirect href="/dashboard" />;
  }

  // 4. If user is NOT logged in, the code below runs (showing the Ads)
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const scrollPosition = event.nativeEvent.contentOffset.x;
    const index = Math.round(scrollPosition / width);
    setCurrentIndex(index);
  };

  const handleSkip = () => {
    router.replace('/login');
  };

  const handleGetStarted = () => {
    router.replace('/login');
  };

  const renderItem = ({ item, index }: { item: typeof slides[0]; index: number }) => (
    <View style={styles.slide}>
      <Image source={item.image} style={styles.image} resizeMode="cover" />
      
      {item.showSkip && (
        <SafeAreaView style={styles.skipContainer} edges={['top']}>
          <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </SafeAreaView>
      )}

      {index === slides.length - 1 && (
        <SafeAreaView style={styles.bottomContainer} edges={['bottom']}>
          <TouchableOpacity style={styles.getStartedButton} onPress={handleGetStarted}>
            <Text style={styles.getStartedText}>Get Started</Text>
          </TouchableOpacity>
        </SafeAreaView>
      )}

      <View style={styles.dotsContainer}>
        {slides.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              currentIndex === i && styles.activeDot,
            ]}
          />
        ))}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={slides}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        keyExtractor={(item) => item.id}
        bounces={false} // Prevents overscrolling effect
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  slide: {
    width: width,
    height: height,
    position: 'relative',
  },
  image: {
    width: width,
    height: height,
  },
  skipContainer: {
    position: 'absolute',
    top: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 10,
    zIndex: 10,
  },
  skipButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
  },
  skipText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 30,
    paddingBottom: 40,
    alignItems: 'center',
  },
  getStartedButton: {
    width: '100%',
    backgroundColor: '#007AFF',
    paddingVertical: 18,
    borderRadius: 30,
    alignItems: 'center',
    shadowColor: '#007AFF',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  getStartedText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  dotsContainer: {
    position: 'absolute',
    bottom: 120, // Moved up slightly to make room for button
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    marginHorizontal: 5,
  },
  activeDot: {
    width: 24,
    backgroundColor: '#fff',
  },
});