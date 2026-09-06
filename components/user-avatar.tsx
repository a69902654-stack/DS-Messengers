import { C } from '../constants/theme';
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

const AVATAR_COLORS = ['#5865f2', '#e05d5d', '#22c55e', '#f59e0b', '#06b6d4'];

type Props = {
  name?: string | null;
  username?: string | null;
  avatarColor?: number | null;
  avatarUrl?: string | null;
  size?: number;
  showOnline?: boolean;
  isOnline?: boolean;
};

export default function UserAvatar({ name, username, avatarColor, avatarUrl, size = 40, showOnline, isOnline }: Props) {
  const color = AVATAR_COLORS[(avatarColor ?? 0) % AVATAR_COLORS.length];
  const letter = (name ?? username ?? '?')[0]?.toUpperCase();

  return (
    <View style={{ width: size, height: size }}>
      {avatarUrl ? (
        <Image
          source={{ uri: avatarUrl }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          cachePolicy="memory-disk"
        />
      ) : (
        <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}>
          <Text style={[styles.letter, { fontSize: size * 0.38 }]}>{letter}</Text>
        </View>
      )}
      {showOnline && isOnline && (
        <View style={[styles.onlineDot, { width: size * 0.25, height: size * 0.25, borderRadius: size * 0.125, bottom: 0, right: 0 }]} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  letter: { color: '#fff', fontWeight: '700' },
  onlineDot: {
    position: 'absolute',
    backgroundColor: C.green,
    borderWidth: 2,
    borderColor: C.bg,
  },
});
