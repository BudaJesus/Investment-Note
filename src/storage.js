import { supabase, isSupabaseConfigured } from './supabase.js'

const storage = {
  async get(key) {
    if (isSupabaseConfigured) {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null
      const { data, error } = await supabase.from('user_data').select('value').eq('user_id', user.id).eq('key', key).single()
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
      const { error } = await supabase.from('user_data').upsert({ user_id: user.id, key, value: parsed, updated_at: new Date().toISOString() }, { onConflict: 'user_id,key' })
      return error ? null : { value }
    } else { localStorage.setItem(key, value); return { value } }
  },
  async delete(key) {
    if (isSupabaseConfigured) {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null
      await supabase.from('user_data').delete().eq('user_id', user.id).eq('key', key)
      return { key, deleted: true }
    } else { localStorage.removeItem(key); return { key, deleted: true } }
  }
}
window.storage = storage

// ═══ Auto Data ═══
export async function getLatestAutoData() {
  if (!isSupabaseConfigured) return null
  try {
    const { data } = await supabase.from('auto_data').select('*').order('date_key', { ascending: false }).limit(1).single()
    return data || null
  } catch (e) { return null }
}
export async function clearAutoData() {
  if (!isSupabaseConfigured) return false
  try { await supabase.from('auto_data').delete().neq('date_key', ''); return true } catch (e) { return false }
}
window.getLatestAutoData = getLatestAutoData
window.clearAutoData = clearAutoData

// ═══ Telegram Digest (수집) ═══
export async function triggerTelegramDigest() {
  try { const res = await fetch('/api/telegram-digest?type=manual'); return await res.json() } catch (e) { return { success: false, error: e.message } }
}
export async function getLatestDigest() {
  if (!isSupabaseConfigured) return null
  try { const { data } = await supabase.from('telegram_digests').select('*').order('collected_at', { ascending: false }).limit(1).single(); return data } catch (e) { return null }
}
export async function getTodayDigests() {
  if (!isSupabaseConfigured) return []
  try {
    const today = new Date().toISOString().slice(0, 10)
    const { data } = await supabase.from('telegram_digests').select('stats, collected_at, run_type').eq('date_key', today).order('collected_at', { ascending: false })
    return data || []
  } catch (e) { return [] }
}
window.triggerTelegramDigest = triggerTelegramDigest
window.getLatestDigest = getLatestDigest
window.getTodayDigests = getTodayDigests

// ═══ Auto Fill (자동입력) ═══
export async function autoFillJournal() {
  try { const res = await fetch('/api/auto-fill-journal'); return await res.json() } catch (e) { return { success: false, error: e.message } }
}
export async function autoFillScrap() {
  try { const res = await fetch('/api/auto-fill-scrap'); return await res.json() } catch (e) { return { success: false, error: e.message } }
}
export async function autoFillReport() {
  try { const res = await fetch('/api/auto-fill-report'); return await res.json() } catch (e) { return { success: false, error: e.message } }
}
export async function triggerGenerateOutlook() {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not logged in' }
    const res = await fetch(`/api/generate-outlook?user_id=${user.id}`)
    return await res.json()
  } catch (e) { return { success: false, error: e.message } }
}
window.autoFillJournal = autoFillJournal
window.autoFillScrap = autoFillScrap
window.autoFillReport = autoFillReport
window.triggerGenerateOutlook = triggerGenerateOutlook

// ═══ Outlook ═══
export async function getLatestOutlook() {
  if (!isSupabaseConfigured) return null
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data } = await supabase.from('outlooks').select('*').eq('user_id', user.id).order('generated_at', { ascending: false }).limit(1).single()
    return data
  } catch (e) { return null }
}
window.getLatestOutlook = getLatestOutlook

// ═══ Forecasts ═══
export async function getForecasts(status = 'all') {
  if (!isSupabaseConfigured) return []
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []
    let q = supabase.from('forecasts').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
    if (status !== 'all') q = q.eq('status', status)
    const { data } = await q.limit(50)
    return data || []
  } catch (e) { return [] }
}
export async function addManualForecast(forecast) {
  if (!isSupabaseConfigured) return null
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data } = await supabase.from('forecasts').insert({ ...forecast, user_id: user.id, source: 'manual' }).select().single()
    return data
  } catch (e) { return null }
}
window.getForecasts = getForecasts
window.addManualForecast = addManualForecast

// ═══ Feedback ═══
export async function getLatestFeedback() {
  if (!isSupabaseConfigured) return null
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data } = await supabase.from('feedback_prompts').select('*').eq('user_id', user.id).order('generated_at', { ascending: false }).limit(1).single()
    return data
  } catch (e) { return null }
}
window.getLatestFeedback = getLatestFeedback

// ═══ Channels ═══
export async function getChannels() {
  if (!isSupabaseConfigured) return []
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []
    const { data } = await supabase.from('channels').select('*').eq('user_id', user.id).order('category')
    return data || []
  } catch (e) { return [] }
}
export async function upsertChannel(channel) {
  if (!isSupabaseConfigured) return null
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data } = await supabase.from('channels').upsert({ ...channel, user_id: user.id }, { onConflict: 'user_id,handle' }).select().single()
    return data
  } catch (e) { return null }
}
export async function toggleChannel(handle, enabled) {
  if (!isSupabaseConfigured) return false
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false
    const { error } = await supabase.from('channels').update({ enabled }).eq('user_id', user.id).eq('handle', handle)
    return !error
  } catch (e) { return false }
}
export async function updateChannelCategory(handle, category) {
  if (!isSupabaseConfigured) return false
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false
    const { error } = await supabase.from('channels').update({ category }).eq('user_id', user.id).eq('handle', handle)
    return !error
  } catch (e) { return false }
}
export async function deleteChannel(handle) {
  if (!isSupabaseConfigured) return false
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false
    await supabase.from('channels').delete().eq('user_id', user.id).eq('handle', handle)
    return true
  } catch (e) { return false }
}
export async function initDefaultChannels() {
  if (!isSupabaseConfigured) return
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: existing } = await supabase.from('channels').select('id').eq('user_id', user.id).limit(1)
    if (existing && existing.length > 0) return
    const defaults = [
      { handle: 'ehdwl', name: '사제콩이_서상영', category: '시황/글로벌매크로', description: 'iM증권, 미국시황/글로벌', subscribers: '28K' },
      { handle: 'hedgecat0301', name: '키움증권 한지영', category: '시황/글로벌매크로', description: '전략/시황', subscribers: '26K' },
      { handle: 'meritz_research', name: '메리츠증권 리서치', category: '시황/글로벌매크로', description: '국내외 전략/채권/시황' },
      { handle: 'HANAStrategy', name: '하나증권 이재만', category: '시황/글로벌매크로', description: '주식전략/퀀트/시황' },
      { handle: 'yeom_teacher', name: '염승환 이사', category: '시황/글로벌매크로', description: '이베스트, 증권사 리포트 종합' },
      { handle: 'market_kis', name: '한투증권 김대준', category: '시황/글로벌매크로', description: '시황/리포트/뉴스' },
      { handle: 'moneycalendar', name: '머니캘린더', category: '뉴스/데이터', description: '일정매매, 주요뉴스, 경제일정' },
      { handle: 'report_figure_by_offset', name: '레포트 피규어', category: '레포트', description: '증권사 리포트 PDF 업로드' },
    ]
    for (const ch of defaults) await supabase.from('channels').insert({ ...ch, user_id: user.id, enabled: true })
  } catch (e) {}
}
window.getChannels = getChannels
window.upsertChannel = upsertChannel
window.toggleChannel = toggleChannel
window.updateChannelCategory = updateChannelCategory
window.deleteChannel = deleteChannel
window.initDefaultChannels = initDefaultChannels

export default storage
