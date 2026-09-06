import { useMusic } from '../context/music-context';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * مینی پلیر که بالای نویگیشن بار نمایش داده می‌شه وقتی آهنگ در حال پخشه.
 * با position: absolute و محاسبه‌ی دقیق bottom بالای tab bar قرار می‌گیره.
 */
export default function MiniMusicPlayer() {
  const { currentTrack, isPlaying, position, duration, togglePlayPause, playNext, playPrev, seekTo, stopTrack } = useMusic();
  const insets = useSafeAreaInsets();

  if (!currentTrack) return null;

  // tab bar: height=65, bottom=insets.bottom+8 or 20
  const tabBarBottom = insets.bottom > 0 ? insets.bottom + 8 : 20;
  const tabBarHeight = 65;
  const playerBottom = tabBarBottom + tabBarHeight + 8;

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, '0')}`;
  };

  return (
    <View style={[styles.container, { bottom: playerBottom }]}>
      <View style={styles.row}>
        <TouchableOpacity onPress={playPrev} style={styles.btn}>
          <Ionicons name="play-skip-back" size={20} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity onPress={togglePlayPause} style={styles.playBtn}>
          <Ionicons name={isPlaying ? 'pause' : 'play'} size={22} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity onPress={playNext} style={styles.btn}>
          <Ionicons name="play-skip-forward" size={20} color="#fff" />
        </TouchableOpacity>

        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>{currentTrack.filename}</Text>
          <Text style={styles.time}>{formatTime(position)} / {formatTime(duration)}</Text>
        </View>

        <TouchableOpacity onPress={stopTrack} style={styles.closeBtn}>
          <Ionicons name="close" size={18} color="rgba(255,255,255,0.5)" />
        </TouchableOpacity>
      </View>

      <Slider
        style={styles.slider}
        minimumValue={0}
        maximumValue={duration || 1}
        value={position}
        onSlidingComplete={seekTo}
        minimumTrackTintColor="#7c6af7"
        maximumTrackTintColor="rgba(255,255,255,0.15)"
        thumbTintColor="#7c6af7"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 10,
    right: 10,
    backgroundColor: 'rgba(15, 15, 26, 0.97)',
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: 'rgba(124, 106, 247, 0.3)',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    elevation: 20,
    shadowColor: '#7c6af7',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    zIndex: 100,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  btn: {
    padding: 6,
  },
  playBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#7c6af7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: {
    flex: 1,
  },
  title: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  time: {
    color: '#666',
    fontSize: 11,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    marginLeft: 2,
  },
  slider: {
    width: '100%',
    height: 28,
    marginTop: 2,
  },
});
