import { useMusic } from '@/context/music-context';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Props = {
  uri: string;
  title?: string;
  isMine: boolean;
};

/**
 * نمایش یک فایل صوتی در پیام چت.
 * با useMusic جهانی sync می‌شه — اگه همین آهنگ پخش بشه دکمه pause نشون میده.
 */
export default function AudioMessage({ uri, title, isMine }: Props) {
  const { currentTrack, isPlaying, position, duration, togglePlayPause, playFromUri, seekTo } =
    useMusic();

  const isThisTrack = currentTrack?.uri === uri;

  const handlePress = async () => {
    if (isThisTrack) {
      await togglePlayPause();
    } else {
      await playFromUri(uri, title);
    }
  };

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, '0')}`;
  };

  const pos = isThisTrack ? position : 0;
  const dur = isThisTrack ? duration : 0;

  return (
    <View style={[styles.container, isMine ? styles.containerMine : styles.containerOther]}>
      <TouchableOpacity
        onPress={handlePress}
        style={[styles.playBtn, isMine ? styles.playBtnMine : styles.playBtnOther]}
      >
        <Ionicons
          name={isThisTrack && isPlaying ? 'pause' : 'play'}
          size={20}
          color="#fff"
        />
      </TouchableOpacity>

      <View style={styles.info}>
        <Text
          style={[styles.title, isMine ? styles.titleMine : styles.titleOther]}
          numberOfLines={1}
        >
          {title ?? 'فایل صوتی'}
        </Text>

        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={dur || 1}
          value={pos}
          onSlidingComplete={isThisTrack ? seekTo : undefined}
          minimumTrackTintColor={isMine ? 'rgba(255,255,255,0.8)' : '#7c6af7'}
          maximumTrackTintColor="rgba(255,255,255,0.2)"
          thumbTintColor={isMine ? '#fff' : '#7c6af7'}
          disabled={!isThisTrack}
        />

        <Text style={[styles.time, isMine ? styles.timeMine : styles.timeOther]}>
          {isThisTrack ? `${formatTime(pos)} / ${formatTime(dur)}` : '—'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 10,
    gap: 10,
    minWidth: 200,
    maxWidth: 260,
  },
  containerMine: {
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  containerOther: {
    backgroundColor: 'rgba(124,106,247,0.08)',
  },
  playBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playBtnMine: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  playBtnOther: {
    backgroundColor: '#7c6af7',
  },
  info: {
    flex: 1,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
  },
  titleMine: {
    color: '#fff',
  },
  titleOther: {
    color: '#ccc',
  },
  slider: {
    height: 24,
    marginVertical: 2,
  },
  time: {
    fontSize: 10,
  },
  timeMine: {
    color: 'rgba(255,255,255,0.6)',
  },
  timeOther: {
    color: '#555',
  },
});
