import { isUserAdmin } from '../../config/admins';
import { supabase } from '../../config/supabase';
import { useAuth } from '../../context/auth-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ExpoFS from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Modal,
    Platform,
    ScrollView,
    Share,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const AVATAR_COLORS = ['#7c6af7', '#f76a6a', '#6af7a0', '#f7c46a', '#6ac4f7', '#f7a6c4', '#a6c4f7', '#c4f7a6'];

const THEMES = [
  { id: 'DARK', name: 'تیره', color: '#0f0f1a' },
  { id: 'LIGHT', name: 'روشن', color: '#f5f5f5' },
  { id: 'FROSTED', name: 'شیشه‌ای', color: '#1a1a2e' },
];

const WALLPAPERS = [
  { id: 'NONE', name: 'پیش‌فرض', preview: '#1a1a2e' },
  { id: 'MOUNTAIN', name: 'کوهستان', preview: '#2c3e50' },
  { id: 'OCEAN', name: 'اقیانوس', preview: '#1a5276' },
  { id: 'FOREST', name: 'جنگل', preview: '#1e8449' },
  { id: 'SUNSET', name: 'غروب', preview: '#922b21' },
  { id: 'NIGHT', name: 'شب', preview: '#1c1c3d' },
];

export default function ProfileScreen() {
  const { currentUser, signOut, refreshUser } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [saving, setSaving] = useState(false);
  const [loadingImage, setLoadingImage] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  
  // اطلاعات پایه
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [selectedColor, setSelectedColor] = useState(0);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [localAvatar, setLocalAvatar] = useState<string | null>(null);
  
  // تنظیمات
  const [selectedTheme, setSelectedTheme] = useState('FROSTED');
  const [selectedWallpaper, setSelectedWallpaper] = useState('NONE');
  const [isOnline, setIsOnline] = useState(true);
  const [lastSeen, setLastSeen] = useState('');
  
  // مودال‌ها
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showWallpaperModal, setShowWallpaperModal] = useState(false);
  const [showColorModal, setShowColorModal] = useState(false);
  const [showImageOptions, setShowImageOptions] = useState(false);

  const getAvatarStorageKey = (userId: string) => `avatar_${userId}`;

  const saveImageToLocal = async (userId: string, imageUri: string) => {
    try {
      if (!userId) return;
      await AsyncStorage.setItem(getAvatarStorageKey(userId), imageUri);
      console.log('عکس در حافظه محلی ذخیره شد');
    } catch (error) {
      console.error('خطا در ذخیره محلی:', error);
    }
  };

  const getImageFromLocal = async (userId: string): Promise<string | null> => {
    try {
      if (!userId) return null;
      const savedUri = await AsyncStorage.getItem(getAvatarStorageKey(userId));
      return savedUri;
    } catch (error) {
      console.error('خطا در خواندن از حافظه محلی:', error);
      return null;
    }
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const loadAndCacheAvatar = async (userId: string, remoteUrl: string | null) => {
    if (!userId || !remoteUrl) return null;
    
    const cached = await getImageFromLocal(userId);
    if (cached) {
      setLocalAvatar(cached);
      return cached;
    }
    
    try {
      const response = await fetch(remoteUrl);
      const blob = await response.blob();
      const base64 = await blobToBase64(blob);
      await saveImageToLocal(userId, base64);
      setLocalAvatar(base64);
      return base64;
    } catch (error) {
      console.error('خطا در دانلود عکس:', error);
      return null;
    }
  };

  useEffect(() => {
    if (currentUser && currentUser.id) {
      setName(currentUser.name || '');
      setUsername(currentUser.username || '');
      setPhone(currentUser.phone_number || '');
      setBio((currentUser as any).bio || '');
      setSelectedColor(currentUser.avatar_color || 0);
      
      const remoteAvatarUrl = (currentUser as any).avatar_url || null;
      setAvatarUrl(remoteAvatarUrl);
      
      if (remoteAvatarUrl && currentUser.id) {
        loadAndCacheAvatar(currentUser.id, remoteAvatarUrl);
      }
      
      setSelectedTheme((currentUser as any).selected_theme_name || 'FROSTED');
      setSelectedWallpaper((currentUser as any).chat_wallpaper || 'NONE');
      setIsOnline((currentUser as any).is_online ?? true);
      setIsAdmin(isUserAdmin(currentUser.id));
      
      const lastSeenDate = (currentUser as any).last_seen;
      if (lastSeenDate) {
        const date = new Date(lastSeenDate);
        setLastSeen(new Intl.DateTimeFormat('fa-IR', { 
          hour: '2-digit', 
          minute: '2-digit',
          day: '2-digit',
          month: '2-digit'
        }).format(date));
      }
    }
  }, [currentUser]);

  const requestPermission = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('خطا', 'برای انتخاب عکس نیاز به دسترسی داریم');
        return false;
      }
      return true;
    }
    return true;
  };

  const pickImage = async () => {
    if (!currentUser?.id) {
      Alert.alert('خطا', 'لطفاً ابتدا وارد حساب خود شوید');
      return;
    }

    const hasPermission = await requestPermission();
    if (!hasPermission) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]) {
      const imageUri = result.assets[0].uri;
      uploadImage(imageUri);
    }
  };

  const takePhoto = async () => {
    if (!currentUser?.id) {
      Alert.alert('خطا', 'لطفاً ابتدا وارد حساب خود شوید');
      return;
    }

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('خطا', 'برای گرفتن عکس نیاز به دسترسی دوربین داریم');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]) {
      uploadImage(result.assets[0].uri);
    }
  };

  const uploadImage = async (uri: string) => {
    if (!currentUser?.id) return;
    
    setLoadingImage(true);
    
    try {
      const fileExt = uri.split('.').pop()?.toLowerCase().split('?')[0] || 'jpg';
      const mimeType = fileExt === 'png' ? 'image/png' : 'image/jpeg';
      const filePath = `${currentUser.id}/avatar.${fileExt}`;

      let bytes: Uint8Array;
      let base64ForCache: string | null = null;

      if (Platform.OS === 'web') {
        const response = await fetch(uri);
        bytes = new Uint8Array(await response.arrayBuffer());
      } else {
        // روی موبایل، fetch روی file:// کار نمی‌کنه — از expo-file-system استفاده می‌کنیم
        const base64 = await ExpoFS.readAsStringAsync(uri, {
          encoding: ExpoFS.EncodingType.Base64,
        });
        base64ForCache = base64; // ذخیره برای کش — بدون خوندن دوباره
        const binaryStr = atob(base64);
        bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
      }

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, bytes, { 
          upsert: true,
          contentType: mimeType,
        });
      
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);
      
      const { error: updateError } = await supabase
        .from('users')
        .update({ avatar_url: publicUrl })
        .eq('id', currentUser.id);
      
      if (updateError) throw updateError;
      
      setAvatarUrl(publicUrl);

      // کش محلی با base64 — از همون base64 که قبلاً خوندیم استفاده می‌کنیم
      const base64Cache = Platform.OS === 'web'
        ? uri
        : `data:${mimeType};base64,${base64ForCache}`;
      await saveImageToLocal(currentUser.id, base64Cache);
      setLocalAvatar(base64Cache);
      
      await refreshUser();
      Alert.alert('موفق', 'عکس پروفایل به‌روزرسانی شد');
    } catch (error: any) {
      console.error('Upload error details:', error);
      Alert.alert('خطا', 'مشکلی در آپلود عکس پیش آمد');
    } finally {
      setLoadingImage(false);
      setShowImageOptions(false);
    }
  };

  const removeImage = async () => {
    if (!currentUser?.id) {
      Alert.alert('خطا', 'لطفاً ابتدا وارد حساب خود شوید');
      return;
    }

    Alert.alert(
      'حذف عکس',
      'آیا از حذف عکس پروفایل مطمئن هستید؟',
      [
        { text: 'انصراف', style: 'cancel' },
        {
          text: 'حذف',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.removeItem(getAvatarStorageKey(currentUser.id));
            setLocalAvatar(null);
            
            const { error } = await supabase
              .from('users')
              .update({ avatar_url: null })
              .eq('id', currentUser.id);
            
            if (error) {
              Alert.alert('خطا', 'مشکلی در حذف عکس پیش آمد');
            } else {
              setAvatarUrl(null);
              await refreshUser();
              Alert.alert('موفق', 'عکس پروفایل حذف شد');
              setShowImageOptions(false);
            }
          }
        }
      ]
    );
  };

  const handleSave = async () => {
    if (!currentUser) return;
    setSaving(true);
    
    const { error } = await supabase
      .from('users')
      .update({ 
        name, 
        username, 
        phone_number: phone,
        avatar_color: selectedColor,
        selected_theme_name: selectedTheme,
        chat_wallpaper: selectedWallpaper,
        is_online: isOnline
      })
      .eq('id', currentUser.id);
    
    setSaving(false);
    
    if (error) {
      Alert.alert('خطا', error.message);
    } else {
      await refreshUser();
      Alert.alert('موفق', 'پروفایل به‌روزرسانی شد');
    }
  };

  const shareProfile = async () => {
    try {
      await Share.share({
        message: `${name} (${username}) در DS\nآیدی: ${currentUser?.id}`,
        title: 'پروفایل DS',
      });
    } catch (error) {
      console.error(error);
    }
  };

  const copyToClipboard = (text: string) => {
    Alert.alert('کپی شد', 'آیدی در کلیپ‌بورد کپی شد');
  };

  const avatarLetter = (name || username || '?')[0]?.toUpperCase();
  const displayAvatar = localAvatar || avatarUrl;

  return (
    <ScrollView 
      style={styles.container} 
      contentContainerStyle={[styles.inner, { paddingBottom: insets.bottom + 80 }]}
      showsVerticalScrollIndicator={false}
    >
      <StatusBar style="light" />
      
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.headerTitle}>پروفایل من</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={shareProfile} style={styles.headerBtn}>
            <Ionicons name="share-outline" size={20} color="#7c6af7" />
          </TouchableOpacity>
          {isAdmin && (
            <TouchableOpacity onPress={() => router.push('/admin')} style={styles.headerBtn}>
              <Ionicons name="shield-outline" size={20} color="#7c6af7" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.avatarSection}>
        <TouchableOpacity onPress={() => setShowImageOptions(true)} style={styles.avatarWrapper}>
          {displayAvatar ? (
            <Image source={{ uri: displayAvatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, { backgroundColor: AVATAR_COLORS[selectedColor % AVATAR_COLORS.length] }]}>
              <Text style={styles.avatarText}>{avatarLetter}</Text>
            </View>
          )}
          {loadingImage && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator color="#fff" />
            </View>
          )}
          <View style={styles.editIcon}>
            <Ionicons name="camera" size={14} color="#fff" />
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowColorModal(true)}>
          <Text style={styles.changeColorText}>تغییر رنگ پروفایل</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={showImageOptions} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.imageOptionsModal}>
            <Text style={styles.modalTitle}>عکس پروفایل</Text>
            
            <TouchableOpacity style={styles.imageOption} onPress={pickImage}>
              <Ionicons name="images-outline" size={24} color="#6af7a0" />
              <Text style={styles.imageOptionText}>انتخاب از گالری</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.imageOption} onPress={takePhoto}>
              <Ionicons name="camera-outline" size={24} color="#f7c46a" />
              <Text style={styles.imageOptionText}>گرفتن با دوربین</Text>
            </TouchableOpacity>
            
            {displayAvatar && (
              <TouchableOpacity style={[styles.imageOption, styles.removeOption]} onPress={removeImage}>
                <Ionicons name="trash-outline" size={24} color="#e05555" />
                <Text style={[styles.imageOptionText, styles.removeText]}>حذف عکس</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity style={styles.cancelOption} onPress={() => setShowImageOptions(false)}>
              <Text style={styles.cancelText}>انصراف</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <View style={styles.infoCards}>
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>وضعیت</Text>
          <Text style={[styles.infoValue, isOnline && styles.onlineStatus]}>
            {isOnline ? 'آنلاین' : 'آفلاین'}
          </Text>
        </View>
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>آخرین بازدید</Text>
          <Text style={styles.infoValue}>{lastSeen || 'نامشخص'}</Text>
        </View>
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>تاریخ عضویت</Text>
          <Text style={styles.infoValue}>
            {currentUser?.created_at ? new Date(currentUser.created_at).toLocaleDateString('fa-IR') : 'نامشخص'}
          </Text>
        </View>
      </View>

      <View style={styles.form}>
        <Text style={styles.sectionTitle}>اطلاعات شخصی</Text>
        
        <TextInput
          style={styles.input}
          placeholder="نام و نام خانوادگی"
          placeholderTextColor="#666"
          value={name}
          onChangeText={setName}
        />
        
        <TextInput
          style={styles.input}
          placeholder="نام کاربری"
          placeholderTextColor="#666"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
        />
        
        <TextInput
          style={styles.input}
          placeholder="شماره تلفن"
          placeholderTextColor="#666"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />
        
        <TextInput
          style={[styles.input, styles.bioInput]}
          placeholder="بیوگرافی"
          placeholderTextColor="#666"
          value={bio}
          onChangeText={setBio}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />

        <Text style={styles.sectionTitle}>تنظیمات ظاهری</Text>

        <TouchableOpacity style={styles.optionItem} onPress={() => setShowThemeModal(true)}>
          <View style={styles.optionIcon}>
            <Ionicons name="color-palette-outline" size={20} color="#7c6af7" />
          </View>
          <Text style={styles.optionLabel}>تم برنامه</Text>
          <Text style={styles.optionValue}>
            {THEMES.find(t => t.id === selectedTheme)?.name || selectedTheme}
          </Text>
          <Ionicons name="chevron-forward" size={18} color="#555" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.optionItem} onPress={() => setShowWallpaperModal(true)}>
          <View style={styles.optionIcon}>
            <Ionicons name="image-outline" size={20} color="#7c6af7" />
          </View>
          <Text style={styles.optionLabel}>والپیپر چت</Text>
          <Text style={styles.optionValue}>
            {WALLPAPERS.find(w => w.id === selectedWallpaper)?.name || selectedWallpaper}
          </Text>
          <Ionicons name="chevron-forward" size={18} color="#555" />
        </TouchableOpacity>

        <View style={styles.switchItem}>
          <View style={styles.switchLeft}>
            <Ionicons name="eye-outline" size={18} color="#7c6af7" />
            <Text style={styles.switchLabel}>نمایش آنلاین بودن</Text>
          </View>
          <Switch
            value={isOnline}
            onValueChange={setIsOnline}
            trackColor={{ false: '#2a2a3e', true: '#7c6af7' }}
            thumbColor={isOnline ? '#fff' : '#888'}
          />
        </View>

        <View style={styles.idContainer}>
          <Text style={styles.idLabel}>آیدی من</Text>
          <View style={styles.idBox}>
            <Text style={styles.idText}>{currentUser?.id}</Text>
            <TouchableOpacity onPress={() => copyToClipboard(currentUser?.id || '')}>
              <Ionicons name="copy-outline" size={18} color="#7c6af7" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>ذخیره تغییرات</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={styles.signOutButton} onPress={signOut}>
        <Ionicons name="log-out-outline" size={18} color="#e05555" />
        <Text style={styles.signOutText}>خروج از حساب</Text>
      </TouchableOpacity>

      <Modal visible={showThemeModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>انتخاب تم</Text>
            {THEMES.map(theme => (
              <TouchableOpacity
                key={theme.id}
                style={[styles.modalOption, selectedTheme === theme.id && styles.modalOptionSelected]}
                onPress={() => {
                  setSelectedTheme(theme.id);
                  setShowThemeModal(false);
                }}
              >
                <Text style={styles.modalOptionText}>{theme.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      <Modal visible={showWallpaperModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>والپیپر چت</Text>
            <View style={styles.wallpaperGrid}>
              {WALLPAPERS.map(wallpaper => (
                <TouchableOpacity
                  key={wallpaper.id}
                  style={[
                    styles.wallpaperOption,
                    selectedWallpaper === wallpaper.id && styles.wallpaperOptionSelected
                  ]}
                  onPress={() => {
                    setSelectedWallpaper(wallpaper.id);
                    setShowWallpaperModal(false);
                  }}
                >
                  <View style={[styles.wallpaperPreview, { backgroundColor: wallpaper.preview }]} />
                  <Text style={styles.wallpaperName}>{wallpaper.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showColorModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>رنگ پروفایل</Text>
            <View style={styles.colorGrid}>
              {AVATAR_COLORS.map((color, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.colorOption,
                    { backgroundColor: color },
                    selectedColor === index && styles.colorOptionSelected
                  ]}
                  onPress={() => {
                    setSelectedColor(index);
                    setShowColorModal(false);
                  }}
                />
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  inner: { paddingBottom: 40 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingBottom: 16,
    backgroundColor: '#0f0f1a',
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a2e',
  },
  headerTitle: { fontSize: 20, fontWeight: '600', color: '#ffffff' },
  headerActions: { flexDirection: 'row', gap: 12 },
  headerBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a2e' },
  avatarSection: { alignItems: 'center', marginTop: 24, marginBottom: 20 },
  avatarWrapper: { position: 'relative' },
  avatar: { width: 100, height: 100, borderRadius: 50 },
  avatarText: {
    color: '#fff', fontSize: 38, fontWeight: '600', textAlign: 'center',
    width: 100, height: 100, lineHeight: 100, textAlignVertical: 'center',
  },
  loadingOverlay: {
    position: 'absolute', width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center',
  },
  editIcon: {
    position: 'absolute', bottom: 0, right: 0,
    backgroundColor: '#7c6af7', width: 28, height: 28, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#0a0a0f',
  },
  changeColorText: { color: '#7c6af7', fontSize: 12, marginTop: 8 },
  infoCards: { flexDirection: 'row', paddingHorizontal: 20, gap: 10, marginBottom: 24 },
  infoCard: {
    flex: 1, backgroundColor: '#13131f', borderRadius: 12, padding: 12,
    alignItems: 'center', borderWidth: 1, borderColor: '#1e1e30',
  },
  infoLabel: { color: '#666', fontSize: 10, marginBottom: 4, fontWeight: '500' },
  infoValue: { color: '#e0e0e0', fontSize: 11, fontWeight: '500' },
  onlineStatus: { color: '#3dd68c' },
  form: { paddingHorizontal: 20 },
  sectionTitle: { color: '#666', fontSize: 11, fontWeight: '600', letterSpacing: 0.6, marginTop: 20, marginBottom: 10 },
  input: {
    backgroundColor: '#13131f', color: '#fff', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 14,
    marginBottom: 10, borderWidth: 1, borderColor: '#1e1e30',
  },
  bioInput: { height: 80, textAlignVertical: 'top' },
  optionItem: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#13131f',
    borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#1e1e30',
  },
  optionIcon: { width: 32, marginRight: 12 },
  optionLabel: { flex: 1, color: '#e0e0e0', fontSize: 14 },
  optionValue: { color: '#666', fontSize: 12, marginRight: 8 },
  switchItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#13131f', borderRadius: 12, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: '#1e1e30',
  },
  switchLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  switchLabel: { color: '#e0e0e0', fontSize: 14 },
  idContainer: { marginTop: 4, marginBottom: 24 },
  idLabel: { color: '#666', fontSize: 11, fontWeight: '500', marginBottom: 6 },
  idBox: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#13131f',
    borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#1e1e30',
  },
  idText: { flex: 1, color: '#666', fontSize: 11 },
  saveButton: {
    backgroundColor: '#7c6af7', borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginHorizontal: 20, marginTop: 8, marginBottom: 12,
  },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  signOutButton: {
    flexDirection: 'row',
    borderRadius: 14, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', gap: 8,
    marginHorizontal: 20, marginBottom: 16, backgroundColor: '#13131f',
    borderWidth: 1, borderColor: '#2a1a1a',
  },
  signOutText: { color: '#e05555', fontSize: 14, fontWeight: '500' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  modalContent: {
    backgroundColor: '#13131f', borderRadius: 20, padding: 24,
    width: '85%', maxHeight: '80%', borderWidth: 1, borderColor: '#1e1e30',
  },
  modalTitle: { color: '#fff', fontSize: 17, fontWeight: '600', marginBottom: 20, textAlign: 'center' },
  modalOption: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, marginBottom: 6 },
  modalOptionSelected: { backgroundColor: '#1e1e30' },
  modalOptionText: { color: '#e0e0e0', fontSize: 15 },
  wallpaperGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  wallpaperOption: { width: '30%', alignItems: 'center', padding: 8, borderRadius: 12 },
  wallpaperOptionSelected: { backgroundColor: '#1e1e30' },
  wallpaperPreview: { width: 66, height: 66, borderRadius: 12, marginBottom: 6 },
  wallpaperName: { color: '#888', fontSize: 10 },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 14 },
  colorOption: { width: 46, height: 46, borderRadius: 23 },
  colorOptionSelected: { borderWidth: 3, borderColor: '#fff', transform: [{ scale: 1.1 }] },
  imageOptionsModal: {
    backgroundColor: '#13131f', borderRadius: 20, padding: 24,
    width: '80%', borderWidth: 1, borderColor: '#1e1e30',
  },
  imageOption: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, marginBottom: 8, backgroundColor: '#1a1a26',
  },
  imageOptionText: { color: '#e0e0e0', fontSize: 15 },
  removeOption: { backgroundColor: '#1f1010' },
  removeText: { color: '#e05555' },
  cancelOption: { padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 4 },
  cancelText: { color: '#666', fontSize: 15 },
});