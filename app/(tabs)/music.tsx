import { MusicTrack, useMusic } from '../../context/music-context';
import { Ionicons } from '@expo/vector-icons';
import { useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function MusicScreen() {
  const insets = useSafeAreaInsets();
  const {
    filteredTracks,
    currentTrack,
    isPlaying,
    searchQuery,
    permissionGranted,
    loadingTracks,
    setSearchQuery,
    playTrack,
    requestPermission,
  } = useMusic();

  const formatDuration = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, '0')}`;
  };

  const renderTrack = useCallback(
    ({ item }: { item: MusicTrack }) => {
      const active = currentTrack?.id === item.id;
      return (
        <TouchableOpacity
          style={[styles.trackRow, active && styles.trackRowActive]}
          onPress={() => playTrack(item)}
          activeOpacity={0.75}
        >
          <View style={[styles.trackIcon, active && styles.trackIconActive]}>
            <Ionicons
              name={active && isPlaying ? 'pause' : 'musical-note'}
              size={20}
              color={active ? '#fff' : '#7c6af7'}
            />
          </View>
          <View style={styles.trackInfo}>
            <Text style={[styles.trackName, active && styles.trackNameActive]} numberOfLines={1}>
              {item.filename}
            </Text>
            <Text style={styles.trackDuration}>{formatDuration(item.duration)}</Text>
          </View>
          {active && (
            <View style={styles.nowPlaying}>
              <Text style={styles.nowPlayingText}>{isPlaying ? '▶' : '⏸'}</Text>
            </View>
          )}
        </TouchableOpacity>
      );
    },
    [currentTrack, isPlaying, playTrack]
  );

  if (!permissionGranted) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <Ionicons name="musical-notes" size={64} color="#7c6af7" style={{ marginBottom: 20 }} />
        <Text style={styles.permTitle}>دسترسی به موزیک</Text>
        <Text style={styles.permDesc}>
          برای نمایش آهنگ‌های موبایل، به مجوز دسترسی نیاز داریم.
        </Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>اجازه دسترسی</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* هدر */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>موزیک</Text>
        <Text style={styles.headerSub}>{filteredTracks.length} آهنگ</Text>
      </View>

      {/* جست‌وجوی AI */}
      <View style={styles.searchContainer}>
        <Ionicons name="sparkles" size={18} color="#7c6af7" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="جست‌وجوی هوشمند آهنگ..."
          placeholderTextColor="#555"
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color="#555" />
          </TouchableOpacity>
        )}
      </View>

      {loadingTracks ? (
        <ActivityIndicator style={{ flex: 1 }} color="#7c6af7" size="large" />
      ) : filteredTracks.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="search" size={40} color="#333" />
          <Text style={styles.emptyText}>
            {searchQuery ? 'نتیجه‌ای پیدا نشد' : 'آهنگی روی دستگاه پیدا نشد'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredTracks}
          keyExtractor={(item) => item.id}
          renderItem={renderTrack}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 32,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '700',
  },
  headerSub: {
    color: '#555',
    fontSize: 12,
    marginTop: 2,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#13131f',
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: '#1a1a2e',
  },
  searchIcon: {},
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
  },
  list: {
    paddingHorizontal: 12,
    paddingBottom: 180,
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    marginBottom: 4,
    gap: 12,
  },
  trackRowActive: {
    backgroundColor: 'rgba(124, 106, 247, 0.12)',
  },
  trackIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(124, 106, 247, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  trackIconActive: {
    backgroundColor: '#7c6af7',
  },
  trackInfo: {
    flex: 1,
  },
  trackName: {
    color: '#ccc',
    fontSize: 14,
    fontWeight: '500',
  },
  trackNameActive: {
    color: '#fff',
    fontWeight: '700',
  },
  trackDuration: {
    color: '#555',
    fontSize: 11,
    marginTop: 2,
  },
  nowPlaying: {
    paddingHorizontal: 6,
  },
  nowPlayingText: {
    color: '#7c6af7',
    fontSize: 14,
  },
  permTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  permDesc: {
    color: '#555',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  permBtn: {
    backgroundColor: '#7c6af7',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 8,
  },
  permBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyText: {
    color: '#444',
    fontSize: 14,
    textAlign: 'center',
  },
});
