import React, { useState, useEffect } from 'react';
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

const ADS = [
    { id: '1', image: require('../../assets/ads1.jpg') },
    { id: '2', image: require('../../assets/ads2.jpg') },
    { id: '3', image: require('../../assets/ads3.jpg') }
];

export default function AdScreen() {
    const router = useRouter();
    const [activeIndex, setActiveIndex] = useState(0);
    
    const handleFinish = () => {
        router.replace('/login');
    };

    // Automatically navigate to login after the 3rd slide
    useEffect(() => {
        if (activeIndex === ADS.length - 1) {
            // Optional: Add a small delay so they see the last ad for a split second
            const timer = setTimeout(() => {
                handleFinish();
            }, 800); 
            return () => clearTimeout(timer);
        }
    }, [activeIndex]);

    const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const scrollPosition = event.nativeEvent.contentOffset.x;
        const index = Math.round(scrollPosition / width);
        setActiveIndex(index);
    };

    const renderItem = ({ item }: { item: typeof ADS[0] }) => (
        <View style={styles.slide}>
            <Image source={item.image} style={styles.adImage} resizeMode="cover" />
        </View>
    );

    return (
        <View style={styles.container}>
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

            <SafeAreaView style={styles.overlayContainer} pointerEvents="box-none">
                {/* Only show skip if it's NOT the last slide */}
                {activeIndex < ADS.length - 1 && (
                    <View style={styles.topBar}>
                        <View /> {/* Empty view to push button to the right */}
                        <TouchableOpacity
                            onPress={handleFinish}
                            activeOpacity={0.7}
                            style={styles.eyeCatchingSkip}
                        >
                            <Text style={styles.skipText}>SKIP</Text>
                            <Text style={styles.arrowText}> ❯❯ </Text>
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
    overlayContainer: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'flex-start', 
    },
    topBar: {
        flexDirection: 'row',
        justifyContent: 'space-between', // Pushes children apart
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 20, 
    },
    eyeCatchingSkip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#06b6d4', // Vibrant Cyan
        paddingHorizontal: 18,
        paddingVertical: 10,
        borderRadius: 25,
        // Glow/Shadow effect
        shadowColor: "#06b6d4",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
        elevation: 10,
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.4)',
    },
    skipText: {
        color: 'white',
        fontWeight: '900',
        fontSize: 14,
        letterSpacing: 1.2,
    },
    arrowText: {
        color: 'white',
        fontSize: 12,
        fontWeight: 'bold',
    }
});