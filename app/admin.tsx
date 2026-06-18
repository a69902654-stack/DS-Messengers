import { supabase } from '@/config/supabase';
import { useAuth } from '@/context/auth-context';
import { isUserAdmin } from '@/config/admins';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

type User = {
  id: string;
  username: string;
  name: string;
  phone_number: string;
  created_at: string;
};

export default function AdminPanel() {
  const { currentUser } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    male: 0,
    female: 0,
    newThisWeek: 0
  });

  // بررسی ادمین بودن
  useEffect(() => {
    if (currentUser) {
      const admin = isUserAdmin(currentUser.id);
      setIsAdmin(admin);
      if (admin) {
        loadUsers();
      } else {
        Alert.alert('دسترسی محدود', 'شما دسترسی ادمین ندارید');
        router.back();
      }
    }
  }, [currentUser]);

  // دریافت لیست کاربران
  const loadUsers = async () => {
    setLoading(true);
    
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error(error);
      Alert.alert('خطا', 'مشکلی در دریافت اطلاعات پیش آمد');
    } else {
      setUsers(data || []);
      
      // محاسبه آمار ساده
      const now = new Date();
      const weekAgo = new Date(now.setDate(now.getDate() - 7));
      
      setStats({
        total: data?.length || 0,
        male: Math.floor((data?.length || 0) * 0.6), // تخمینی
        female: Math.floor((data?.length || 0) * 0.4), // تخمینی
        newThisWeek: data?.filter(u => new Date(u.created_at) > weekAgo).length || 0
      });
    }
    
    setLoading(false);
  };

  // حذف کاربر
  const deleteUser = async (userId: string) => {
    Alert.alert(
      'حذف کاربر',
      'آیا مطمئن هستید؟ این عمل غیرقابل بازگشت است',
      [
        { text: 'انصراف', style: 'cancel' },
        {
          text: 'حذف',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('profiles')
              .delete()
              .eq('id', userId);
            
            if (error) {
              Alert.alert('خطا', 'مشکلی در حذف کاربر پیش آمد');
            } else {
              Alert.alert('موفق', 'کاربر حذف شد');
              loadUsers();
            }
          }
        }
      ]
    );
  };

  // فرمت تاریخ
  const formatDate = (dateString: string) => {
    if (!dateString) return 'نامشخص';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('fa-IR').format(date);
  };

  // فیلتر کاربران
  const filteredUsers = users.filter(user =>
    user.name?.toLowerCase().includes(search.toLowerCase()) ||
    user.username?.toLowerCase().includes(search.toLowerCase()) ||
    user.phone_number?.includes(search) ||
    user.id.toLowerCase().includes(search.toLowerCase())
  );

  if (!isAdmin) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#7c6af7" />
        <Text style={styles.checkingText}>در حال بررسی دسترسی...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>پنل مدیریت</Text>
        <TouchableOpacity onPress={loadUsers}>
          <Text style={styles.refreshButton}>⟳</Text>
        </TouchableOpacity>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.total}</Text>
          <Text style={styles.statLabel}>کل کاربران</Text>
        </View>
        <View style={[styles.statCard, styles.statCardMale]}>
          <Text style={styles.statNumber}>{stats.male}</Text>
          <Text style={styles.statLabel}>آقا</Text>
        </View>
        <View style={[styles.statCard, styles.statCardFemale]}>
          <Text style={styles.statNumber}>{stats.female}</Text>
          <Text style={styles.statLabel}>خانم</Text>
        </View>
        <View style={[styles.statCard, styles.statCardNew]}>
          <Text style={styles.statNumber}>{stats.newThisWeek}</Text>
          <Text style={styles.statLabel}>جدید این هفته</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="جستجو در نام، نام کاربری، شماره یا آیدی..."
          placeholderTextColor="#555"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Users List */}
      {loading ? (
        <ActivityIndicator style={styles.loader} color="#7c6af7" size="large" />
      ) : (
        <FlatList
          data={filteredUsers}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.userCard}>
              <View style={styles.userAvatar}>
                <Text style={styles.userAvatarText}>
                  {(item.name || item.username || '?')[0].toUpperCase()}
                </Text>
              </View>
              
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{item.name || 'بدون نام'}</Text>
                <Text style={styles.userUsername}>@{item.username}</Text>
                <Text style={styles.userPhone}>{item.phone_number || 'شماره ثبت نشده'}</Text>
                <Text style={styles.userId}>ID: {item.id.slice(0, 8)}...</Text>
                <Text style={styles.userDate}>عضویت: {formatDate(item.created_at)}</Text>
              </View>
              
              <View style={styles.userActions}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.deleteButton]}
                  onPress={() => deleteUser(item.id)}
                >
                  <Text style={styles.actionText}>🗑️</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>کاربری یافت نشد</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f1a',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f0f1a',
  },
  checkingText: {
    color: '#888',
    marginTop: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
    backgroundColor: '#1a1a2e',
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a3e',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  backButton: {
    fontSize: 24,
    color: '#7c6af7',
  },
  refreshButton: {
    fontSize: 20,
    color: '#7c6af7',
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  statCardMale: {
    backgroundColor: '#3a6ea5',
  },
  statCardFemale: {
    backgroundColor: '#c94f8c',
  },
  statCardNew: {
    backgroundColor: '#6af7a0',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  statLabel: {
    fontSize: 10,
    color: '#fff',
    marginTop: 4,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  searchInput: {
    backgroundColor: '#1a1a2e',
    color: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  loader: {
    marginTop: 40,
  },
  listContent: {
    padding: 16,
    paddingBottom: 80,
  },
  userCard: {
    flexDirection: 'row',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#7c6af7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userAvatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  userUsername: {
    color: '#7c6af7',
    fontSize: 12,
    marginBottom: 2,
  },
  userPhone: {
    color: '#888',
    fontSize: 11,
    marginBottom: 2,
  },
  userId: {
    color: '#555',
    fontSize: 10,
    marginBottom: 2,
  },
  userDate: {
    color: '#555',
    fontSize: 10,
  },
  userActions: {
    justifyContent: 'center',
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2a2a3e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButton: {
    backgroundColor: '#f76a6a',
  },
  actionText: {
    fontSize: 18,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#888',
    fontSize: 14,
  },
});