import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

// این مقادیر رو از پنل Supabase بردار
const supabaseUrl = 'https://ktezdsxfqelvuthxtmks.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0ZXpkc3hmcWVsdnV0aHh0bWtzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MDAwODUsImV4cCI6MjA5NTM3NjA4NX0.B5qPoRsKuGBZW1T-YHCsHY4ssRSu-eM-0geUpAZ8Tws'; // این رو از Supabase بردار

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
