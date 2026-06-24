import AudioMessage from '@/components/audio-message';
import { supabase } from '@/config/supabase';
import { useAuth } from '@/context/auth-context';
import { Group, GroupMember, Message } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ExpoFS from 'expo-file-system/legacy';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Clipboard,
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function GroupChatScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const { currentUser } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [group, setGroup] = useState<Group | null>(null);
  const [myRole, setMyRole] = useState<GroupMember['role'] | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [groupLoading, setGroupLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [previewMedia, setPreviewMedia] = useState<{ uri: string; type: string } | null>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [pinnedMessage, setPinnedMessage] = useState<Message | null>(null);
  
  const flatListRef = useRef<FlatList>(null);
  const textInputRef = useRef<TextInput>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canSendMessage = () => {
    if (groupLoading) return true;
    if (!group) return true;
    if (myRole === 'owner' || myRole === 'admin') return true;
    return group.can_members_send_messages;
  };

  const canSendMedia = () => {
    if (groupLoading) return true;
    if (!group) return true;
    if (myRole === 'owner' || myRole === 'admin') return true;
    return group.can_members_send_media;
  };

  const loadGroup = async () => {
    const { data } = await supabase.from('groups').select('*').eq('id', groupId).single();
    if (data) setGroup(data as Group);
    setGroupLoading(false);
  };

  const loadMyRole = async () => {
    if (!currentUser) return;
    const { data } = await supabase
      .from('group_members')
      .select('role')
      .eq('group_id', groupId)
      .eq('user_id', currentUser.id)
      .single();
    if (data) setMyRole(data.role as GroupMember['role']);
  };

  // حذف console.log های debug از production
  const loadMessages = async () => {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('group_id', groupId)
      .order('timestamp', { ascending: true });
    if (data) {
      setMessages(data as Message[]);
    }
    setLoading(false);
  };

  const loadPinnedMessage = async () => {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('group_id', groupId)
      .eq('is_pinned', true)
      .single();
    
    if (data) {
      setPinnedMessage(data as Message);
    } else {
      setPinnedMessage(null);
    }
  };

  const handleLongPress = (message: Message) => {
    setSelectedMessage(message);
    setActionSheetVisible(true);
  };

  const handleCopy = async () => {
    if (!selectedMessage?.content) return;
    try {
      if (Platform.OS === 'web') {
        await navigator.clipboard.writeText(selectedMessage.content);
      } else {
        Clipboard.setString(selectedMessage.content);
      }
      setActionSheetVisible(false);
      setSelectedMessage(null);
      Alert.alert('کپی شد', 'متن پیام کپی شد');
    } catch {
      Alert.alert('خطا', 'کپی ناموفق بود');
    }
  };

  const handleReply = () => {
    if (!selectedMessage) return;
    setReplyTo(selectedMessage);
    setActionSheetVisible(false);
    setSelectedMessage(null);
    setTimeout(() => {
      textInputRef.current?.focus();
    }, 100);
  };

  const handlePin = async () => {
    if (!selectedMessage || (myRole !== 'owner' && myRole !== 'admin')) {
      Alert.alert('خطا', 'فقط مدیران و مالک گروه می‌توانند پیام را سنجاق کنند');
      return;
    }

    try {
      if (pinnedMessage) {
        await supabase
          .from('messages')
          .update({ is_pinned: false })
          .eq('id', pinnedMessage.id);
      }

      const { error } = await supabase
        .from('messages')
        .update({ is_pinned: true })
        .eq('id', selectedMessage.id);

      if (error) throw error;

      setMessages(prev => prev.map(msg => 
        msg.id === selectedMessage.id 
          ? { ...msg, is_pinned: true }
          : { ...msg, is_pinned: false }
      ));
      
      setPinnedMessage({ ...selectedMessage, is_pinned: true });
      setActionSheetVisible(false);
      setSelectedMessage(null);
      
      Alert.alert('موفق', 'پیام سنجاق شد');
    } catch (error) {
      console.error('Pin error:', error);
      Alert.alert('خطا', 'امکان سنجاق پیام وجود ندارد');
    }
  };

  const handleDelete = async () => {
    if (!selectedMessage) return;
    
    const canDelete = selectedMessage.sender_id === currentUser?.id || 
                      myRole === 'owner' || 
                      myRole === 'admin';
    
    if (!canDelete) {
      Alert.alert('خطا', 'شما مجاز به حذف این پیام نیستید');
      return;
    }

    Alert.alert(
      'حذف پیام',
      'آیا از حذف این پیام اطمینان دارید؟',
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
                .eq('id', selectedMessage.id);

              if (error) throw error;

              setMessages(prev => prev.filter(msg => msg.id !== selectedMessage.id));
              
              if (pinnedMessage?.id === selectedMessage.id) {
                setPinnedMessage(null);
              }
              
              if (replyTo?.id === selectedMessage.id) {
                setReplyTo(null);
              }
              
              setActionSheetVisible(false);
              setSelectedMessage(null);
            } catch (error) {
              console.error('Delete error:', error);
              Alert.alert('خطا', 'امکان حذف پیام وجود ندارد');
            }
          },
        },
      ]
    );
  };

  const cancelReply = () => {
    setReplyTo(null);
  };

  useEffect(() => {
    loadGroup();
    loadMyRole();
    loadMessages();
    loadPinnedMessage();

    const channel = supabase
      .channel(`group-${groupId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const msg = payload.new as Message;
        if (msg.group_id !== groupId) return;
        if (msg.sender_id === currentUser?.id) return;
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (payload) => {
        const updatedMsg = payload.new as Message;
        if (updatedMsg.group_id !== groupId) return;
        setMessages(prev => prev.map(msg => 
          msg.id === updatedMsg.id ? updatedMsg : msg
        ));
        if (updatedMsg.is_pinned) {
          setPinnedMessage(updatedMsg);
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, (payload) => {
        const oldMsg = payload.old as Message;
        setMessages(prev => prev.filter(msg => msg.id !== oldMsg.id));
        if (pinnedMessage?.id === oldMsg.id) {
          setPinnedMessage(null);
        }
        if (replyTo?.id === oldMsg.id) {
          setReplyTo(null);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [groupId, currentUser]);

  const sendMessage = async () => {
    if (!text.trim() || !currentUser || !canSendMessage()) return;
    const msgText = text.trim();
    setText('');

    const newMsg: any = {
      sender_id: currentUser.id,
      sender_name: currentUser.name,
      sender_username: currentUser.username,
      group_id: groupId,
      receiver_id: null,
      content: msgText,
      media_type: 'TEXT',
      timestamp: Date.now(),
    };

    const replyData = replyTo ? {
      reply_to_id: replyTo.id,
      reply_to_content: replyTo.content || (replyTo.media_type !== 'TEXT' ? 'رسانه' : 'پیام'),
      reply_to_sender: replyTo.sender_name || replyTo.sender_username
    } : null;

    if (replyData) {
      newMsg.reply_to_id = replyData.reply_to_id;
      newMsg.reply_to_content = replyData.reply_to_content;
      newMsg.reply_to_sender = replyData.reply_to_sender;
    }

    const savedReplyTo = replyTo;
    setReplyTo(null);

    const { data, error } = await supabase.from('messages').insert(newMsg).select().single();
    if (error) {
      console.error('Send error:', error.message, error.code);
      Alert.alert('خطا', error.message);
      if (savedReplyTo) setReplyTo(savedReplyTo);
    } else if (data) {
      const newMessage = { ...(data as Message), ...replyData };
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMessage.id)) return prev;
        return [...prev, newMessage];
      });
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
    }
  };

  const uploadFile = async (uri: string, mimeType: string, fileName: string): Promise<string | null> => {
    try {
      const ext = fileName.split('.').pop() ?? 'bin';
      const path = `group/${groupId}/${Date.now()}.${ext}`;
      let bytes: Uint8Array;
      if (Platform.OS === 'web') {
        const res = await fetch(uri);
        bytes = new Uint8Array(await res.arrayBuffer());
      } else {
        const base64 = await ExpoFS.readAsStringAsync(uri, { encoding: ExpoFS.EncodingType.Base64 });
        const bin = atob(base64);
        bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      }
      const { error } = await supabase.storage.from('media').upload(path, bytes, { contentType: mimeType });
      if (error) { Alert.alert('خطا', error.message); return null; }
      return supabase.storage.from('media').getPublicUrl(path).data.publicUrl;
    } catch (e: any) {
      Alert.alert('خطا', e?.message ?? 'آپلود ناموفق');
      return null;
    }
  };

  const sendMediaMessage = async (mediaUrl: string, mediaType: 'IMAGE' | 'VIDEO' | 'FILE', fileName?: string) => {
    if (!currentUser) return;
    
    const newMsg: any = {
      sender_id: currentUser.id,
      sender_name: currentUser.name,
      sender_username: currentUser.username,
      group_id: groupId,
      receiver_id: null,
      content: fileName ?? null,
      media_type: mediaType,
      media_uri: mediaUrl,
      timestamp: Date.now(),
    };

    const replyData = replyTo ? {
      reply_to_id: replyTo.id,
      reply_to_content: replyTo.content || (replyTo.media_type !== 'TEXT' ? 'رسانه' : 'پیام'),
      reply_to_sender: replyTo.sender_name || replyTo.sender_username
    } : null;

    if (replyData) {
      newMsg.reply_to_id = replyData.reply_to_id;
      newMsg.reply_to_content = replyData.reply_to_content;
      newMsg.reply_to_sender = replyData.reply_to_sender;
    }

    const savedReplyTo = replyTo;
    setReplyTo(null);

    const { data, error } = await supabase.from('messages').insert(newMsg).select().single();
    if (error) { 
      Alert.alert('خطا', 'پیام ارسال نشد');
      if (savedReplyTo) setReplyTo(savedReplyTo);
      return; 
    }
    if (data) {
      const newMessage = { ...(data as Message), ...replyData };
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMessage.id)) return prev;
        return [...prev, newMessage];
      });
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
    }
  };

  const pickImage = async () => {
    setShowAttachMenu(false);
    if (!canSendMedia()) { Alert.alert('محدودیت', 'ارسال رسانه در این گروه غیرفعال است'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setUploading(true);
    const url = await uploadFile(asset.uri, asset.mimeType ?? 'image/jpeg', asset.fileName ?? `img_${Date.now()}.jpg`);
    setUploading(false);
    if (url) await sendMediaMessage(url, 'IMAGE', asset.fileName ?? 'عکس');
  };

  const pickVideo = async () => {
    setShowAttachMenu(false);
    if (!canSendMedia()) { Alert.alert('محدودیت', 'ارسال رسانه در این گروه غیرفعال است'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], quality: 0.8 });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setUploading(true);
    const url = await uploadFile(asset.uri, asset.mimeType ?? 'video/mp4', asset.fileName ?? `vid_${Date.now()}.mp4`);
    setUploading(false);
    if (url) await sendMediaMessage(url, 'VIDEO', asset.fileName ?? 'ویدیو');
  };

  const pickFile = async () => {
    setShowAttachMenu(false);
    if (!canSendMedia()) { Alert.alert('محدودیت', 'ارسال رسانه در این گروه غیرفعال است'); return; }
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setUploading(true);
    const url = await uploadFile(asset.uri, asset.mimeType ?? 'application/octet-stream', asset.name);
    setUploading(false);
    if (url) await sendMediaMessage(url, 'FILE', asset.name);
  };

  const pickMusic = async () => {
    setShowAttachMenu(false);
    if (!canSendMedia()) { Alert.alert('محدودیت', 'ارسال رسانه در این گروه غیرفعال است'); return; }
    await MediaLibrary.requestPermissionsAsync();
    const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setUploading(true);
    const url = await uploadFile(asset.uri, asset.mimeType ?? 'audio/mpeg', asset.name);
    setUploading(false);
    if (url) await sendMediaMessage(url, 'AUDIO' as any, asset.name);
  };

  const PinnedMessageBanner = () => {
    if (!pinnedMessage) return null;
    
    return (
      <TouchableOpacity 
        style={styles.pinnedBanner}
        onPress={() => {
          const index = messages.findIndex(m => m.id === pinnedMessage.id);
          if (index !== -1) {
            flatListRef.current?.scrollToIndex({ index, animated: true });
          }
        }}
      >
        <Ionicons name="pin" size={16} color="#7c6af7" />
        <View style={{ flex: 1 }}>
          <Text style={styles.pinnedBannerTitle}>پیام سنجاق شده</Text>
          <Text style={styles.pinnedBannerContent} numberOfLines={1}>
            {pinnedMessage.sender_name}: {pinnedMessage.content || (pinnedMessage.media_type !== 'TEXT' ? 'رسانه' : '')}
          </Text>
        </View>
        {(myRole === 'owner' || myRole === 'admin') && (
          <TouchableOpacity 
            onPress={async () => {
              await supabase
                .from('messages')
                .update({ is_pinned: false })
                .eq('id', pinnedMessage.id);
              setPinnedMessage(null);
              setMessages(prev => prev.map(msg => 
                msg.id === pinnedMessage.id ? { ...msg, is_pinned: false } : msg
              ));
            }}
          >
            <Ionicons name="close" size={20} color="#666" />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  const ReplyBanner = () => {
    if (!replyTo) return null;
    
    return (
      <View style={styles.replyBanner}>
        <View style={{ flex: 1 }}>
          <Text style={styles.replyBannerTitle}>
            پاسخ به {replyTo.sender_name || replyTo.sender_username}
          </Text>
          <Text style={styles.replyBannerContent} numberOfLines={1}>
            {replyTo.content || (replyTo.media_type !== 'TEXT' ? 'رسانه' : '')}
          </Text>
        </View>
        <TouchableOpacity onPress={cancelReply}>
          <Ionicons name="close" size={20} color="#666" />
        </TouchableOpacity>
      </View>
    );
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMine = item.sender_id === currentUser?.id;
    const isPinned = item.is_pinned;

    const webHandlers = Platform.OS === 'web' ? {
      onMouseDown: () => {
        longPressTimer.current = setTimeout(() => {
          handleLongPress(item);
        }, 500);
      },
      onMouseUp: () => {
        if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }
      },
      onMouseLeave: () => {
        if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }
      },
    } : {};

    return (
      <TouchableOpacity
        onLongPress={() => handleLongPress(item)}
        delayLongPress={500}
        activeOpacity={0.85}
        {...(webHandlers as any)}
      >
        <View style={[styles.msgRow, isMine ? styles.msgRowRight : styles.msgRowLeft]}>
          {isPinned && (
            <View style={styles.pinnedBadge}>
              <Ionicons name="pin" size={12} color="#7c6af7" />
            </View>
          )}
          <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}>
            {!isMine && (
              <Text style={styles.senderName}>
                {item.sender_name ?? item.sender_username ?? 'کاربر'}
              </Text>
            )}

            {/* Reply indicator */}
            {item.reply_to_id && (
              <View style={[styles.replyPreview, isMine ? styles.replyPreviewMine : styles.replyPreviewOther]}>
                <Ionicons name="return-up-back" size={12} color={isMine ? 'rgba(255,255,255,0.7)' : '#7c6af7'} />
                <Text style={[styles.replyPreviewText, isMine ? styles.replyPreviewTextMine : styles.replyPreviewTextOther]} numberOfLines={2}>
                  {item.reply_to_sender ? `${item.reply_to_sender}: ` : ''}
                  {item.reply_to_content || 'رسانه'}
                </Text>
              </View>
            )}

            {item.media_type === 'IMAGE' && item.media_uri ? (
              <TouchableOpacity onPress={() => setPreviewMedia({ uri: item.media_uri!, type: 'IMAGE' })}>
                <Image source={{ uri: item.media_uri }} style={styles.mediaImage} contentFit="cover" cachePolicy="memory-disk" />
              </TouchableOpacity>
            ) : item.media_type === 'VIDEO' && item.media_uri ? (
              <TouchableOpacity style={styles.videoThumb} onPress={() => setPreviewMedia({ uri: item.media_uri!, type: 'VIDEO' })}>
                <Ionicons name="play-circle" size={48} color="#fff" />
                <Text style={styles.videoLabel}>{item.content ?? 'ویدیو'}</Text>
              </TouchableOpacity>
            ) : item.media_type === 'AUDIO' && item.media_uri ? (
              <AudioMessage uri={item.media_uri} title={item.content ?? undefined} isMine={isMine} />
            ) : item.media_type === 'FILE' && item.media_uri ? (
              <TouchableOpacity style={styles.fileRow} onPress={() => Alert.alert('فایل', item.content ?? item.media_uri!)}>
                <Ionicons name="document-attach" size={28} color="#7c6af7" />
                <Text style={styles.fileName} numberOfLines={1}>{item.content ?? 'فایل'}</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.bubbleText}>{item.content}</Text>
            )}
            <Text style={styles.bubbleTime}>
              {item.timestamp ? new Date(item.timestamp).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }) : ''}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.headerInfo} onPress={() => router.push(`/group/settings/${groupId}`)} activeOpacity={0.8}>
          {group?.avatar_url ? (
            <Image source={{ uri: group.avatar_url }} style={styles.groupAvatarImg} contentFit="cover" />
          ) : (
            <View style={styles.groupAvatarPlaceholder}>
              <Ionicons name="people" size={20} color="#fff" />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.headerName} numberOfLines={1}>{group?.name ?? '...'}</Text>
            <Text style={styles.headerSub} numberOfLines={1}>
              {group?.description ?? 'گروه'}
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.settingsBtn} onPress={() => router.push(`/group/settings/${groupId}`)}>
          <Ionicons name="settings-outline" size={22} color="#7c6af7" />
        </TouchableOpacity>
      </View>

      <PinnedMessageBanner />

      {loading ? (
        <ActivityIndicator style={{ flex: 1 }} color="#7c6af7" size="large" />
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderMessage}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={<Text style={styles.emptyText}>هنوز پیامی نیست...</Text>}
        />
      )}

      {uploading && (
        <View style={styles.uploadingBar}>
          <ActivityIndicator color="#7c6af7" size="small" />
          <Text style={styles.uploadingText}>در حال آپلود...</Text>
        </View>
      )}

      <ReplyBanner />

      {canSendMessage() ? (
        <View style={[styles.inputContainer, { paddingBottom: insets.bottom }]}>
          <View style={styles.inputRow}>
            <TouchableOpacity style={styles.attachBtn} onPress={() => setShowAttachMenu(true)}>
              <Ionicons name="attach" size={24} color="#7c6af7" />
            </TouchableOpacity>
            <TextInput
              ref={textInputRef}
              style={styles.input}
              placeholder="پیام..."
              placeholderTextColor="#666"
              value={text}
              onChangeText={setText}
              multiline
              maxLength={1000}
            />
            <TouchableOpacity
              style={[styles.sendBtn, !text.trim() && styles.sendBtnDisabled]}
              onPress={sendMessage}
              disabled={!text.trim()}
            >
              <Ionicons name="send" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={[styles.restrictedBar, { paddingBottom: insets.bottom + 14 }]}>
          <Ionicons name="lock-closed" size={16} color="#666" />
          <Text style={styles.restrictedText}>ارسال پیام توسط ادمین محدود شده است</Text>
        </View>
      )}

      <Modal visible={showAttachMenu} transparent animationType="slide" onRequestClose={() => setShowAttachMenu(false)}>
        <TouchableOpacity style={styles.menuOverlay} onPress={() => setShowAttachMenu(false)} activeOpacity={1}>
          <View style={styles.attachMenu}>
            <Text style={styles.attachMenuTitle}>ارسال فایل</Text>
            <TouchableOpacity style={styles.attachItem} onPress={pickImage}>
              <Ionicons name="image" size={28} color="#6af7a0" />
              <Text style={styles.attachItemText}>عکس</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.attachItem} onPress={pickVideo}>
              <Ionicons name="videocam" size={28} color="#f7c46a" />
              <Text style={styles.attachItemText}>ویدیو</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.attachItem} onPress={pickFile}>
              <Ionicons name="document-attach" size={28} color="#6ac4f7" />
              <Text style={styles.attachItemText}>فایل</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.attachItem} onPress={pickMusic}>
              <Ionicons name="musical-notes" size={28} color="#c46af7" />
              <Text style={styles.attachItemText}>موزیک</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal 
        visible={actionSheetVisible} 
        transparent 
        animationType="slide" 
        onRequestClose={() => { setActionSheetVisible(false); setSelectedMessage(null); }}
      >
        <TouchableOpacity style={styles.menuOverlay} onPress={() => { setActionSheetVisible(false); setSelectedMessage(null); }} activeOpacity={1}>
          <View style={styles.actionSheet}>
            {selectedMessage?.content && selectedMessage.media_type === 'TEXT' && (
              <View style={styles.actionSheetPreview}>
                <Text style={styles.actionSheetPreviewText} numberOfLines={2}>
                  {selectedMessage.content}
                </Text>
              </View>
            )}

            <TouchableOpacity style={styles.actionSheetItem} onPress={handleReply}>
              <Ionicons name="return-up-back" size={22} color="#7c6af7" />
              <Text style={styles.actionSheetItemText}>پاسخ</Text>
            </TouchableOpacity>

            {selectedMessage?.content && selectedMessage.media_type === 'TEXT' && (
              <TouchableOpacity style={styles.actionSheetItem} onPress={handleCopy}>
                <Ionicons name="copy-outline" size={22} color="#6af7a0" />
                <Text style={styles.actionSheetItemText}>کپی متن</Text>
              </TouchableOpacity>
            )}

            {(myRole === 'owner' || myRole === 'admin') && !selectedMessage?.is_pinned && (
              <TouchableOpacity style={styles.actionSheetItem} onPress={handlePin}>
                <Ionicons name="pin" size={22} color="#f7c46a" />
                <Text style={styles.actionSheetItemText}>سنجاق کردن</Text>
              </TouchableOpacity>
            )}

            {(selectedMessage?.sender_id === currentUser?.id || myRole === 'owner' || myRole === 'admin') && (
              <TouchableOpacity style={[styles.actionSheetItem, styles.deleteItem]} onPress={handleDelete}>
                <Ionicons name="trash-bin" size={22} color="#ff4444" />
                <Text style={[styles.actionSheetItemText, styles.deleteText]}>حذف پیام</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.actionSheetCancel} onPress={() => { setActionSheetVisible(false); setSelectedMessage(null); }}>
              <Text style={styles.actionSheetCancelText}>انصراف</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={!!previewMedia} transparent animationType="fade" onRequestClose={() => setPreviewMedia(null)}>
        <View style={styles.previewModal}>
          <TouchableOpacity style={styles.closePreview} onPress={() => setPreviewMedia(null)}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          {previewMedia?.type === 'IMAGE' && (
            <Image source={{ uri: previewMedia.uri }} style={styles.previewImage} contentFit="contain" cachePolicy="memory-disk" />
          )}
          {previewMedia?.type === 'VIDEO' && (
            <View style={styles.videoPreviewPlaceholder}>
              <Ionicons name="play-circle" size={64} color="#fff" />
              <Text style={styles.videoPreviewText}>برای پخش ویدیو لینک را کپی کنید</Text>
            </View>
          )}
        </View>
      </Modal>
    </KeyboardAvoidingView>
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
  headerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  groupAvatarImg: { width: 40, height: 40, borderRadius: 20 },
  groupAvatarPlaceholder: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#7c6af7', justifyContent: 'center', alignItems: 'center',
  },
  headerName: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  headerSub: { color: '#666', fontSize: 11, marginTop: 1 },
  settingsBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  messagesList: { padding: 16, paddingBottom: 8 },
  msgRow: { marginBottom: 8, flexDirection: 'row', position: 'relative' },
  msgRowRight: { justifyContent: 'flex-end' },
  msgRowLeft: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '78%', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMine: { backgroundColor: '#7c6af7', borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: '#1a1a2e', borderBottomLeftRadius: 4 },
  senderName: { color: '#7c6af7', fontSize: 11, fontWeight: '600', marginBottom: 4 },
  bubbleText: { color: '#ffffff', fontSize: 15, lineHeight: 22 },
  bubbleTime: { color: 'rgba(255,255,255,0.5)', fontSize: 10, marginTop: 4, textAlign: 'right' },
  emptyText: { color: '#666', textAlign: 'center', marginTop: 80, fontSize: 14 },
  inputContainer: { backgroundColor: '#0f0f1a', borderTopWidth: 1, borderTopColor: '#1a1a2e' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  attachBtn: { padding: 8, justifyContent: 'center', alignItems: 'center' },
  input: {
    flex: 1, backgroundColor: '#13131f', color: '#ffffff',
    borderRadius: 24, paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 15, maxHeight: 100, textAlignVertical: 'center',
  },
  sendBtn: { backgroundColor: '#7c6af7', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { backgroundColor: '#2a2a3e' },
  restrictedBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: '#0f0f1a', borderTopWidth: 1, borderTopColor: '#1a1a2e',
    justifyContent: 'center',
  },
  restrictedText: { color: '#666', fontSize: 13 },
  uploadingBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#0f0f1a', borderTopWidth: 1, borderTopColor: '#1a1a2e' },
  uploadingText: { color: '#7c6af7', fontSize: 12 },
  mediaImage: { width: 200, height: 200, borderRadius: 12 },
  videoThumb: { width: 200, height: 130, backgroundColor: '#1a1a2e', borderRadius: 12, justifyContent: 'center', alignItems: 'center', gap: 6 },
  videoLabel: { color: '#666', fontSize: 11 },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#1a1a2e', borderRadius: 10, padding: 10, maxWidth: 220 },
  fileName: { color: '#666', fontSize: 13, flex: 1 },
  menuOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  attachMenu: { backgroundColor: '#0f0f1a', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 4 },
  attachMenuTitle: { color: '#666', fontSize: 12, fontWeight: '600', letterSpacing: 0.5, marginBottom: 8, textAlign: 'center' },
  attachItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#1a1a2e' },
  attachItemText: { color: '#ffffff', fontSize: 16 },
  previewModal: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  closePreview: { position: 'absolute', top: 52, right: 20, zIndex: 10, padding: 8 },
  previewImage: { width: '100%', height: '80%' },
  videoPreviewPlaceholder: { alignItems: 'center', gap: 16 },
  videoPreviewText: { color: '#aaa', fontSize: 13 },
  pinnedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    borderRadius: 12,
    gap: 10,
  },
  pinnedBannerTitle: { color: '#7c6af7', fontSize: 11, fontWeight: '600' },
  pinnedBannerContent: { color: '#aaa', fontSize: 12 },
  pinnedBadge: { position: 'absolute', left: -16, top: 8 },
  replyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 12,
    marginBottom: 8,
    borderRadius: 12,
    gap: 10,
  },
  replyBannerTitle: { color: '#7c6af7', fontSize: 11, fontWeight: '600' },
  replyBannerContent: { color: '#aaa', fontSize: 12 },
  replyPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 6,
    gap: 6,
  },
  replyPreviewMine: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(255,255,255,0.6)',
  },
  replyPreviewOther: {
    backgroundColor: 'rgba(124, 106, 247, 0.15)',
    borderLeftWidth: 2,
    borderLeftColor: '#7c6af7',
  },
  replyPreviewText: {
    fontSize: 11,
    flex: 1,
  },
  replyPreviewTextMine: {
    color: 'rgba(255,255,255,0.85)',
  },
  replyPreviewTextOther: {
    color: '#7c6af7',
  },
  actionSheet: {
    backgroundColor: '#0f0f1a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    gap: 8,
  },
  actionSheetPreview: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#7c6af7',
  },
  actionSheetPreviewText: { color: '#aaa', fontSize: 13, lineHeight: 18 },
  actionSheetItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 8, borderRadius: 12 },
  actionSheetItemText: { color: '#ffffff', fontSize: 16 },
  actionSheetCancel: { paddingVertical: 14, alignItems: 'center', marginTop: 8, borderTopWidth: 1, borderTopColor: '#1a1a2e' },
  actionSheetCancelText: { color: '#666', fontSize: 16 },
  deleteItem: { borderTopWidth: 1, borderTopColor: '#1a1a2e', marginTop: 4 },
  deleteText: { color: '#ff4444' },
});