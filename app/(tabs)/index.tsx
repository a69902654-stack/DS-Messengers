import UserAvatar from '../../components/user-avatar';
import { supabase } from '../../config/supabase';
import { useAuth } from '../../context/auth-context';
import { Group, Message, User } from '../../types';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    FlatList,
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ConversationItem = {
  user: User;
  lastMessage: Message | null;
};

type ListItem =
  | { type: 'conversation'; data: ConversationItem }
  | { type: 'group'; data: import('../../types').Group };

export default function ChatsScreen() {
  const { currentUser, signOut } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  
  // State for long press menu
  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  
  // State for FAB menu
  const [fabMenuVisible, setFabMenuVisible] = useState(false);
  const fabFadeAnim = useRef(new Animated.Value(0)).current;
  const fabScaleAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  // State for group modals
  const [createGroupVisible, setCreateGroupVisible] = useState(false);
  const [joinGroupVisible, setJoinGroupVisible] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [groupLoading, setGroupLoading] = useState(false);

  // Groups list
  const [groups, setGroups] = useState<Group[]>([]);

  const loadConversations = async () => {
    if (!currentUser) {
      setLoading(false);
      return;
    }
    
    setLoading(true);

    try {
      const { data: messages } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`)
        .order('created_at', { ascending: false });

      if (!messages || messages.length === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }

      const contactIds = new Set<string>();
      messages.forEach((m: Message) => {
        if (m.sender_id !== currentUser.id) contactIds.add(m.sender_id);
        if (m.receiver_id && m.receiver_id !== currentUser.id) contactIds.add(m.receiver_id);
      });

      if (contactIds.size === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }

      const { data: users } = await supabase
        .from('users')
        .select('*')
        .in('id', Array.from(contactIds));

      if (!users) {
        setLoading(false);
        return;
      }

      const convList: ConversationItem[] = users.map((u: User) => {
        const lastMsg = messages.find(
          (m: Message) =>
            (m.sender_id === u.id && m.receiver_id === currentUser.id) ||
            (m.sender_id === currentUser.id && m.receiver_id === u.id)
        ) || null;
        return { user: u, lastMessage: lastMsg };
      });

      convList.sort((a, b) => {
        const timeA = a.lastMessage?.created_at ? new Date(a.lastMessage.created_at).getTime() : 0;
        const timeB = b.lastMessage?.created_at ? new Date(b.lastMessage.created_at).getTime() : 0;
        return timeB - timeA;
      });

      setConversations(convList);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const searchUsers = async (text: string) => {
    setSearch(text);
    
    if (!currentUser?.id || text.trim() === '') {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);

    try {
      let query = supabase
        .from('users')
        .select('*')
        .neq('id', currentUser.id);
      
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const isUUID = uuidRegex.test(text.trim());
      
      if (isUUID) {
        query = query.eq('id', text.trim());
      } else {
        query = query.or(`username.ilike.%${text}%,name.ilike.%${text}%`);
      }
      
      const { data, error } = await query.limit(20);

      if (error) throw error;
      setSearchResults(data || []);
      
      if (isUUID && (!data || data.length === 0)) {
        Alert.alert('نتیجه', 'کاربری با این آیدی یافت نشد');
      }
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const goToChat = (userId: string) => {
    router.push(`/chat/${userId}`);
    setSearch('');
    setSearchResults([]);
  };

  const goToProfile = (userId: string) => {
    setMenuVisible(false);
    router.push(`/user-profile/${userId}`);
  };

  const deleteConversation = async (userId: string) => {
    setMenuVisible(false);
    
    Alert.alert(
      'حذف گفتگو',
      'آیا از حذف این گفتگو مطمئن هستید؟',
      [
        { text: 'انصراف', style: 'cancel' },
        {
          text: 'حذف',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('messages')
                .delete()
                .or(`and(sender_id.eq.${currentUser?.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${currentUser?.id})`);
              
              if (error) throw error;
              
              setConversations(prev => prev.filter(c => c.user.id !== userId));
              Alert.alert('موفق', 'گفتگو با موفقیت حذف شد');
            } catch (error) {
              console.error(error);
              Alert.alert('خطا', 'مشکلی در حذف گفتگو پیش آمد');
            }
          }
        }
      ]
    );
  };

  const pinConversation = (userId: string) => {
    setMenuVisible(false);
    Alert.alert('پین', 'این قابلیت به زودی اضافه می‌شود');
  };

  const handleLongPress = (event: any, user: User) => {
    const { pageX, pageY } = event.nativeEvent;
    setMenuPosition({ x: pageX - 120, y: pageY - 60 });
    setSelectedUser(user);
    setMenuVisible(true);
    
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 7,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeMenu = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 0.95,
        friction: 7,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setMenuVisible(false);
      setSelectedUser(null);
    });
  };

  // FAB Menu functions
  const toggleFabMenu = () => {
    if (fabMenuVisible) {
      Animated.parallel([
        Animated.timing(fabFadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.spring(fabScaleAnim, {
          toValue: 0,
          friction: 7,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(rotateAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => setFabMenuVisible(false));
    } else {
      setFabMenuVisible(true);
      Animated.parallel([
        Animated.timing(fabFadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(fabScaleAnim, {
          toValue: 1,
          friction: 7,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  };

  const createGroup = () => {
    toggleFabMenu();
    setCreateGroupVisible(true);
  };

  const joinGroup = () => {
    toggleFabMenu();
    setJoinGroupVisible(true);
  };

  const loadGroups = async () => {
    if (!currentUser) return;
    const { data } = await supabase
      .from('group_members')
      .select('group_id, groups(*)')
      .eq('user_id', currentUser.id);
    if (data) {
      const g = data.map((d: any) => d.groups).filter(Boolean);
      setGroups(g);
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim() || !currentUser) return;
    setGroupLoading(true);
    try {
      const { data: group, error } = await supabase
        .from('groups')
        .insert({
          name: newGroupName.trim(),
          description: newGroupDesc.trim() || null,
          owner_id: currentUser.id,
        })
        .select()
        .single();
      if (error) throw error;
      // add owner as member
      await supabase.from('group_members').insert({
        group_id: group.id,
        user_id: currentUser.id,
        role: 'owner',
      });
      setCreateGroupVisible(false);
      setNewGroupName('');
      setNewGroupDesc('');
      loadGroups();
      router.push(`/group/${group.id}`);
    } catch (e: any) {
      Alert.alert('خطا', e.message ?? 'مشکلی پیش آمد');
    } finally {
      setGroupLoading(false);
    }
  };

  const handleJoinGroup = async () => {
    if (!joinCode.trim() || !currentUser) return;
    setGroupLoading(true);
    try {
      const { data: group, error } = await supabase
        .from('groups')
        .select('*')
        .eq('invite_code', joinCode.trim().toUpperCase())
        .single();
      if (error || !group) {
        Alert.alert('خطا', 'گروهی با این کد یافت نشد');
        setGroupLoading(false);
        return;
      }
      // check already member
      const { data: existing } = await supabase
        .from('group_members')
        .select('id')
        .eq('group_id', group.id)
        .eq('user_id', currentUser.id)
        .single();
      if (existing) {
        setJoinGroupVisible(false);
        setJoinCode('');
        router.push(`/group/${group.id}`);
        return;
      }
      const { error: joinError } = await supabase.from('group_members').insert({
        group_id: group.id,
        user_id: currentUser.id,
        role: 'member',
      });
      if (joinError) throw joinError;
      setJoinGroupVisible(false);
      setJoinCode('');
      loadGroups();
      router.push(`/group/${group.id}`);
    } catch (e: any) {
      Alert.alert('خطا', e.message ?? 'مشکلی پیش آمد');
    } finally {
      setGroupLoading(false);
    }
  };

  useEffect(() => {
    loadConversations();
    loadGroups();

    const channel = supabase
      .channel('messages-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'messages' }, 
        () => loadConversations()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentUser]);

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 86400000) {
      return date.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString('fa-IR', { month: 'numeric', day: 'numeric' });
    }
  };

  const getLastMessageText = (message: Message | null) => {
    if (!message) return 'شروع گفتگو';
    
    if (message.media_type && message.media_type !== 'TEXT') {
      const mediaIcons = {
        IMAGE: '📷 عکس',
        VIDEO: '🎥 ویدیو',
        AUDIO: '🎵 پیام صوتی',
        FILE: '📎 فایل',
      };
      return mediaIcons[message.media_type as keyof typeof mediaIcons] || '📎 رسانه';
    }
    
    return message.content || 'پیام';
  };

  const filteredConversations = conversations.filter(c =>
    (c.user.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.user.username?.toLowerCase().includes(search.toLowerCase()))
  );

  const renderGroupItem = (group: Group) => (
    <TouchableOpacity
      key={group.id}
      style={styles.convItem}
      onPress={() => router.push(`/group/${group.id}`)}
      activeOpacity={0.7}
    >
      <View style={[styles.groupAvatar, { backgroundColor: '#7c6af7' }]}>
        <Ionicons name="people" size={24} color="#fff" />
      </View>
      <View style={styles.convInfo}>
        <View style={styles.convHeader}>
          <Text style={styles.convName} numberOfLines={1}>{group.name}</Text>
          <View style={styles.groupBadge}>
            <Text style={styles.groupBadgeText}>گروه</Text>
          </View>
        </View>
        <Text style={styles.convLast} numberOfLines={1}>
          {group.description ?? 'بدون توضیحات'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderConversation = ({ item }: { item: ConversationItem }) => (
    <TouchableOpacity 
      style={styles.convItem} 
      onPress={() => goToChat(item.user.id)}
      onLongPress={(event) => handleLongPress(event, item.user)}
      delayLongPress={500}
      activeOpacity={0.7}
    >
      <UserAvatar
        name={item.user.name}
        username={item.user.username}
        avatarColor={item.user.avatar_color}
        avatarUrl={(item.user as any).avatar_url}
        size={52}
        showOnline
        isOnline={item.user.is_online}
      />
      <View style={styles.convInfo}>
        <View style={styles.convHeader}>
          <Text style={styles.convName} numberOfLines={1}>
            {item.user.name ?? item.user.username}
          </Text>
          {item.lastMessage?.created_at && (
            <Text style={styles.convTime}>
              {formatTime(item.lastMessage.created_at)}
            </Text>
          )}
        </View>
        <Text style={styles.convLast} numberOfLines={1}>
          {getLastMessageText(item.lastMessage)}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderSearchResult = ({ item }: { item: User }) => (
    <TouchableOpacity 
      style={styles.convItem} 
      onPress={() => goToChat(item.id)}
      onLongPress={(event) => handleLongPress(event, item)}
      delayLongPress={500}
      activeOpacity={0.7}
    >
      <UserAvatar
        name={item.name}
        username={item.username}
        avatarColor={item.avatar_color}
        avatarUrl={(item as any).avatar_url}
        size={52}
        showOnline
        isOnline={item.is_online}
      />
      <View style={styles.convInfo}>
        <Text style={styles.convName} numberOfLines={1}>
          {item.name ?? item.username}
        </Text>
        <Text style={styles.convUsername} numberOfLines={1}>
          @{item.username}
        </Text>
      </View>
      <View style={styles.messageBtn}>
        <Ionicons name="chatbubble-outline" size={20} color="#7c6af7" />
      </View>
    </TouchableOpacity>
  );

  const mainContent = () => {
    if (search.length > 0) {
      if (searching) return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#7c6af7" size="large" />
        </View>
      );
      if (searchResults.length === 0) return (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconContainer}>
            <Ionicons name="search-outline" size={56} color="#2a2a3e" />
          </View>
          <Text style={styles.emptyTitle}>کاربری یافت نشد</Text>
          <Text style={styles.emptySubtitle}>
            نام یا نام کاربری را بررسی کنید
          </Text>
        </View>
      );
      return (
        <FlatList
          data={searchResults}
          keyExtractor={(item) => item.id}
          renderItem={renderSearchResult}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        />
      );
    }
    
    if (loading) return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color="#7c6af7" size="large" />
      </View>
    );
    
    if (filteredConversations.length === 0 && groups.length === 0) return (
      <View style={styles.emptyState}>
        <View style={styles.emptyIconContainer}>
          <Ionicons name="chatbubbles-outline" size={56} color="#2a2a3e" />
        </View>
        <Text style={styles.emptyTitle}>هنوز گفتگویی ندارید</Text>
        <Text style={styles.emptySubtitle}>
          با جستجو شروع کنید
        </Text>
      </View>
    );

    return (
      <FlatList
        data={filteredConversations}
        keyExtractor={(item) => item.user.id}
        renderItem={renderConversation}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          groups.length > 0 ? (
            <View>
              {groups.map(renderGroupItem)}
            </View>
          ) : null
        }
      />
    );
  };

  const rotateInterpolate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <UserAvatar
            name={currentUser?.name}
            username={currentUser?.username}
            avatarColor={currentUser?.avatar_color}
            avatarUrl={(currentUser as any)?.avatar_url}
            size={40}
          />
          <Text style={styles.headerTitle}>گفتگوها</Text>
        </View>
        <TouchableOpacity style={styles.signOutBtn} onPress={signOut} activeOpacity={0.7}>
          <Ionicons name="log-out-outline" size={22} color="#ff3b30" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={18} color="#666" />
        <TextInput
          style={styles.searchInput}
          placeholder="جستجو..."
          placeholderTextColor="#666"
          value={search}
          onChangeText={searchUsers}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color="#666" />
          </TouchableOpacity>
        )}
      </View>

      {mainContent()}

      {/* FAB Menu Button */}
      <View style={[styles.fabContainer, { bottom: insets.bottom + 90 }]}>
        {/* Menu Items */}
        {fabMenuVisible && (
          <>
            {/* پیوستن به گروه — اولین آیتم بالای FAB */}
            <Animated.View
              style={[
                styles.fabMenuItem,
                {
                  opacity: fabFadeAnim,
                  transform: [{ scale: fabScaleAnim }],
                  bottom: 14,
                },
              ]}
            >
              <TouchableOpacity
                style={styles.fabMenuOption}
                onPress={joinGroup}
                activeOpacity={0.7}
              >
                <Ionicons name="enter-outline" size={22} color="#fff" />
                <Text style={styles.fabMenuText}>پیوستن به گروه</Text>
              </TouchableOpacity>
            </Animated.View>

            {/* ساخت گروه جدید — دومین آیتم بالاتر */}
            <Animated.View
              style={[
                styles.fabMenuItem,
                {
                  opacity: fabFadeAnim,
                  transform: [{ scale: fabScaleAnim }],
                  bottom: 130,
                },
              ]}
            >
              <TouchableOpacity
                style={styles.fabMenuOption}
                onPress={createGroup}
                activeOpacity={0.7}
              >
                <Ionicons name="people-outline" size={22} color="#fff" />
                <Text style={styles.fabMenuText}>ساخت گروه جدید</Text>
              </TouchableOpacity>
            </Animated.View>
          </>
        )}

        {/* Main FAB Button */}
        <TouchableOpacity
          style={styles.fabButton}
          onPress={toggleFabMenu}
          activeOpacity={0.8}
        >
          <Animated.View style={{ transform: [{ rotate: rotateInterpolate }] }}>
            <Ionicons name="add" size={28} color="#fff" />
          </Animated.View>
        </TouchableOpacity>
      </View>

      {/* Long Press Menu Modal */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="none"
        onRequestClose={closeMenu}
      >
        <TouchableWithoutFeedback onPress={closeMenu}>
          <View style={styles.modalOverlay}>
            <Animated.View 
              style={[
                styles.menuContainer,
                {
                  top: menuPosition.y,
                  left: menuPosition.x,
                  opacity: fadeAnim,
                  transform: [{ scale: scaleAnim }],
                },
              ]}
            >
              <View style={styles.menuHeader}>
                <UserAvatar
                  name={selectedUser?.name}
                  username={selectedUser?.username}
                  avatarColor={selectedUser?.avatar_color}
                  avatarUrl={(selectedUser as any)?.avatar_url}
                  size={40}
                />
                <View style={styles.menuHeaderText}>
                  <Text style={styles.menuUserName} numberOfLines={1}>
                    {selectedUser?.name ?? selectedUser?.username}
                  </Text>
                  {selectedUser?.username && (
                    <Text style={styles.menuUserUsername}>@{selectedUser.username}</Text>
                  )}
                </View>
              </View>
              
              <View style={styles.menuDivider} />
              
              <TouchableOpacity 
                style={styles.menuItem} 
                onPress={() => selectedUser && goToProfile(selectedUser.id)}
                activeOpacity={0.7}
              >
                <Ionicons name="person-outline" size={20} color="#7c6af7" />
                <Text style={styles.menuItemText}>مشاهده پروفایل</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.menuItem} 
                onPress={() => selectedUser && pinConversation(selectedUser.id)}
                activeOpacity={0.7}
              >
                <Ionicons name="pin-outline" size={20} color="#f7c46a" />
                <Text style={styles.menuItemText}>پین کردن</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.menuItem, styles.menuItemDanger]} 
                onPress={() => selectedUser && deleteConversation(selectedUser.id)}
                activeOpacity={0.7}
              >
                <Ionicons name="trash-outline" size={20} color="#e05555" />
                <Text style={[styles.menuItemText, styles.menuItemTextDanger]}>حذف گفتگو</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
      {/* Create Group Modal */}
      <Modal visible={createGroupVisible} transparent animationType="slide" onRequestClose={() => setCreateGroupVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setCreateGroupVisible(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.bottomSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>ساخت گروه جدید</Text>
            <TextInput
              style={styles.sheetInput}
              placeholder="نام گروه *"
              placeholderTextColor="#666"
              value={newGroupName}
              onChangeText={setNewGroupName}
              autoFocus
            />
            <TextInput
              style={styles.sheetInput}
              placeholder="توضیحات (اختیاری)"
              placeholderTextColor="#666"
              value={newGroupDesc}
              onChangeText={setNewGroupDesc}
            />
            <TouchableOpacity
              style={[styles.sheetBtn, (!newGroupName.trim() || groupLoading) && styles.sheetBtnDisabled]}
              onPress={handleCreateGroup}
              disabled={!newGroupName.trim() || groupLoading}
            >
              {groupLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.sheetBtnText}>ساخت گروه</Text>
              )}
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Join Group Modal */}
      <Modal visible={joinGroupVisible} transparent animationType="slide" onRequestClose={() => setJoinGroupVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setJoinGroupVisible(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.bottomSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>پیوستن به گروه</Text>
            <Text style={styles.sheetSubtitle}>کد دعوت گروه را وارد کنید</Text>
            <TextInput
              style={[styles.sheetInput, styles.codeInput]}
              placeholder="کد دعوت (مثال: AB12CD34)"
              placeholderTextColor="#666"
              value={joinCode}
              onChangeText={setJoinCode}
              autoCapitalize="characters"
              autoFocus
            />
            <TouchableOpacity
              style={[styles.sheetBtn, (!joinCode.trim() || groupLoading) && styles.sheetBtnDisabled]}
              onPress={handleJoinGroup}
              disabled={!joinCode.trim() || groupLoading}
            >
              {groupLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.sheetBtnText}>پیوستن</Text>
              )}
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
    backgroundColor: '#0f0f1a',
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a2e',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  signOutBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    margin: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#13131f',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e1e30',
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 15,
    padding: 0,
  },
  listContent: {
    paddingBottom: 20,
  },
  convItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 14,
    backgroundColor: '#0f0f1a',
    borderBottomWidth: 0.5,
    borderBottomColor: '#1a1a2e',
  },
  convInfo: {
    flex: 1,
    gap: 4,
  },
  convHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  convName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#ffffff',
    flex: 1,
  },
  convUsername: {
    fontSize: 13,
    color: '#7c6af7',
  },
  convLast: {
    fontSize: 13,
    color: '#666',
  },
  convTime: {
    fontSize: 11,
    color: '#666',
  },
  messageBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  // FAB Styles
  fabContainer: {
    position: 'absolute',
    right: 20,
    alignItems: 'center',
  },
  fabButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#7c6af7',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#7c6af7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  fabMenuItem: {
    position: 'absolute',
    right: 0,
    alignItems: 'center',
  },
  fabMenuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#13131f',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#1e1e30',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  fabMenuText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  // Long Press Menu Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  menuContainer: {
    position: 'absolute',
    width: 240,
    backgroundColor: '#13131f',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1e1e30',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
    overflow: 'hidden',
  },
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  menuHeaderText: {
    flex: 1,
  },
  menuUserName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  menuUserUsername: {
    fontSize: 11,
    color: '#7c6af7',
    marginTop: 2,
  },
  menuDivider: {
    height: 0.5,
    backgroundColor: '#1e1e30',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  menuItemDanger: {
    borderTopWidth: 0.5,
    borderTopColor: '#1e1e30',
  },
  menuItemText: {
    fontSize: 14,
    color: '#e0e0e0',
  },
  menuItemTextDanger: {
    color: '#e05555',
  },
  groupAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupBadge: {
    backgroundColor: '#1e1e30',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 6,
  },
  groupBadgeText: {
    color: '#7c6af7',
    fontSize: 10,
    fontWeight: '600',
  },
  // Bottom Sheet styles
  bottomSheet: {
    backgroundColor: '#0f0f1a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    gap: 12,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#2a2a3e',
    alignSelf: 'center',
    marginBottom: 8,
  },
  sheetTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  sheetSubtitle: {
    color: '#666',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 4,
  },
  sheetInput: {
    backgroundColor: '#13131f',
    color: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#1e1e30',
  },
  codeInput: {
    letterSpacing: 2,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
  },
  sheetBtn: {
    backgroundColor: '#7c6af7',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
  },
  sheetBtnDisabled: {
    opacity: 0.5,
  },
  sheetBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});