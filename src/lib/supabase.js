import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bgyuklwdxlddugyxpxac.supabase.co';
const supabaseAnonKey = 'sb_publishable_dJiX0e6tFRPfApgQKaubtg_FvtLj8JH';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});