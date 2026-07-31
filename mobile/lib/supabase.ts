import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

export const supabaseUrl = "https://vbzbyxmcpwppvfpbxsls.supabase.co";
const supabaseAnonKey =
  "sb_publishable_DM8GfA28S1QDr_tTT-zShg_UQ8ggNOb";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
