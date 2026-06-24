import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

// این مقادیر رو از پنل Supabase بردار
const supabaseUrl = 'https://ktezdsxfqelvuthxtmks.supabase.co';
const supabaseAnonKey = 'sb_publishable_GU0wDrKl1ZUvN0zTPKOTrw_8iDHE_lL'; // این رو از Supabase بردار

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
