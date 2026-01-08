import React, { useState, useRef } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Dimensions, 
  Image, 
  FlatList,
  NativeSyntheticEvent,
  NativeScrollEvent
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');

// --- ASSETS CONFIGURATION ---
const ADS = [
    {
        id: '1', // Changed to string for FlatList keyExtractor
        image: require('../../assets/ads1.jpg'),
    },
    {
        id: '2',
        image: require('../../assets/ads2.jpg'),
    },
    {
        id: '3',
        image: require('../../assets/ads3.jpg'),
    }
];

export default function AdScreen() {
    const router = useRouter();
    const [activeIndex, setActiveIndex] = useState(0);
    
    // Logic to handle "Skip" OR "Get Started" (Both go to login)
    const handleFinish = () => {
        router.replace('/login');
    };

    // Calculate current slide index based on scroll position
    const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const scrollPosition = event.nativeEvent.contentOffset.x;
        const index = Math.round(scrollPosition / width);
        setActiveIndex(index);
    };

    const renderItem = ({ item }: { item: typeof ADS[0] }) => (
        <View style={styles.slide}>
            <Image
                source={item.image}
                style={styles.adImage}
                resizeMode="cover"
            />
        </View>
    );

    return (
        <View style={styles.container}>
            {/* 1. The Swipable List */}
            <FlatList
                data={ADS}
                renderItem={renderItem}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={handleScroll}
                scrollEventThrottle={16}
                keyExtractor={(item) => item.id}
                bounces={false}
            />

            {/* 2. Overlay Controls (Top Bar & Bottom Button) */}
            <SafeAreaView style={styles.overlayContainer} pointerEvents="box-none">
                
                {/* TOP BAR: Shows on all slides except the last one */}
                {activeIndex < ADS.length - 1 && (
                    <View style={styles.topBar}>
                        <View style={styles.timerBadge}>
                            <Text style={styles.timerText}>
                                Ad {activeIndex + 1} of {ADS.length}
                            </Text>
                        </View>

                        <TouchableOpacity
                            onPress={handleFinish}
                            style={styles.skipButton}
                        >
                            <Text style={styles.skipText}>Skip &gt;&gt;</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* BOTTOM BUTTON: Only shows on the last slide */}
                {activeIndex === ADS.length - 1 && (
                    <View style={styles.bottomContainer}>
                        <TouchableOpacity style={styles.getStartedButton} onPress={handleFinish}>
                            <Text style={styles.getStartedText}>Get Started</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'black',
    },
    slide: {
        width: width,
        height: height,
    },
    adImage: {
        width: width,
        height: height,
    },
    // Overlay Container ensures buttons sit on top of the images
    overlayContainer: {
        ...StyleSheet.absoluteFillObject, // Fill the screen
        justifyContent: 'space-between', // Space out top and bottom elements
    },
    topBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 10, 
    },
    timerBadge: {
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    timerText: {
        color: 'white',
        fontSize: 12,
        fontWeight: '600',
    },
    skipButton: {
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    skipText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 14,
    },
    bottomContainer: {
        position: 'absolute',
        bottom: 50,
        left: 0,
        right: 0,
        alignItems: 'center',
    },
    getStartedButton: {
        backgroundColor: '#06b6d4', // Emerald 600
        paddingHorizontal: 40,
        paddingVertical: 16,
        borderRadius: 30,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.30,
        shadowRadius: 4.65,
        elevation: 8,
    },
    getStartedText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    }
});