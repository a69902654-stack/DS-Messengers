import UserAvatar from '@/components/user-avatar';
import { supabase } from '@/config/supabase';
import { useAuth } from '@/context/auth-context';
import { Group, GroupMember } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import * as ExpoFS from 'expo-file-system/legacy';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function GroupSettingsScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const { currentUser } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [myRole, setMyRole] = useState<GroupMember['role'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Edit state
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [allowMessages, setAllowMessages] = useState(true);
  const [allowMedia, setAllowMedia] = useState(true);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const isOwner = myRole === 'owner';
  const isAdmin = myRole === 'admin';
  const canManage = isOwner || isAdmin;

  const loadData = async () => {
    setLoading(true);
    const [{ data: groupData }, { data: membersData }] = await Promise.all([
      supabase.from('groups').select('*').eq('id', groupId).single(),
      supabase
        .from('group_members')
        .select('*, user:users(*)')
        .eq('group_id', groupId)
        .order('joined_at', { ascending: true }),
    ]);

    if (groupData) {
      setGroup(groupData as Group);
      setEditName(groupData.name);
      setEditDesc(groupData.description ?? '');
      setAllowMessages(groupData.can_members_send_messages);
      setAllowMedia(groupData.can_members_send_media);
    }

    if (membersData) {
      setMembers(membersData as GroupMember[]);
      const me = membersData.find((m: GroupMember) => m.user_id === currentUser?.id);
      if (me) setMyRole(me.role);
    }

    setLoading(false);
  };

  useEffect(() => { loadData(); }, [groupId]);

  const saveChanges = async () => {
    if (!editName.trim()) { Alert.alert('خطا', 'نام گروه نمی‌تواند خالی باشد'); return; }
    setSaving(true);
    const { error } = await supabase.from('groups').update({
      name: editName.trim(),
      description: editDesc.trim() || null,
      can_members_send_messages: allowMessages,
      can_members_send_media: allowMedia,
    }).eq('id', groupId);

    setSaving(false);
    if (error) Alert.alert('خطا', error.message);
    else { Alert.alert('موفق', 'تغییرات ذخیره شد'); loadData(); }
  };

  const pickAvatar = async () => {
    if (!isOwner) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setAvatarUploading(true);
    try {
      const ext = (asset.fileName ?? 'avatar.jpg').split('.').pop();
      const path = `groups/${groupId}/avatar.${ext}`;

      let bytes: Uint8Array;
      if (Platform.OS === 'web') {
        const res = await fetch(asset.uri);
        bytes = new Uint8Array(await res.arrayBuffer());
      } else {
        const base64 = await ExpoFS.readAsStringAsync(asset.uri, { encoding: ExpoFS.EncodingType.Base64 });
        const bin = atob(base64);
        bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      }

      const { error: upErr } = await supabase.storage.from('media').upload(path, bytes, {
        contentType: asset.mimeType ?? 'image/jpeg',
        upsert: true,
      });
      if (upErr) { Alert.alert('خطا', upErr.message); return; }

      const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(path);
      await supabase.from('groups').update({ avatar_url: publicUrl }).eq('id', groupId);
      loadData();
    } finally {
      setAvatarUploading(false);
    }
  };

  const removeMember = (member: GroupMember) => {
    if (!isOwner) return;
    if (member.user_id === currentUser?.id) return;
    Alert.alert(
      'حذف عضو',
      `آیا از حذف ${(member.user as any)?.name ?? (member.user as any)?.username} مطمئن هستید؟`,
      [
        { text: 'انصراف', style: 'cancel' },
        {
          text: 'حذف', style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.from('group_members').delete().eq('id', member.id);
            if (error) Alert.alert('خطا', error.message);
            else loadData();
          },
        },
      ]
    );
  };

  const changeRole = (member: GroupMember) => {
    if (!isOwner || member.user_id === currentUser?.id) return;
    const newRole = member.role === 'admin' ? 'member' : 'admin';
    const label = newRole === 'admin' ? 'ادمین کردن' : 'عضو عادی کردن';
    Alert.alert('تغییر نقش', `${label}؟`, [
      { text: 'انصراف', style: 'cancel' },
      {
        text: label,
        onPress: async () => {
          const { error } = await supabase.from('group_members').update({ role: newRole }).eq('id', member.id);
          if (error) Alert.alert('خطا', error.message);
          else loadData();
        },
      },
    ]);
  };

  const leaveGroup = () => {
    if (isOwner) {
      Alert.alert('خروج', 'شما مالک گروه هستید. برای خروج باید مالکیت را به فرد دیگری انتقال دهید یا گروه را حذف کنید.');
      return;
    }
    Alert.alert('خروج از گروه', 'آیا مطمئن هستید؟', [
      { text: 'انصراف', style: 'cancel' },
      {
        text: 'خروج', style: 'destructive',
        onPress: async () => {
          await supabase.from('group_members').delete()
            .eq('group_id', groupId).eq('user_id', currentUser!.id);
          router.replace('/(tabs)');
        },
      },
    ]);
  };

  const deleteGroup = () => {
    if (!isOwner) return;
    Alert.alert('حذف گروه', 'این عملیات برگشت‌ناپذیر است. همه پیام‌ها و اعضا حذف می‌شوند.', [
      { text: 'انصراف', style: 'cancel' },
      {
        text: 'حذف گروه', style: 'destructive',
        onPress: async () => {
          await supabase.from('groups').delete().eq('id', groupId);
          router.replace('/(tabs)');
        },
      },
    ]);
  };

  const getRoleBadge = (role: GroupMember['role']) => {
    if (role === 'owner') return { label: 'مالک', color: '#f7c46a' };
    if (role === 'admin') return { label: 'ادمین', color: '#7c6af7' };
    return { label: 'عضو', color: '#666' };
  };

  if (loading) return (
    <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
      <ActivityIndicator color="#7c6af7" size="large" />
    </View>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>تنظیمات گروه</Text>
        {canManage && (
          <TouchableOpacity style={styles.saveBtn} onPress={saveChanges} disabled={saving}>
            {saving ? <ActivityIndicator color="#7c6af7" size="small" /> : <Text style={styles.saveBtnText}>ذخیره</Text>}
          </TouchableOpacity>
        )}
      </View>

      {/* Avatar */}
      <View style={styles.avatarSection}>
        <TouchableOpacity onPress={pickAvatar} disabled={!isOwner || avatarUploading} activeOpacity={0.8}>
          {group?.avatar_url ? (
            <Image source={{ uri: group.avatar_url }} style={styles.groupAvatar} contentFit="cover" cachePolicy="memory-disk" />
          ) : (
            <View style={styles.groupAvatarPlaceholder}>
              <Ionicons name="people" size={48} color="#fff" />
            </View>
          )}
          {isOwner && (
            <View style={styles.editAvatarBadge}>
              {avatarUploading ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="camera" size={16} color="#fff" />}
            </View>
          )}
        </TouchableOpacity>
        <View style={styles.inviteCodeBox}>
          <Ionicons name="key-outline" size={14} color="#7c6af7" />
          <Text style={styles.inviteCodeLabel}>کد دعوت:</Text>
          <Text style={styles.inviteCode}>{group?.invite_code}</Text>
        </View>
      </View>

      {/* Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>اطلاعات گروه</Text>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>نام گروه</Text>
          <TextInput
            style={[styles.fieldInput, !canManage && styles.fieldInputReadOnly]}
            value={editName}
            onChangeText={setEditName}
            editable={canManage}
            placeholderTextColor="#666"
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>توضیحات</Text>
          <TextInput
            style={[styles.fieldInput, styles.fieldInputMulti, !canManage && styles.fieldInputReadOnly]}
            value={editDesc}
            onChangeText={setEditDesc}
            editable={canManage}
            multiline
            numberOfLines={3}
            placeholder="توضیحات گروه..."
            placeholderTextColor="#666"
          />
        </View>
      </View>

      {/* Restrictions - owner/admin only */}
      {canManage && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>محدودیت‌های اعضا</Text>
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Ionicons name="chatbubble-outline" size={18} color="#7c6af7" />
              <Text style={styles.toggleLabel}>اعضا می‌توانند پیام بفرستند</Text>
            </View>
            <Switch
              value={allowMessages}
              onValueChange={setAllowMessages}
              trackColor={{ false: '#2a2a3e', true: '#7c6af7' }}
              thumbColor="#fff"
            />
          </View>
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Ionicons name="image-outline" size={18} color="#7c6af7" />
              <Text style={styles.toggleLabel}>اعضا می‌توانند رسانه بفرستند</Text>
            </View>
            <Switch
              value={allowMedia}
              onValueChange={setAllowMedia}
              trackColor={{ false: '#2a2a3e', true: '#7c6af7' }}
              thumbColor="#fff"
            />
          </View>
        </View>
      )}

      {/* Members */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>اعضا ({members.length})</Text>
        {members.map((member) => {
          const user = member.user as any;
          const badge = getRoleBadge(member.role);
          const isMe = member.user_id === currentUser?.id;
          return (
            <View key={member.id} style={styles.memberRow}>
              <UserAvatar
                name={user?.name}
                username={user?.username}
                avatarColor={user?.avatar_color}
                avatarUrl={user?.avatar_url}
                size={42}
              />
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>{user?.name ?? user?.username ?? 'کاربر'}</Text>
                <Text style={[styles.memberRole, { color: badge.color }]}>{badge.label}</Text>
              </View>
              {isOwner && !isMe && (
                <View style={styles.memberActions}>
                  <TouchableOpacity style={styles.memberActionBtn} onPress={() => changeRole(member)}>
                    <Ionicons name={member.role === 'admin' ? 'person-remove-outline' : 'shield-outline'} size={18} color="#7c6af7" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.memberActionBtn} onPress={() => removeMember(member)}>
                    <Ionicons name="close-circle-outline" size={18} color="#e05555" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}
      </View>

      {/* Danger Zone */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>منطقه خطر</Text>
        {!isOwner && (
          <TouchableOpacity style={styles.dangerBtn} onPress={leaveGroup}>
            <Ionicons name="exit-outline" size={20} color="#e05555" />
            <Text style={styles.dangerBtnText}>خروج از گروه</Text>
          </TouchableOpacity>
        )}
        {isOwner && (
          <TouchableOpacity style={styles.dangerBtn} onPress={deleteGroup}>
            <Ionicons name="trash-outline" size={20} color="#e05555" />
            <Text style={styles.dangerBtnText}>حذف گروه</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#0f0f1a',
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a2e',
    gap: 10,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, color: '#ffffff', fontSize: 17, fontWeight: '600' },
  saveBtn: { paddingHorizontal: 14, paddingVertical: 7, backgroundColor: '#7c6af7', borderRadius: 20 },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  avatarSection: { alignItems: 'center', paddingVertical: 24, gap: 12 },
  groupAvatar: { width: 90, height: 90, borderRadius: 45 },
  groupAvatarPlaceholder: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: '#7c6af7', justifyContent: 'center', alignItems: 'center',
  },
  editAvatarBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#5865f2', justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#0a0a0f',
  },
  inviteCodeBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#13131f', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  inviteCodeLabel: { color: '#666', fontSize: 12 },
  inviteCode: { color: '#ffffff', fontSize: 13, fontWeight: '700', letterSpacing: 1 },
  section: { marginTop: 20, marginHorizontal: 16 },
  sectionTitle: { color: '#666', fontSize: 12, fontWeight: '600', letterSpacing: 0.5, marginBottom: 10, textTransform: 'uppercase' },
  field: { backgroundColor: '#13131f', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 8 },
  fieldLabel: { color: '#666', fontSize: 11, marginBottom: 4 },
  fieldInput: { color: '#ffffff', fontSize: 15 },
  fieldInputMulti: { height: 72, textAlignVertical: 'top' },
  fieldInputReadOnly: { color: '#aaa' },
  toggleRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#13131f', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, marginBottom: 8,
  },
  toggleInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  toggleLabel: { color: '#ffffff', fontSize: 14 },
  memberRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#13131f', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8,
  },
  memberInfo: { flex: 1 },
  memberName: { color: '#ffffff', fontSize: 14, fontWeight: '500' },
  memberRole: { fontSize: 11, marginTop: 2 },
  memberActions: { flexDirection: 'row', gap: 4 },
  memberActionBtn: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a2e' },
  dangerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#1a0a0a', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14,
    borderWidth: 1, borderColor: '#3a1010', marginBottom: 8,
  },
  dangerBtnText: { color: '#e05555', fontSize: 15, fontWeight: '500' },
});
