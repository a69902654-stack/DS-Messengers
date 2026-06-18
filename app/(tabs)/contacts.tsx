import { supabase } from '@/config/supabase';
import { useAuth } from '@/context/auth-context';
import { User } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import * as Contacts from 'expo-contacts';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

type ContactType = {
  id: string;
  name: string;
  phoneNumber: string;
};

export default function ContactsScreen() {
  const { currentUser } = useAuth();
  const router = useRouter();
  
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  
  // مخاطبین گوشی
  const [phoneContacts, setPhoneContacts] = useState<ContactType[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);

  // دریافت مخاطبین گوشی
  const loadPhoneContacts = async () => {
    const { status } = await Contacts.requestPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('خطا', 'برای نمایش مخاطبین به دسترسی نیاز داریم');
      return;
    }

    setLoadingContacts(true);
    
    try {
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers],
      });

      if (data && data.length > 0) {
        const formattedContacts: ContactType[] = [];
        
        for (const contact of data) {
          if (contact.name && contact.phoneNumbers && contact.phoneNumbers.length > 0) {
            // فقط اولین شماره هر مخاطب رو میگیریم
            const phoneNumber = contact.phoneNumbers[0].number;
            if (phoneNumber) {
              formattedContacts.push({
                id: contact.id,
                name: contact.name,
                phoneNumber: phoneNumber.replace(/\s/g, ''),
              });
            }
          }
        }
        
        setPhoneContacts(formattedContacts);
      } else {
        Alert.alert('توجه', 'هیچ مخاطبی در گوشی شما یافت نشد');
      }
    } catch (error) {
      console.error('Error loading contacts:', error);
      Alert.alert('خطا', 'مشکلی در بارگذاری مخاطبین پیش آمد');
    } finally {
      setLoadingContacts(false);
    }
  };

  // جستجو در مخاطبین گوشی
  const searchInPhoneContacts = (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    const lower = query.toLowerCase();
    const filtered = phoneContacts.filter(contact => 
      contact.name.toLowerCase().includes(lower)
    );
    
    // تبدیل به فرمت کاربری فرضی برای نمایش
    const fakeUsers: User[] = filtered.map(contact => ({
      id: contact.id,
      name: contact.name,
      username: null,
      phone_number: contact.phoneNumber,
      avatar_color: null,
      is_online: false,
      created_at: new Date().toISOString(),
    } as User));
    
    setSearchResults(fakeUsers);
  };

  useEffect(() => {
    const delay = setTimeout(() => {
      searchInPhoneContacts(search);
    }, 300);
    
    return () => clearTimeout(delay);
  }, [search, phoneContacts]);

  const getAvatarColor = (color: number | null) => {
    const colors = ['#7c6af7', '#f76a6a', '#6af7a0', '#f7c46a', '#6ac4f7', '#f7a6c4', '#a6c4f7'];
    return colors[(color ?? 0) % colors.length];
  };

  const getInitials = (name: string) => {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name[0].toUpperCase();
  };

  const goToChat = async (contact: ContactType) => {
    // جستجوی کاربر در دیتابیس با شماره تلفن
    if (contact.phoneNumber) {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('phone_number', contact.phoneNumber)
        .single();
      
      if (error) {
        Alert.alert(
          'کاربر یافت نشد',
          `${contact.name} در برنامه ثبت نام نکرده است`
        );
      } else if (data) {
        router.push(`/chat/${data.id}`);
      }
    } else {
      Alert.alert('خطا', 'این مخاطب شماره تلفن ندارد');
    }
  };

  const renderContactItem = ({ item }: { item: ContactType }) => (
    <TouchableOpacity
      style={styles.item}
      onPress={() => goToChat(item)}
      activeOpacity={0.7}
    >
      <View style={[styles.avatar, { backgroundColor: getAvatarColor(null) }]}>
        <Text style={styles.avatarText}>
          {getInitials(item.name)}
        </Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.phoneNumber} numberOfLines={1}>
          {item.phoneNumber}
        </Text>
      </View>
      <View style={styles.rightSection}>
        <Ionicons name="chatbubble-outline" size={20} color="#7c6af7" />
      </View>
    </TouchableOpacity>
  );

  const renderSearchResult = ({ item }: { item: User }) => (
    <TouchableOpacity
      style={styles.item}
      onPress={() => router.push(`/chat/${item.id}`)}
      activeOpacity={0.7}
    >
      <View style={[styles.avatar, { backgroundColor: getAvatarColor(item.avatar_color) }]}>
        <Text style={styles.avatarText}>
          {getInitials(item.name || item.username || 'کاربر')}
        </Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {item.name || item.username || 'کاربر'}
        </Text>
        {item.username && (
          <Text style={styles.username} numberOfLines={1}>
            @{item.username}
          </Text>
        )}
      </View>
      <View style={styles.rightSection}>
        <View style={[styles.onlineDot, item.is_online && styles.onlineDotActive]} />
        <Ionicons name="chatbubble-outline" size={20} color="#7c6af7" />
      </View>
    </TouchableOpacity>
  );

  // بارگذاری خودکار مخاطبین هنگام باز شدن صفحه
  useEffect(() => {
    loadPhoneContacts();
  }, []);

  // نمایش مخاطبین اصلی (بدون جستجو)
  const renderContactsList = () => {
    if (loadingContacts) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#7c6af7" size="large" />
          <Text style={styles.loadingText}>در حال بارگذاری مخاطبین...</Text>
        </View>
      );
    }

    if (phoneContacts.length === 0) {
      return (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconContainer}>
            <Ionicons name="people-outline" size={56} color="#2a2a3e" />
          </View>
          <Text style={styles.emptyTitle}>مخاطبی یافت نشد</Text>
          <Text style={styles.emptySubtitle}>
            برای مشاهده مخاطبین گوشی خود، روی دکمه پایین کلیک کنید
          </Text>
          <TouchableOpacity style={styles.loadContactsButton} onPress={loadPhoneContacts}>
            <Ionicons name="sync-outline" size={20} color="#7c6af7" />
            <Text style={styles.loadContactsButtonText}>بارگذاری مخاطبین</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <FlatList
        data={phoneContacts}
        keyExtractor={(item) => item.id}
        renderItem={renderContactItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      />
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>مخاطبین</Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={18} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="جستجو در مخاطبین..."
          placeholderTextColor="#666"
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} style={styles.clearBtn}>
            <Ionicons name="close-circle" size={18} color="#666" />
          </TouchableOpacity>
        )}
      </View>

      {/* Results or Contacts List */}
      {search.length > 0 ? (
        searchResults.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="search-outline" size={56} color="#2a2a3e" />
            </View>
            <Text style={styles.emptyTitle}>نتیجه‌ای یافت نشد</Text>
            <Text style={styles.emptySubtitle}>
              مخاطبی با این نام پیدا نشد
            </Text>
          </View>
        ) : (
          <FlatList
            data={searchResults}
            keyExtractor={(item) => item.id}
            renderItem={renderSearchResult}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
          />
        )
      ) : (
        renderContactsList()
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
    backgroundColor: '#0f0f1a',
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a2e',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    backgroundColor: '#13131f',
    borderRadius: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#1e1e30',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 15,
    paddingVertical: 12,
  },
  clearBtn: {
    padding: 4,
  },
  listContent: {
    paddingBottom: 20,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 14,
    backgroundColor: '#0f0f1a',
    borderBottomWidth: 0.5,
    borderBottomColor: '#1a1a2e',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '600',
  },
  info: {
    flex: 1,
    gap: 4,
  },
  name: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
  username: {
    color: '#7c6af7',
    fontSize: 13,
  },
  phoneNumber: {
    color: '#666',
    fontSize: 12,
  },
  rightSection: {
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#666',
    fontSize: 14,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 80,
    gap: 12,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#13131f',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  emptySubtitle: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  loadContactsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 16,
  },
  loadContactsButtonText: {
    color: '#7c6af7',
    fontSize: 14,
    fontWeight: '500',
  },
});