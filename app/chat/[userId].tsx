import AudioMessage from '../../components/audio-message';
import UserAvatar from '../../components/user-avatar';
import { supabase } from '../../config/supabase';
import { useAuth } from '../../context/auth-context';
import { Message, User } from '../../types';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ExpoFS from 'expo-file-system/legacy';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
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
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ChatScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { currentUser } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([]);
  const [otherUser, setOtherUser] = useState<User | null>(null);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [previewMedia, setPreviewMedia] = useState<{ uri: string; type: string } | null>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadMessages = async () => {
    if (!currentUser || !userId) return;

    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(
        `and(sender_id.eq.${currentUser.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${currentUser.id})`
      )
      .order('timestamp', { ascending: true });

    if (data) setMessages(data as Message[]);
    setLoading(false);
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
      inputRef.current?.focus();
    }, 100);
  };

  const handleDelete = async () => {
    if (!selectedMessage) return;
    if (selectedMessage.sender_id !== currentUser?.id) {
      Alert.alert('خطا', 'فقط می‌توانید پیام خودتان را حذف کنید');
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

              if (replyTo?.id === selectedMessage.id) {
                setReplyTo(null);
              }

              setActionSheetVisible(false);
              setSelectedMessage(null);
            } catch (err) {
              console.error('Delete error:', err);
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
    supabase.from('users').select('*').eq('id', userId).single().then(({ data }) => {
      if (data) setOtherUser(data as User);
    });

    loadMessages();

    const channel = supabase
      .channel(`chat-${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const msg = payload.new as Message;
        if (
          (msg.sender_id === currentUser?.id && msg.receiver_id === userId) ||
          (msg.sender_id === userId && msg.receiver_id === currentUser?.id)
        ) {
          // پیام‌های خودم رو از channel نادیده بگیر - از insert response مستقیم handle می‌شن
          if (msg.sender_id === currentUser?.id) return;
          
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
          // اگه reply_to_id داره ولی content نداره، پیام کامل رو از دیتابیس بگیر
          if (msg.reply_to_id && !msg.reply_to_content) {
            supabase.from('messages').select('*').eq('id', msg.id).single().then(({ data }) => {
              if (data) {
                setMessages((prev) => prev.map((m) => m.id === data.id ? (data as Message) : m));
              }
            });
          }
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, (payload) => {
        const oldMsg = payload.old as Message;
        setMessages(prev => prev.filter(msg => msg.id !== oldMsg.id));
        if (replyTo?.id === oldMsg.id) {
          setReplyTo(null);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId, currentUser]);

  const sendMessage = async () => {
    if (!text.trim() || !currentUser || !userId) return;
    const msgText = text.trim();
    setText('');

    const newMsg: any = {
      sender_id: currentUser.id,
      sender_name: currentUser.name,
      sender_username: currentUser.username,
      receiver_id: userId,
      content: msgText,
      media_type: 'TEXT',
      timestamp: Date.now(),
    };

    // ذخیره اطلاعات ریپلای
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
      console.log('Send error:', error.message);
      if (savedReplyTo) setReplyTo(savedReplyTo);
      Alert.alert('خطا', 'ارسال پیام ناموفق بود');
    } else if (data) {
      const realMsg = { ...(data as Message), ...replyData };
      setMessages((prev) => {
        if (prev.some((m) => m.id === realMsg.id)) return prev;
        return [...prev, realMsg];
      });
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
    }
  };

  const sendMediaMessage = async (mediaUrl: string, mediaType: 'IMAGE' | 'VIDEO' | 'FILE', fileName?: string) => {
    if (!currentUser || !userId) return;
    
    const newMsg: any = {
      sender_id: currentUser.id,
      sender_name: currentUser.name,
      sender_username: currentUser.username,
      receiver_id: userId,
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

    const tempMsg = { ...newMsg, id: Date.now(), created_at: new Date().toISOString(), ...replyData } as Message;
    setMessages((prev) => [...prev, tempMsg]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
    
    const savedReplyTo = replyTo;
    setReplyTo(null);

    const { data, error } = await supabase.from('messages').insert(newMsg).select().single();
    if (error) {
      setMessages((prev) => prev.filter(m => m.id !== tempMsg.id));
      if (savedReplyTo) setReplyTo(savedReplyTo);
    } else if (data) {
      const realMsg = { ...(data as Message), ...replyData };
      setMessages((prev) => {
        const hasTempMsg = prev.some(m => m.id === tempMsg.id);
        if (hasTempMsg) return prev.map(m => m.id === tempMsg.id ? realMsg : m);
        return prev.map(m => m.id === realMsg.id ? realMsg : m);
      });
    }
  };

  const uploadFile = async (uri: string, mimeType: string, fileName: string): Promise<string | null> => {
    try {
      const ext = fileName.split('.').pop() ?? 'bin';
      const path = `chat/${currentUser!.id}/${Date.now()}.${ext}`;

      let bytes: Uint8Array;

      if (Platform.OS === 'web') {
        const response = await fetch(uri);
        const arrayBuffer = await response.arrayBuffer();
        bytes = new Uint8Array(arrayBuffer);
      } else {
        const base64 = await ExpoFS.readAsStringAsync(uri, {
          encoding: ExpoFS.EncodingType.Base64,
        });
        const binaryStr = atob(base64);
        bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
      }

      const { error } = await supabase.storage
        .from('media')
        .upload(path, bytes, { contentType: mimeType });

      if (error) {
        console.log('Upload error:', error.message);
        Alert.alert('خطای آپلود', error.message);
        return null;
      }

      const { data } = supabase.storage.from('media').getPublicUrl(path);
      return data.publicUrl;
    } catch (e: any) {
      console.log('Upload failed:', e?.message ?? e);
      Alert.alert('خطا', e?.message ?? 'آپلود ناموفق بود');
      return null;
    }
  };

  const pickImage = async () => {
    setShowAttachMenu(false);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setUploading(true);
    const mimeType = asset.mimeType ?? 'image/jpeg';
    const fileName = asset.fileName ?? `image_${Date.now()}.jpg`;
    const url = await uploadFile(asset.uri, mimeType, fileName);
    setUploading(false);
    if (url) await sendMediaMessage(url, 'IMAGE', fileName);
  };

  const pickVideo = async () => {
    setShowAttachMenu(false);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setUploading(true);
    const mimeType = asset.mimeType ?? 'video/mp4';
    const fileName = asset.fileName ?? `video_${Date.now()}.mp4`;
    const url = await uploadFile(asset.uri, mimeType, fileName);
    setUploading(false);
    if (url) await sendMediaMessage(url, 'VIDEO', fileName);
  };

  const pickFile = async () => {
    setShowAttachMenu(false);
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
    // اول سعی می‌کنیم از کتابخانه موزیک بگیریم
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status === 'granted') {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      setUploading(true);
      const url = await uploadFile(asset.uri, asset.mimeType ?? 'audio/mpeg', asset.name);
      setUploading(false);
      if (url) await sendMediaMessage(url, 'AUDIO' as any, asset.name);
    } else {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      setUploading(true);
      const url = await uploadFile(asset.uri, asset.mimeType ?? 'audio/mpeg', asset.name);
      setUploading(false);
      if (url) await sendMediaMessage(url, 'AUDIO' as any, asset.name);
    }
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
          <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}>
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
                <Image
                  source={{ uri: item.media_uri }}
                  style={styles.mediaImage}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
              </TouchableOpacity>
            ) : item.media_type === 'VIDEO' && item.media_uri ? (
              <TouchableOpacity
                style={styles.videoThumb}
                onPress={() => setPreviewMedia({ uri: item.media_uri!, type: 'VIDEO' })}
              >
                <Ionicons name="play-circle" size={48} color="#fff" />
                <Text style={styles.videoLabel}>{item.content ?? 'ویدیو'}</Text>
              </TouchableOpacity>
            ) : item.media_type === 'AUDIO' && item.media_uri ? (
              <AudioMessage uri={item.media_uri} title={item.content ?? undefined} isMine={isMine} />
            ) : item.media_type === 'FILE' && item.media_uri ? (
              <TouchableOpacity
                style={styles.fileRow}
                onPress={() => Alert.alert('فایل', item.content ?? item.media_uri!)}
              >
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
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#1a1a2e" />
        </TouchableOpacity>
        {otherUser && (
          <TouchableOpacity
            style={styles.headerUserInfo}
            onPress={() => router.push({ pathname: '/user-profile/[userId]', params: { userId: otherUser.id } })}
          >
            <UserAvatar
              name={otherUser.name}
              username={otherUser.username}
              avatarColor={otherUser.avatar_color}
              avatarUrl={(otherUser as any).avatar_url}
              size={40}
            />
            <View>
              <Text style={styles.headerName}>{otherUser.name ?? otherUser.username}</Text>
              <Text style={[styles.headerStatus, { color: otherUser.is_online ? '#3dd68c' : '#666' }]}>
                {otherUser.is_online ? 'آنلاین' : 'آفلاین'}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* Messages */}
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
          ListEmptyComponent={
            <Text style={styles.emptyText}>شروع مکالمه کنید...</Text>
          }
        />
      )}

      {/* Reply Banner */}
      <ReplyBanner />

      {/* Input */}
      <View style={[styles.inputContainer, { paddingBottom: insets.bottom }]}>
        <View style={styles.inputRow}>
          <TouchableOpacity style={styles.attachBtn} onPress={() => setShowAttachMenu(true)}>
            <Ionicons name="attach" size={24} color="#7c6af7" />
          </TouchableOpacity>
          <TextInput
            ref={inputRef}
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

      {/* Uploading indicator */}
      {uploading && (
        <View style={styles.uploadingBar}>
          <ActivityIndicator color="#7c6af7" size="small" />
          <Text style={styles.uploadingText}>در حال آپلود...</Text>
        </View>
      )}

      {/* Attach Menu */}
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

      {/* Action Sheet Modal */}
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

            {selectedMessage?.sender_id === currentUser?.id && (
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

      {/* Media Preview Modal */}
      <Modal visible={!!previewMedia} transparent animationType="fade" onRequestClose={() => setPreviewMedia(null)}>
        <View style={styles.previewModal}>
          <TouchableOpacity style={styles.closePreview} onPress={() => setPreviewMedia(null)}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          {previewMedia?.type === 'IMAGE' && (
            <Image
              source={{ uri: previewMedia.uri }}
              style={styles.previewImage}
              contentFit="contain"
              cachePolicy="memory-disk"
            />
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
  container: { 
    flex: 1, 
    backgroundColor: '#0a0a0f',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#0f0f1a',
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a2e',
    gap: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  headerUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  headerName: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  headerStatus: {
    fontSize: 11,
    marginTop: 1,
  },
  messagesList: {
    padding: 16,
    paddingBottom: 8,
  },
  msgRow: {
    marginBottom: 8,
    flexDirection: 'row',
  },
  msgRowRight: {
    justifyContent: 'flex-end',
  },
  msgRowLeft: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleMine: {
    backgroundColor: '#7c6af7',
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: '#1a1a2e',
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    color: '#ffffff',
    fontSize: 15,
    lineHeight: 22,
  },
  bubbleTime: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    marginTop: 4,
    textAlign: 'right',
  },
  emptyText: {
    color: '#666',
    textAlign: 'center',
    marginTop: 80,
    fontSize: 14,
  },
  inputContainer: {
    backgroundColor: '#0f0f1a',
    borderTopWidth: 1,
    borderTopColor: '#1a1a2e',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  attachBtn: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: '#13131f',
    color: '#ffffff',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 15,
    maxHeight: 100,
    textAlignVertical: 'center',
  },
  sendBtn: {
    backgroundColor: '#7c6af7',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#2a2a3e',
  },
  uploadingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#0f0f1a',
    borderTopWidth: 1,
    borderTopColor: '#1a1a2e',
  },
  uploadingText: {
    color: '#7c6af7',
    fontSize: 12,
  },
  mediaImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
  },
  videoThumb: {
    width: 200,
    height: 130,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  videoLabel: {
    color: '#666',
    fontSize: 11,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    padding: 10,
    maxWidth: 220,
  },
  fileName: {
    color: '#666',
    fontSize: 13,
    flex: 1,
  },
  menuOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  attachMenu: {
    backgroundColor: '#0f0f1a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 4,
  },
  attachMenuTitle: {
    color: '#666',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 8,
    textAlign: 'center',
  },
  attachItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a2e',
  },
  attachItemText: {
    color: '#ffffff',
    fontSize: 16,
  },
  previewModal: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closePreview: {
    position: 'absolute',
    top: 52,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  previewImage: {
    width: '100%',
    height: '80%',
  },
  videoPreviewPlaceholder: {
    alignItems: 'center',
    gap: 16,
  },
  videoPreviewText: {
    color: '#aaa',
    fontSize: 13,
  },
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
  replyBannerTitle: {
    color: '#7c6af7',
    fontSize: 11,
    fontWeight: '600',
  },
  replyBannerContent: {
    color: '#aaa',
    fontSize: 12,
  },
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
  actionSheetPreviewText: {
    color: '#aaa',
    fontSize: 13,
    lineHeight: 18,
  },
  actionSheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  actionSheetItemText: {
    color: '#ffffff',
    fontSize: 16,
  },
  actionSheetCancel: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#1a1a2e',
  },
  actionSheetCancelText: {
    color: '#666',
    fontSize: 16,
  },
  deleteItem: {
    backgroundColor: 'rgba(255, 68, 68, 0.08)',
  },
  deleteText: {
    color: '#ff4444',
  },
});