import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as SplashScreen from 'expo-splash-screen';

const splashVideo = require('../assets/videos/splash.mp4');

// Safety net: never keep the user on the splash longer than this, even if the video stalls.
const MAX_SPLASH_MS = 5000;

type Props = { onFinish: () => void };

/**
 * Plays the short brand animation on app open.
 * The video starts on white so it continues straight from the native (white) splash,
 * then fades out to reveal the app underneath.
 */
export default function VideoSplash({ onFinish }: Props) {
  const opacity = useRef(new Animated.Value(1)).current;
  const [done, setDone] = useState(false);

  const player = useVideoPlayer(splashVideo, (p) => {
    p.muted = true;
    p.loop = false;
    p.play();
  });

  const finish = () => setDone(true);

  useEffect(() => {
    const endSub = player.addListener('playToEnd', finish);
    const statusSub = player.addListener('statusChange', ({ status }) => {
      if (status === 'error') {
        SplashScreen.hideAsync().catch(() => {});
        finish();
      }
    });
    const timeout = setTimeout(finish, MAX_SPLASH_MS);
    return () => {
      endSub.remove();
      statusSub.remove();
      clearTimeout(timeout);
    };
  }, [player]);

  useEffect(() => {
    if (!done) return;
    SplashScreen.hideAsync().catch(() => {});
    Animated.timing(opacity, { toValue: 0, duration: 350, useNativeDriver: true }).start(onFinish);
  }, [done]);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.container, { opacity }]} pointerEvents="none">
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
        allowsPictureInPicture={false}
        // Swap the native splash for the video only once its first frame is on screen, so there's no flash.
        onFirstFrameRender={() => SplashScreen.hideAsync().catch(() => {})}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#ffffff', zIndex: 999, elevation: 999 },
});
