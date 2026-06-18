import AudioMessage from '@/components/audio-message';
import { supabase } from '@/config/supabase';
import { useAuth } from '@/context/auth-context';
import { useMusic } from '@/context/music-context';
import { Group, User } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import * as ExpoFS from 'expo-file-system/legacy';
import { useCallback, useRef, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ─── Types ───────────────────────────────────────────────────────────────────

type BotMessageType =
  | { kind: 'text'; text: string }
  | { kind: 'audio'; uri: string; title: string };

type ChatMessage = {
  id: string;
  role: 'user' | 'bot';
  content: BotMessageType;
  timestamp: number;
};

// ─── Intent Parser ────────────────────────────────────────────────────────────

type Intent =
  | { type: 'send_message'; targetName: string; messageText: string }
  | { type: 'read_messages'; targetName: string }
  | { type: 'play_music'; query?: string }
  | { type: 'send_current_track'; targetName: string; targetKind: 'user' | 'group' }
  | { type: 'unknown' };

function parseIntent(input: string): Intent {
  const t = input.trim();

  // ارسال پیام: "جواب X رو بده بگو Y" | "برای X پیام بده بگو Y" | "به X بگو Y"
  const sendPatterns = [
    /جواب\s+(.+?)\s+رو?\s+بده\s+بگو\s+(.+)/,
    /برای\s+(.+?)\s+پیام\s+بده\s+بگو\s+(.+)/,
    /به\s+(.+?)\s+بگو\s+(.+)/,
    /برای\s+(.+?)\s+بنویس\s+(.+)/,
    /پیام\s+بده\s+به\s+(.+?)\s+بگو\s+(.+)/,
  ];
  for (const pat of sendPatterns) {
    const m = t.match(pat);
    if (m) return { type: 'send_message', targetName: m[1].trim(), messageText: m[2].trim() };
  }

  // خواندن پیام: "X چی گفته" | "پیام X رو نشون بده"
  const readPatterns = [
    /(.+?)\s+چی\s+گفته/,
    /(.+?)\s+چه\s+گفته/,
    /پیام\s+(.+?)\s+رو?\s+نشون\s+بده/,
    /آخرین\s+پیام\s+(.+)/,
  ];
  for (const pat of readPatterns) {
    const m = t.match(pat);
    if (m) return { type: 'read_messages', targetName: m[1].trim() };
  }

  // پخش موزیک: "یه آهنگ بزار" | "موزیک پخش کن" | "بزار X"
  const playPatterns = [
    /یه?\s+آهنگ\s+بزار/,
    /موزیک\s+پخش\s+کن/,
    /آهنگ\s+پخش\s+کن/,
    /^بزار\s+(.+)/,
    /آهنگ\s+(.+?)\s+رو?\s+بزار/,
    /پخش\s+کن\s+(.+)/,
  ];
  for (const pat of playPatterns) {
    const m = t.match(pat);
    if (m) return { type: 'play_music', query: m[1]?.trim() };
  }

  // ارسال آهنگ جاری: "این آهنگ رو بفرست برای X"
  const sendTrackPatterns = [
    /این\s+آهنگ\s+رو?\s+بفرست\s+برای\s+(.+)/,
    /آهنگ\s+رو?\s+بفرست\s+برای\s+(.+)/,
    /بفرست\s+برای\s+(.+)/,
  ];
  for (const pat of sendTrackPatterns) {
    const m = t.match(pat);
    if (m) {
      const name = m[1].trim();
      // اگه "گروه" داشت → group
      const isGroup = /گروه/.test(name);
      return {
        type: 'send_current_track',
        targetName: name,
        targetKind: isGroup ? 'group' : 'user',
      };
    }
  }

  return { type: 'unknown' };
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ChatbotScreen() {
  const { currentUser } = useAuth();
  const { currentTrack, tracks, playTrack } = useMusic();
  const insets = useSafeAreaInsets();

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '0',
      role: 'bot',
      content: {
        kind: 'text',
        text: 'سلام! من دستیار هوشمند توام 👋\nمی‌تونم پیام بفرستم، آهنگ پخش کنم، آخرین پیام‌ها رو نشون بدم و آهنگ‌ها رو برات بفرستم.\n\nمثلاً بگو:\n• «جواب علی رو بده بگو سلام»\n• «علی چی گفته؟»\n• «یه آهنگ بزار»\n• «این آهنگ رو بفرست برای علی»',
      },
      timestamp: Date.now(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // ─── Helper: add bot message ───────────────────────────────────────────────

  const addBotMessage = useCallback((content: BotMessageType) => {
    const msg: ChatMessage = {
      id: Date.now().toString(),
      role: 'bot',
      content,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, msg]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  // ─── Helper: find user by name/username ───────────────────────────────────

  const findUser = async (name: string): Promise<User | null> => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .or(`name.ilike.%${name}%,username.ilike.%${name}%`)
      .neq('id', currentUser?.id ?? '')
      .limit(5);
    if (error) {
      addBotMessage({ kind: 'text', text: `خطا در جستجوی کاربر: ${error.message}` });
      return null;
    }
    if (!data || data.length === 0) {
      // اگه با ilike پیدا نشد، همه کاربران رو بگیر و لوکال فیلتر کن
      const { data: allUsers, error: e2 } = await supabase
        .from('users')
        .select('id, name, username, avatar_color')
        .neq('id', currentUser?.id ?? '')
        .limit(100);
      if (e2 || !allUsers) return null;
      const q = name.toLowerCase();
      const found = (allUsers as User[]).filter(
        (u) =>
          u.name?.toLowerCase().includes(q) ||
          u.username?.toLowerCase().includes(q)
      );
      if (found.length === 0) return null;
      const exact = found.find(
        (u) =>
          u.name?.toLowerCase() === q ||
          u.username?.toLowerCase() === q
      );
      return exact ?? found[0];
    }
    const exact = (data as User[]).find(
      (u) =>
        u.name?.toLowerCase() === name.toLowerCase() ||
        u.username?.toLowerCase() === name.toLowerCase()
    );
    return (exact ?? data[0]) as User;
  };

  // ─── Helper: find group by name ────────────────────────────────────────────

  const findGroup = async (name: string): Promise<Group | null> => {
    if (!currentUser) return null;
    const cleanName = name.replace(/گروه\s*/g, '').trim();
    const { data } = await supabase
      .from('group_members')
      .select('group_id, groups(*)')
      .eq('user_id', currentUser.id);
    if (!data) return null;
    const groups: Group[] = data.map((d: any) => d.groups).filter(Boolean);
    return (
      groups.find(
        (g) =>
          g.name.toLowerCase().includes(cleanName.toLowerCase()) ||
          cleanName.toLowerCase().includes(g.name.toLowerCase())
      ) ?? null
    );
  };

  // ─── Upload audio to supabase storage ─────────────────────────────────────

  const uploadAudio = async (uri: string, fileName: string): Promise<string | null> => {
    try {
      const path = `chat/${currentUser!.id}/${Date.now()}_${fileName}`;
      let bytes: Uint8Array;
      if (Platform.OS === 'web') {
        const res = await fetch(uri);
        bytes = new Uint8Array(await res.arrayBuffer());
      } else {
        const base64 = await ExpoFS.readAsStringAsync(uri, {
          encoding: ExpoFS.EncodingType.Base64,
        });
        const bin = atob(base64);
        bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      }
      const { error } = await supabase.storage
        .from('media')
        .upload(path, bytes, { contentType: 'audio/mpeg' });
      if (error) return null;
      return supabase.storage.from('media').getPublicUrl(path).data.publicUrl;
    } catch {
      return null;
    }
  };

  // ─── Action: send text message to user ────────────────────────────────────

  const actionSendMessage = async (targetName: string, messageText: string) => {
    const user = await findUser(targetName);
    if (!user) {
      addBotMessage({ kind: 'text', text: `کاربری با اسم «${targetName}» پیدا نکردم.` });
      return;
    }
    const { error } = await supabase.from('messages').insert({
      sender_id: currentUser!.id,
      sender_name: currentUser!.name,
      sender_username: currentUser!.username,
      receiver_id: user.id,
      content: messageText,
      media_type: 'TEXT',
      timestamp: Date.now(),
    });
    if (error) {
      addBotMessage({ kind: 'text', text: 'ارسال پیام ناموفق بود. دوباره امتحان کن.' });
    } else {
      addBotMessage({
        kind: 'text',
        text: `✅ پیام «${messageText}» برای ${user.name ?? user.username} فرستادم.`,
      });
    }
  };

  // ─── Action: read last message from user ──────────────────────────────────

  const actionReadMessages = async (targetName: string) => {
    const user = await findUser(targetName);
    if (!user) {
      addBotMessage({ kind: 'text', text: `کاربری با اسم «${targetName}» در دیتابیس پیدا نکردم.` });
      return;
    }

    // یه query کلی‌تر — هر پیامی که sender یا receiver این دو نفر باشن
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(
        `sender_id.eq.${user.id},receiver_id.eq.${user.id},sender_id.eq.${currentUser!.id},receiver_id.eq.${currentUser!.id}`
      )
      .is('group_id', null)
      .order('timestamp', { ascending: false })
      .limit(20);

    if (error) {
      addBotMessage({ kind: 'text', text: `خطا: ${error.message}` });
      return;
    }

    // فیلتر لوکال — فقط مکالمه بین این دو نفر
    const conversation = (data ?? []).filter((m: any) =>
      (m.sender_id === user.id && m.receiver_id === currentUser!.id) ||
      (m.sender_id === currentUser!.id && m.receiver_id === user.id)
    );

    if (conversation.length === 0) {
      addBotMessage({
        kind: 'text',
        text: `کاربر ${user.name ?? user.username} پیدا شد ولی پیامی بین شما نیست.\n\n(debug: sender_id جستجو: ${user.id.slice(0,8)}, currentUser: ${currentUser!.id.slice(0,8)})`,
      });
      return;
    }

    const sorted = conversation
      .sort((a: any, b: any) => (a.timestamp ?? 0) - (b.timestamp ?? 0))
      .slice(-5);

    const lines = sorted
      .map((m: any) => {
        const who = m.sender_id === currentUser!.id ? 'تو' : (user.name ?? user.username);
        const time = m.timestamp
          ? new Date(m.timestamp).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })
          : '';
        const content =
          m.media_type !== 'TEXT' ? `[${m.media_type === 'AUDIO' ? 'صوتی' : 'رسانه'}]` : m.content;
        return `${who} (${time}): ${content}`;
      })
      .join('\n');

    addBotMessage({ kind: 'text', text: `آخرین پیام‌های ${user.name ?? user.username}:\n\n${lines}` });
  };

  // ─── Action: play music ───────────────────────────────────────────────────

  const actionPlayMusic = async (query?: string) => {
    if (tracks.length === 0) {
      addBotMessage({ kind: 'text', text: 'آهنگی روی دستگاه پیدا نشد.' });
      return;
    }
    let track = tracks[0];
    if (query) {
      const q = query.toLowerCase();
      const found = tracks.find((t) => t.filename.toLowerCase().includes(q));
      if (found) track = found;
    }
    await playTrack(track);
    addBotMessage({ kind: 'text', text: `▶️ در حال پخش: ${track.filename}` });
  };

  // ─── Action: send current track to user or group ──────────────────────────

  const actionSendCurrentTrack = async (
    targetName: string,
    targetKind: 'user' | 'group'
  ) => {
    if (!currentTrack) {
      addBotMessage({ kind: 'text', text: 'الان هیچ آهنگی در حال پخش نیست.' });
      return;
    }

    addBotMessage({ kind: 'text', text: `⏳ در حال آپلود «${currentTrack.filename}»...` });

    const publicUrl = await uploadAudio(
      currentTrack.uri,
      `${currentTrack.filename.replace(/[^a-zA-Z0-9]/g, '_')}.mp3`
    );

    if (!publicUrl) {
      addBotMessage({ kind: 'text', text: 'آپلود آهنگ ناموفق بود.' });
      return;
    }

    if (targetKind === 'user') {
      const user = await findUser(targetName);
      if (!user) {
        addBotMessage({ kind: 'text', text: `کاربری با اسم «${targetName}» پیدا نکردم.` });
        return;
      }
      const { error } = await supabase.from('messages').insert({
        sender_id: currentUser!.id,
        sender_name: currentUser!.name,
        sender_username: currentUser!.username,
        receiver_id: user.id,
        content: currentTrack.filename,
        media_type: 'AUDIO',
        media_uri: publicUrl,
        timestamp: Date.now(),
      });
      if (error) {
        addBotMessage({ kind: 'text', text: 'ارسال آهنگ ناموفق بود.' });
      } else {
        addBotMessage({
          kind: 'text',
          text: `✅ آهنگ «${currentTrack.filename}» برای ${user.name ?? user.username} فرستاده شد.`,
        });
        addBotMessage({ kind: 'audio', uri: publicUrl, title: currentTrack.filename });
      }
    } else {
      // group
      const group = await findGroup(targetName);
      if (!group) {
        addBotMessage({ kind: 'text', text: `گروهی با اسم «${targetName}» پیدا نکردم.` });
        return;
      }
      const { error } = await supabase.from('messages').insert({
        sender_id: currentUser!.id,
        sender_name: currentUser!.name,
        sender_username: currentUser!.username,
        group_id: group.id,
        receiver_id: null,
        content: currentTrack.filename,
        media_type: 'AUDIO',
        media_uri: publicUrl,
        timestamp: Date.now(),
      });
      if (error) {
        addBotMessage({ kind: 'text', text: 'ارسال آهنگ به گروه ناموفق بود.' });
      } else {
        addBotMessage({
          kind: 'text',
          text: `✅ آهنگ «${currentTrack.filename}» در گروه «${group.name}» فرستاده شد.`,
        });
        addBotMessage({ kind: 'audio', uri: publicUrl, title: currentTrack.filename });
      }
    }
  };

  // ─── Process user input ───────────────────────────────────────────────────

  const processMessage = async (text: string) => {
    const intent = parseIntent(text);
    switch (intent.type) {
      case 'send_message':
        await actionSendMessage(intent.targetName, intent.messageText);
        break;
      case 'read_messages':
        await actionReadMessages(intent.targetName);
        break;
      case 'play_music':
        await actionPlayMusic(intent.query);
        break;
      case 'send_current_track':
        await actionSendCurrentTrack(intent.targetName, intent.targetKind);
        break;
      default:
        addBotMessage({
          kind: 'text',
          text: 'متوجه نشدم 🤔 می‌تونی اینطور بگی:\n\n• «جواب علی رو بده بگو سلام»\n• «علی چی گفته؟»\n• «یه آهنگ بزار»\n• «این آهنگ رو بفرست برای گروه دوستان»',
        });
    }
  };

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text) return;
    setInputText('');

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: { kind: 'text', text },
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);

    setIsThinking(true);
    await processMessage(text);
    setIsThinking(false);
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.msgRow, isUser ? styles.msgRowRight : styles.msgRowLeft]}>
        {!isUser && (
          <View style={styles.botAvatar}>
            <Ionicons name="sparkles" size={16} color="#fff" />
          </View>
        )}
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleBot]}>
          {item.content.kind === 'audio' ? (
            <AudioMessage uri={item.content.uri} title={item.content.title} isMine={isUser} />
          ) : (
            <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>
              {item.content.text}
            </Text>
          )}
          <Text style={styles.bubbleTime}>
            {new Date(item.timestamp).toLocaleTimeString('fa-IR', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
      </View>
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
        <View style={styles.headerAvatar}>
          <Ionicons name="sparkles" size={22} color="#fff" />
        </View>
        <View>
          <Text style={styles.headerTitle}>دستیار هوشمند</Text>
          <Text style={styles.headerSub}>آماده دستور</Text>
        </View>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={[styles.list, { paddingBottom: 120 }]}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
      />

      {/* Thinking indicator */}
      {isThinking && (
        <View style={styles.thinkingRow}>
          <View style={styles.botAvatar}>
            <Ionicons name="sparkles" size={16} color="#fff" />
          </View>
          <View style={styles.thinkingBubble}>
            <ActivityIndicator size="small" color="#7c6af7" />
            <Text style={styles.thinkingText}>در حال فکر کردن...</Text>
          </View>
        </View>
      )}

      {/* Suggestions */}
      <View style={styles.suggestions}>
        {['یه آهنگ بزار', 'این آهنگ رو بفرست برای ...', '... چی گفته؟'].map((s) => (
          <TouchableOpacity
            key={s}
            style={styles.chip}
            onPress={() => setInputText(s)}
            activeOpacity={0.7}
          >
            <Text style={styles.chipText}>{s}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Input */}
      <View style={[styles.inputContainer, { paddingBottom: insets.bottom + 85 }]}>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="دستور بده..."
            placeholderTextColor="#555"
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={handleSend}
            returnKeyType="send"
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim() || isThinking}
          >
            <Ionicons name="send" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: '#0f0f1a',
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a2e',
  },
  headerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#7c6af7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  headerSub: {
    color: '#3dd68c',
    fontSize: 12,
    marginTop: 2,
  },
  list: {
    padding: 16,
    gap: 8,
  },
  msgRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 8,
    gap: 8,
  },
  msgRowRight: {
    justifyContent: 'flex-end',
  },
  msgRowLeft: {
    justifyContent: 'flex-start',
  },
  botAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#7c6af7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleUser: {
    backgroundColor: '#7c6af7',
    borderBottomRightRadius: 4,
  },
  bubbleBot: {
    backgroundColor: '#1a1a2e',
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    color: '#ddd',
    fontSize: 14,
    lineHeight: 22,
  },
  bubbleTextUser: {
    color: '#fff',
  },
  bubbleTime: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 10,
    marginTop: 4,
    textAlign: 'right',
  },
  thinkingRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  thinkingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1a1a2e',
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  thinkingText: {
    color: '#555',
    fontSize: 13,
  },
  suggestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chip: {
    backgroundColor: '#13131f',
    borderWidth: 1,
    borderColor: '#2a2a4a',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: {
    color: '#7c6af7',
    fontSize: 12,
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
  input: {
    flex: 1,
    backgroundColor: '#13131f',
    color: '#fff',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 14,
    maxHeight: 100,
    textAlignVertical: 'center',
    borderWidth: 1,
    borderColor: '#1a1a2e',
  },
  sendBtn: {
    backgroundColor: '#7c6af7',
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#2a2a3e',
  },
});
