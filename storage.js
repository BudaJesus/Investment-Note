import { supabase, isSupabaseConfigured } from './supabase.js'

/*
  Storage adapter:
  - When Supabase is configured: uses 'user_data' table (key-value)
  - When not configured (local dev): uses localStorage
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


// ═══════════════════════════════════════════════════
// Auto Data (시장 수치 — 공유 데이터, auth 불필요)
// ═══════════════════════════════════════════════════

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

window.getAutoData = getAutoData
window.getLatestAutoData = getLatestAutoData
window.clearAutoData = clearAutoData


// ═══════════════════════════════════════════════════
// Telegram Digest (텔레그램 수집 — 공유 데이터)
// ═══════════════════════════════════════════════════

export async function getLatestDigest() {
  if (!isSupabaseConfigured) return null
  try {
    const { data, error } = await supabase
      .from('telegram_digests')
      .select('*')
      .order('collected_at', { ascending: false })
      .limit(1)
      .single()
    if (error || !data) return null
    return data
  } catch (e) { return null }
}

export async function getTodayDigests() {
  if (!isSupabaseConfigured) return []
  try {
    const today = new Date().toISOString().slice(0, 10)
    const { data, error } = await supabase
      .from('telegram_digests')
      .select('stats, collected_at, run_type')
      .eq('date_key', today)
      .order('collected_at', { ascending: false })
    if (error || !data) return []
    return data
  } catch (e) { return [] }
}

/**
 * 수동 텔레그램 수집 트리거
 * 투자일지 "📡 최신 데이터 가져오기" 버튼에서 호출
 */
export async function triggerTelegramDigest() {
  try {
    const res = await fetch('/api/telegram-digest?type=manual')
    const data = await res.json()
    return data
  } catch (e) { return { success: false, error: e.message } }
}

window.getLatestDigest = getLatestDigest
window.getTodayDigests = getTodayDigests
window.triggerTelegramDigest = triggerTelegramDigest


// ═══════════════════════════════════════════════════
// Outlook (포트폴리오 — 시장전망 + 종목분석)
// ═══════════════════════════════════════════════════

export async function getLatestOutlook() {
  if (!isSupabaseConfigured) return null
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data, error } = await supabase
      .from('outlooks')
      .select('*')
      .eq('user_id', user.id)
      .order('generated_at', { ascending: false })
      .limit(1)
      .single()
    if (error || !data) return null
    return data
  } catch (e) { return null }
}

/**
 * 포트폴리오 "🔄 데이터 수집 + AI 분석" 버튼에서 호출
 */
export async function triggerGenerateOutlook() {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not logged in' }
    const res = await fetch(`/api/generate-outlook?user_id=${user.id}`)
    const data = await res.json()
    return data
  } catch (e) { return { success: false, error: e.message } }
}

window.getLatestOutlook = getLatestOutlook
window.triggerGenerateOutlook = triggerGenerateOutlook


// ═══════════════════════════════════════════════════
// Forecasts (예측 추적)
// ═══════════════════════════════════════════════════

export async function getForecasts(status = 'all') {
  if (!isSupabaseConfigured) return []
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []
    let query = supabase
      .from('forecasts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    if (status !== 'all') query = query.eq('status', status)
    const { data, error } = await query.limit(50)
    if (error || !data) return []
    return data
  } catch (e) { return [] }
}

export async function addManualForecast(forecast) {
  if (!isSupabaseConfigured) return null
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data, error } = await supabase
      .from('forecasts')
      .insert({ ...forecast, user_id: user.id, source: 'manual' })
      .select()
      .single()
    if (error) return null
    return data
  } catch (e) { return null }
}

window.getForecasts = getForecasts
window.addManualForecast = addManualForecast


// ═══════════════════════════════════════════════════
// Feedback Prompts (피드백 루프)
// ═══════════════════════════════════════════════════

export async function getLatestFeedback() {
  if (!isSupabaseConfigured) return null
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data, error } = await supabase
      .from('feedback_prompts')
      .select('*')
      .eq('user_id', user.id)
      .order('generated_at', { ascending: false })
      .limit(1)
      .single()
    if (error || !data) return null
    return data
  } catch (e) { return null }
}

window.getLatestFeedback = getLatestFeedback


// ═══════════════════════════════════════════════════
// Channels (텔레그램 채널 관리)
// ═══════════════════════════════════════════════════

export async function getChannels() {
  if (!isSupabaseConfigured) return []
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []
    const { data, error } = await supabase
      .from('channels')
      .select('*')
      .eq('user_id', user.id)
      .order('category', { ascending: true })
    if (error || !data) return []
    return data
  } catch (e) { return [] }
}

export async function upsertChannel(channel) {
  if (!isSupabaseConfigured) return null
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data, error } = await supabase
      .from('channels')
      .upsert({ ...channel, user_id: user.id }, { onConflict: 'user_id,handle' })
      .select()
      .single()
    if (error) return null
    return data
  } catch (e) { return null }
}

export async function toggleChannel(handle, enabled) {
  if (!isSupabaseConfigured) return false
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false
    const { error } = await supabase
      .from('channels')
      .update({ enabled })
      .eq('user_id', user.id)
      .eq('handle', handle)
    return !error
  } catch (e) { return false }
}

export async function deleteChannel(handle) {
  if (!isSupabaseConfigured) return false
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false
    const { error } = await supabase
      .from('channels')
      .delete()
      .eq('user_id', user.id)
      .eq('handle', handle)
    return !error
  } catch (e) { return false }
}

/**
 * 최초 로그인 시 기본 채널 삽입
 */
export async function initDefaultChannels() {
  if (!isSupabaseConfigured) return
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // 이미 채널이 있으면 스킵
    const { data: existing } = await supabase
      .from('channels')
      .select('id')
      .eq('user_id', user.id)
      .limit(1)
    if (existing && existing.length > 0) return

    const defaults = [
      { handle: 'ehdwl', name: '사제콩이_서상영', category: '시황', description: 'iM증권, 미국시황/글로벌', subscribers: '28K' },
      { handle: 'hedgecat0301', name: '키움증권 한지영', category: '시황', description: '전략/시황', subscribers: '26K' },
      { handle: 'meritz_research', name: '메리츠증권 리서치', category: '시황', description: '국내외 전략/채권/시황' },
      { handle: 'HANAStrategy', name: '하나증권 이재만', category: '시황', description: '주식전략/퀀트/시황' },
      { handle: 'yeom_teacher', name: '염승환 이사', category: '시황', description: '이베스트, 증권사 리포트 종합' },
      { handle: 'market_kis', name: '한투증권 김대준', category: '시황', description: '시황/리포트/뉴스' },
      { handle: 'moneycalendar', name: '머니캘린더', category: '뉴스', description: '일정매매, 주요뉴스, 경제일정' },
    ]

    for (const ch of defaults) {
      await supabase.from('channels').insert({ ...ch, user_id: user.id, enabled: true })
    }
  } catch (e) {}
}

window.getChannels = getChannels
window.upsertChannel = upsertChannel
window.toggleChannel = toggleChannel
window.deleteChannel = deleteChannel
window.initDefaultChannels = initDefaultChannels


export default storage
