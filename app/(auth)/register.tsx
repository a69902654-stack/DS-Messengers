import { supabase } from '@/config/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

export default function RegisterScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleRegister = async () => {
    if (!name || !username || !phone || !password) {
      Alert.alert('خطا', 'همه فیلدها الزامی هستند');
      return;
    }
    if (password.length < 6) {
      Alert.alert('خطا', 'رمز عبور باید حداقل ۶ کاراکتر باشد');
      return;
    }
    setLoading(true);
    try {
      const fakeEmail = `${username.toLowerCase().trim()}@ds.app`;
      const { data, error } = await supabase.auth.signUp({
        email: fakeEmail,
        password,
        options: { data: { username: username.trim().toLowerCase(), name: name.trim(), phone_number: phone.trim() } },
      });
      if (error) throw error;
      if (data?.user) {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email: fakeEmail, password });
        if (signInError) throw signInError;
        router.replace('/(tabs)');
      }
    } catch (error: any) {
      Alert.alert('خطا', error.message.includes('already registered') ? 'این نام کاربری قبلاً ثبت شده' : error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <View style={styles.logoArea}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>DS</Text>
          </View>
          <Text style={styles.title}>ثبت‌نام</Text>
          <Text style={styles.subtitle}>حساب جدید بسازید</Text>
        </View>

        <View style={styles.form}>
          {[
            { label: 'نام', icon: 'person-outline', value: name, set: setName, placeholder: 'نام و نام خانوادگی', cap: 'words' as const },
            { label: 'نام کاربری', icon: 'at-outline', value: username, set: (t: string) => setUsername(t.toLowerCase().replace(/\s/g, '')), placeholder: 'فقط انگلیسی و عدد', cap: 'none' as const },
            { label: 'شماره موبایل', icon: 'call-outline', value: phone, set: setPhone, placeholder: '09xxxxxxxxx', cap: 'none' as const, keyboard: 'phone-pad' as const },
          ].map(({ label, icon, value, set, placeholder, cap, keyboard }) => (
            <View key={label} style={styles.field}>
              <Text style={styles.label}>{label}</Text>
              <View style={styles.inputRow}>
                <Ionicons name={icon as any} size={18} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder={placeholder}
                  placeholderTextColor="#444"
                  value={value}
                  onChangeText={set}
                  autoCapitalize={cap}
                  keyboardType={keyboard}
                  autoCorrect={false}
                />
              </View>
            </View>
          ))}

          <View style={styles.field}>
            <Text style={styles.label}>رمز عبور</Text>
            <View style={styles.inputRow}>
              <Ionicons name="lock-closed-outline" size={18} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="حداقل ۶ کاراکتر"
                placeholderTextColor="#444"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={styles.eyeBtn}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color="#666" />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>ثبت‌نام</Text>}
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>قبلاً ثبت‌نام کرده‌اید؟</Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
            <Text style={styles.footerLink}>ورود</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 72, paddingBottom: 40 },
  logoArea: { alignItems: 'center', marginBottom: 40 },
  logoCircle: {
    width: 72, height: 72, borderRadius: 22,
    backgroundColor: '#5b4fcf',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 20,
  },
  logoText: { color: '#fff', fontSize: 26, fontWeight: '800', letterSpacing: 1 },
  title: { color: '#fff', fontSize: 24, fontWeight: '700', marginBottom: 6 },
  subtitle: { color: '#555', fontSize: 14 },
  form: { gap: 18, marginBottom: 32 },
  field: { gap: 8 },
  label: { color: '#777', fontSize: 12, fontWeight: '600', letterSpacing: 0.5 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#13131f', borderRadius: 14,
    borderWidth: 1, borderColor: '#1e1e30',
    paddingHorizontal: 14, height: 52,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, color: '#fff', fontSize: 15 },
  eyeBtn: { padding: 4 },
  btn: {
    backgroundColor: '#5b4fcf', borderRadius: 14,
    height: 52, justifyContent: 'center', alignItems: 'center',
    marginTop: 4,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  footerText: { color: '#555', fontSize: 14 },
  footerLink: { color: '#7c6af7', fontSize: 14, fontWeight: '600' },
});
