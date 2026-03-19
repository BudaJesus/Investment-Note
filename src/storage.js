import { supabase, isSupabaseConfigured } from './supabase.js'

/*
  Storage adapter:
  - When Supabase is configured: uses 'user_data' table (key-value)
  - When not configured (local dev): uses localStorage
  
  Supabase table schema:
    CREATE TABLE user_data (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
      key TEXT NOT NULL,
      value JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE(user_id, key)
    );
    
    ALTER TABLE user_data ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "Users can manage own data" ON user_data
      FOR ALL USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
*/

const storage = {
  async get(key) {
    if (isSupabaseConfigured) {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null
      const { data, error } = await supabase
        .from('user_data')
        .select('value')
        .eq('user_id', user.id)
        .eq('key', key)
        .single()
      if (error || !data) return null
      return { value: JSON.stringify(data.value) }
    } else {
      const val = localStorage.getItem(key)
      return val ? { value: val } : null
    }
  },

  async set(key, value) {
    if (isSupabaseConfigured) {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null
      const parsed = JSON.parse(value)
      const { data, error } = await supabase
        .from('user_data')
        .upsert({
          user_id: user.id,
          key,
          value: parsed,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,key' })
      return error ? null : { value }
    } else {
      localStorage.setItem(key, value)
      return { value }
    }
  },

  async delete(key) {
    if (isSupabaseConfigured) {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null
      await supabase
        .from('user_data')
        .delete()
        .eq('user_id', user.id)
        .eq('key', key)
      return { key, deleted: true }
    } else {
      localStorage.removeItem(key)
      return { key, deleted: true }
    }
  }
}

// Attach to window so the existing component can use window.storage
window.storage = storage

// Auto data reader (public data, no auth needed)
export async function getAutoData(dateKey) {
  if (!isSupabaseConfigured) return null
  try {
    const { data, error } = await supabase
      .from('auto_data')
      .select('*')
      .eq('date_key', dateKey)
      .single()
    if (error || !data) return null
    return data
  } catch (e) { return null }
}

export async function getLatestAutoData() {
  if (!isSupabaseConfigured) return null
  try {
    const { data, error } = await supabase
      .from('auto_data')
      .select('*')
      .order('date_key', { ascending: false })
      .limit(1)
      .single()
    if (error || !data) return null
    return data
  } catch (e) { return null }
}

window.getAutoData = getAutoData
window.getLatestAutoData = getLatestAutoData

export async function clearAutoData() {
  if (!isSupabaseConfigured) return false
  try {
    const { error } = await supabase
      .from('auto_data')
      .delete()
      .neq('date_key', '')
    return !error
  } catch (e) { return false }
}

window.clearAutoData = clearAutoData

export default storage
