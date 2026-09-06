import { supabase } from '../../config/supabase';
import { User } from '../../types';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const AVATAR_COLORS = ['#7c6af7', '#f76a6a', '#6af7a0', '#f7c46a', '#6ac4f7', '#f7a6c4', '#a6c4f7'];

export default function UserProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showFullImage, setShowFullImage] = useState(false);

  useEffect(() => {
    supabase.from('users').select('*').eq('id', userId).single().then(({ data }) => {
      if (data) setUser(data as User);
      setLoading(false);
    });
  }, [userId]);

  const avatarColor = AVATAR_COLORS[(user?.avatar_color ?? 0) % AVATAR_COLORS.length];
  const avatarLetter = (user?.name ?? user?.username ?? '?')[0]?.toUpperCase();
  const avatarUrl = (user as any)?.avatar_url;

  const formatDate = (date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#7c6af7" size="large" />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>کاربر یافت نشد</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.inner, { paddingBottom: insets.bottom + 20 }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#1a1a2e" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>پروفایل کاربر</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Avatar */}
      <View style={styles.avatarSection}>
        <TouchableOpacity onPress={() => avatarUrl && setShowFullImage(true)} activeOpacity={0.8}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
              <Text style={styles.avatarText}>{avatarLetter}</Text>
            </View>
          )}
          {avatarUrl && (
            <View style={styles.zoomIcon}>
              <Ionicons name="expand" size={14} color="#fff" />
            </View>
          )}
        </TouchableOpacity>

        <Text style={styles.name}>{user.name ?? user.username}</Text>
        {user.username && <Text style={styles.username}>@{user.username}</Text>}
        
        <View style={styles.onlineRow}>
          <View style={[styles.onlineDot, user.is_online && styles.onlineDotActive]} />
          <Text style={[styles.onlineText, user.is_online && styles.onlineTextActive]}>
            {user.is_online ? 'آنلاین' : 'آفلاین'}
          </Text>
        </View>
      </View>

      {/* Info Section */}
      <View style={styles.infoSection}>
        {user.phone_number && (
          <View style={styles.infoRow}>
            <View style={styles.infoIconBg}>
              <Ionicons name="call-outline" size={18} color="#7c6af7" />
            </View>
            <Text style={styles.infoText}>{user.phone_number}</Text>
          </View>
        )}
        
        <View style={styles.infoRow}>
          <View style={styles.infoIconBg}>
            <Ionicons name="calendar-outline" size={18} color="#7c6af7" />
          </View>
          <Text style={styles.infoText}>عضو از {formatDate(user.created_at)}</Text>
        </View>
        
        <View style={styles.infoRow}>
          <View style={styles.infoIconBg}>
            <Ionicons name="key-outline" size={18} color="#7c6af7" />
          </View>
          <Text style={styles.infoId} numberOfLines={2}>{user.id}</Text>
        </View>
      </View>

      {/* Chat Button */}
      <TouchableOpacity
        style={styles.chatBtn}
        onPress={() => router.push({ pathname: '/chat/[userId]', params: { userId: user.id } })}
        activeOpacity={0.8}
      >
        <Ionicons name="chatbubble-outline" size={20} color="#fff" />
        <Text style={styles.chatBtnText}>ارسال پیام</Text>
      </TouchableOpacity>

      {/* Full Image Modal */}
      <Modal visible={showFullImage} transparent animationType="fade">
        <View style={styles.imageModal}>
          <TouchableOpacity style={styles.closeModal} onPress={() => setShowFullImage(false)} activeOpacity={0.8}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          {avatarUrl && (
            <Image source={{ uri: avatarUrl }} style={styles.fullImage} resizeMode="contain" />
          )}
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  inner: {
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0f',
  },
  errorText: {
    color: '#666',
    fontSize: 15,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: '#0f0f1a',
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a2e',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '600',
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 28,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 40,
    fontWeight: '600',
  },
  zoomIcon: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    padding: 4,
  },
  name: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 4,
  },
  username: {
    color: '#7c6af7',
    fontSize: 14,
    marginBottom: 10,
  },
  onlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#444',
  },
  onlineDotActive: {
    backgroundColor: '#3dd68c',
  },
  onlineText: {
    fontSize: 12,
    color: '#666',
  },
  onlineTextActive: {
    color: '#3dd68c',
  },
  infoSection: {
    marginHorizontal: 20,
    backgroundColor: '#0f0f1a',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1a1a2e',
    gap: 14,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoIconBg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoText: {
    color: '#e0e0e0',
    fontSize: 14,
    flex: 1,
  },
  infoId: {
    color: '#666',
    fontSize: 11,
    flex: 1,
  },
  chatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7c6af7',
    borderRadius: 14,
    paddingVertical: 14,
    marginHorizontal: 20,
    marginTop: 24,
    gap: 10,
  },
  chatBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  imageModal: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.97)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeModal: {
    position: 'absolute',
    top: 52,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  fullImage: {
    width: '100%',
    height: '80%',
  },
});