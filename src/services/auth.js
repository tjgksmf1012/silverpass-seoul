import { loginWithKakao, logoutKakao, getKakaoUser } from './kakaoAuth.js'
import { supabase } from './supabase.js'
import { createDefaultProfile, getProfile, normalizeFavorites, saveProfile } from './storage.js'

const ROLE_KEY = 'silverpass_role'
const USER_KEY = 'silverpass_kakao_user'
const SUPABASE_TIMEOUT_MS = 25000

// 공통: 유저 정보를 localStorage에 저장
function saveLocalUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

function withTimeout(promise, message, ms = SUPABASE_TIMEOUT_MS) {
  let timeoutId
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId))
}

function hasRemoteProfile(userId) {
  return Boolean(userId) && !String(userId).startsWith('guest_')
}

function claimLocalProfile(user, role = user?.role) {
  if (!user?.id) return
  const local = getProfile()
  const sameOwner = local.ownerId && String(local.ownerId) === String(user.id)
  const base = local.ownerId && !sameOwner ? createDefaultProfile() : local
  saveProfile({
    ...base,
    ownerId: user.id,
    profileRole: role || base.profileRole || 'user',
    ...(user.name && { name: user.name }),
  })
}

// 이메일 회원가입
export async function signUpWithEmail(email, password, name, phone = '', role = 'user') {
  if (!supabase) throw new Error('Supabase 연결이 필요합니다')
  const { data, error } = await withTimeout(
    supabase.auth.signUp({ email, password, options: { data: { name } } }),
    '회원가입 응답이 지연되고 있어요. 잠시 후 다시 시도해 주세요.'
  )
  if (error) throw new Error(error.message)
  const id = data.user.id
  await withTimeout(
    supabase.from('profiles').upsert({ id, name, thumbnail: '', role, phone }, { onConflict: 'id' }),
    '프로필 저장이 지연되고 있어요. 잠시 후 다시 시도해 주세요.'
  )
  localStorage.setItem(ROLE_KEY, role)
  const profile = getProfile()
  saveProfile({ ...profile, name, guardianPhone: role === 'guardian' ? phone : profile.guardianPhone })
  const user = { id, name, thumbnail: '', provider: 'email' }
  claimLocalProfile(user, role)
  saveLocalUser(user)
  return { ...user, role }
}

// 이메일 로그인
export async function signInWithEmail(email, password) {
  if (!supabase) throw new Error('Supabase 연결이 필요합니다')
  const { data, error } = await withTimeout(
    supabase.auth.signInWithPassword({ email, password }),
    '로그인 응답이 지연되고 있어요. 잠시 후 다시 시도해 주세요.'
  )
  if (error) throw new Error(error.message)
  const id = data.user.id
  const name = data.user.user_metadata?.name || '사용자'
  const { data: profile } = await supabase
    .from('profiles')
    .select('name, phone, role')
    .eq('id', id)
    .maybeSingle()

  // 이메일 계정은 보호자 진입에서만 사용합니다. 시연 DB 초기화로 public.profiles만
  // 삭제되어도 기존 Supabase Auth 계정이 보호자 역할을 회복하도록 보정합니다.
  const role = 'guardian'
  await withTimeout(
    supabase.from('profiles').upsert({
      id,
      name: profile?.name || name,
      thumbnail: '',
      role,
      phone: profile?.phone || '',
    }, { onConflict: 'id' }),
    '프로필을 복구하는 중이에요. 잠시 후 다시 시도해 주세요.'
  )
  localStorage.setItem(ROLE_KEY, role)
  const user = { id, name, thumbnail: '', provider: 'email' }
  const localProfile = getProfile()
  saveProfile({
    ...localProfile,
    name: profile?.name || name,
    guardianPhone: profile?.phone || localProfile.guardianPhone,
  })
  claimLocalProfile(user, role)
  saveLocalUser(user)
  return { ...user, role }
}

// 카카오 로그인
export async function signIn() {
  const kakaoUser = await loginWithKakao()

  if (supabase) {
    const { data } = await supabase
      .from('profiles')
      .upsert(
        { id: kakaoUser.id, name: kakaoUser.name, thumbnail: kakaoUser.thumbnail },
        { onConflict: 'id', ignoreDuplicates: true }
      )
      .select()
      .maybeSingle()

    if (data?.role) {
      localStorage.setItem(ROLE_KEY, data.role)
      claimLocalProfile({ ...kakaoUser, provider: 'kakao' }, data.role)
      return { ...kakaoUser, role: data.role }
    }
  }

  claimLocalProfile({ ...kakaoUser, provider: 'kakao' }, localStorage.getItem(ROLE_KEY))
  return { ...kakaoUser, role: localStorage.getItem(ROLE_KEY) }
}

export async function setRole(kakaoId, role) {
  localStorage.setItem(ROLE_KEY, role)
  if (supabase && hasRemoteProfile(kakaoId)) {
    await supabase.from('profiles').update({ role }).eq('id', kakaoId)
  }
}

export function getRole() {
  return localStorage.getItem(ROLE_KEY)
}

export async function signOut() {
  logoutKakao()
  if (supabase) {
    await supabase.auth.signOut().catch(() => {})
  }
  localStorage.removeItem(ROLE_KEY)
}

export function getCurrentUser() {
  const kakaoUser = getKakaoUser()
  if (!kakaoUser) return null
  return { ...kakaoUser, role: getRole() }
}

// 보호자가 어르신 이름과 함께 초대 코드 생성
export async function generateInviteCode(guardianId, userName) {
  const code = Math.random().toString(36).substring(2, 8).toUpperCase()

  if (supabase) {
    // 기존 미사용 코드 삭제 후 새로 생성
    await supabase.from('links').delete().eq('guardian_id', guardianId).is('user_id', null)
    await supabase.from('links').insert({ guardian_id: guardianId, invite_code: code, user_name: userName })
  }

  return code
}

export async function getInviteInfo(inviteCode) {
  if (!supabase || !inviteCode) return null

  const { data } = await supabase
    .from('links')
    .select('invite_code,user_id,user_name,is_relogin,user:profiles!links_user_id_fkey(name)')
    .eq('invite_code', inviteCode.toUpperCase())
    .maybeSingle()

  if (!data) return null
  const user = Array.isArray(data.user) ? data.user[0] : data.user
  return {
    code: data.invite_code,
    userId: data.user_id,
    userName: user?.name || data.user_name || '',
    isRelogin: Boolean(data.is_relogin || data.user_id),
  }
}

// 보호자가 코드로 사용자와 연결
export async function connectWithCode(guardianId, code) {
  if (!supabase) throw new Error('Supabase 연결이 필요합니다')

  const { data: link, error } = await supabase
    .from('links')
    .select('*, user:profiles!links_user_id_fkey(*)')
    .eq('invite_code', code.toUpperCase())
    .maybeSingle()

  if (error || !link) throw new Error('유효하지 않은 코드예요')
  if (link.guardian_id) throw new Error('이미 다른 보호자와 연결된 코드예요')

  await supabase
    .from('links')
    .update({ guardian_id: guardianId })
    .eq('invite_code', code.toUpperCase())

  return link.user
}

// 보호자가 연결된 사용자 조회
export async function getLinkedUser(guardianId) {
  if (!supabase) return null

  const { data } = await supabase
    .from('links')
    .select('*, user:profiles!links_user_id_fkey(*)')
    .eq('guardian_id', guardianId)
    .maybeSingle()

  return data?.user || null
}

// 사용자가 연결된 보호자 조회
export async function getLinkedGuardian(userId) {
  if (!supabase) return null

  const { data } = await supabase
    .from('links')
    .select('*, guardian:profiles!links_guardian_id_fkey(*)')
    .eq('user_id', userId)
    .maybeSingle()

  return data?.guardian || null
}

// 어르신 게스트 시작 (계정 없이 이름만)
export function startAsGuest(name) {
  const userId = 'guest_' + crypto.randomUUID()
  const user = { id: userId, name, thumbnail: '', provider: 'guest', role: 'user' }
  claimLocalProfile(user, 'user')
  saveLocalUser(user)
  localStorage.setItem(ROLE_KEY, 'user')
  return user
}

// 어르신이 초대 코드로 가입 (계정 없이 이름만)
export async function joinAsUser(inviteCode, userName = null) {
  if (!supabase) throw new Error('Supabase 연결이 필요합니다')

  const { data: link, error } = await supabase
    .from('links')
    .select('*')
    .eq('invite_code', inviteCode.toUpperCase())
    .maybeSingle()

  if (error || !link) throw new Error('유효하지 않은 초대 코드예요')

  // 재로그인 코드: user_id가 이미 있으면 기존 세션 복원
  if (link.user_id) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', link.user_id)
      .maybeSingle()

    // 재로그인 코드는 기존 연결 row를 재사용하므로 연결 자체는 삭제하지 않습니다.
    if (link.is_relogin) {
      await supabase.from('links').update({ is_relogin: false }).eq('invite_code', inviteCode.toUpperCase())
    }

    const user = { id: link.user_id, name: profile?.name || '어르신', thumbnail: '', provider: 'invite', role: 'user' }
    claimLocalProfile(user, 'user')
    saveLocalUser(user)
    localStorage.setItem(ROLE_KEY, 'user')
    await syncElderProfileFromSupabase(link.user_id)
    return user
  }

  // 신규 가입 - 어르신이 직접 입력한 이름 우선, 없으면 보호자가 설정한 이름
  const resolvedName = userName || link.user_name || '어르신'
  const userId = crypto.randomUUID()

  await supabase.from('profiles').upsert(
    { id: userId, name: resolvedName, thumbnail: '', role: 'user' },
    { onConflict: 'id' }
  )
  await supabase.from('links').update({ user_id: userId }).eq('invite_code', inviteCode.toUpperCase())

  const user = { id: userId, name: resolvedName, thumbnail: '', provider: 'invite', role: 'user' }
  claimLocalProfile(user, 'user')
  saveLocalUser(user)
  localStorage.setItem(ROLE_KEY, 'user')
  await syncElderProfileFromSupabase(userId)
  return user
}

// 보호자가 기존 연결된 어르신 재로그인 코드 생성
export async function generateReloginCode(guardianId, elderId) {
  if (!supabase) throw new Error('Supabase 연결이 필요합니다')

  const code = Math.random().toString(36).substring(2, 8).toUpperCase()

  // 기존 연결 row를 갱신해 unique 제약 충돌(409)을 피하고 연결 관계를 보존합니다.
  const { error } = await supabase
    .from('links')
    .update({ invite_code: code, is_relogin: true })
    .eq('guardian_id', guardianId)
    .eq('user_id', elderId)

  if (error) throw new Error(error.message)

  return code
}

// 사용자 이동 기록 저장
export async function saveHistory(userId, { destination, burden, duration }) {
  if (!supabase || !hasRemoteProfile(userId)) return
  const normalizedDestination = typeof destination === 'string'
    ? destination.replace(/^"(.+)" 바로 ?이동$/, '$1')
    : destination
  if (!normalizedDestination || ['목적지', '알 수 없음'].includes(String(normalizedDestination).trim())) return
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle()

  if (profileError || !profile) return

  const { error } = await supabase
    .from('history')
    .insert({ user_id: userId, destination: normalizedDestination, burden, duration })

  if (error) {
    console.warn('History save skipped:', error.message)
    return
  }

  const { data: duplicated } = await supabase
    .from('history')
    .select('id')
    .eq('user_id', userId)
    .eq('destination', normalizedDestination)
    .order('created_at', { ascending: false })
    .limit(20)

  const staleIds = (duplicated || []).slice(1).map(row => row.id)
  if (staleIds.length) {
    await supabase.from('history').delete().in('id', staleIds)
  }
}

// 보호자가 연결된 사용자의 이동 기록 조회
export async function getLinkedUserHistory(userId) {
  if (!supabase) return []

  const { data } = await supabase
    .from('history')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10)

  return data || []
}

// 어르신 추가 정보 저장 (보호자가 등록)
export async function updateElderInfo(elderId, {
  homeAddress, frequentPlaces, notes, phone,
  district, maxWalkMin, allowStairs, mobilityAid,
}) {
  if (!supabase || !hasRemoteProfile(elderId)) return

  await supabase
    .from('profiles')
    .update({
      home_address: homeAddress,
      frequent_places: frequentPlaces,
      notes,
      phone,
      district,
      max_walk_min: maxWalkMin,
      allow_stairs: allowStairs,
      mobility_aid: mobilityAid,
    })
    .eq('id', elderId)
}

// 어르신 추가 정보 조회
export async function getElderInfo(elderId) {
  if (!supabase || !hasRemoteProfile(elderId)) return null

  const { data } = await supabase
    .from('profiles')
    .select('home_address, frequent_places, notes, phone, district, max_walk_min, allow_stairs, mobility_aid')
    .eq('id', elderId)
    .maybeSingle()

  return data || null
}

// 보호자 Supabase 프로필을 localStorage에 반영
export async function syncGuardianProfileFromSupabase(guardianId) {
  if (!supabase) return
  const { data } = await supabase
    .from('profiles')
    .select('phone, name')
    .eq('id', guardianId)
    .maybeSingle()
  if (!data) return

  const { getProfile, saveProfile } = await import('./storage.js')
  const local = getProfile()
  saveProfile({
    ...local,
    ...(data.name  && { name: data.name }),
    ...(data.phone && { guardianPhone: data.phone }),
  })
}

// 어르신 Supabase 설정을 localStorage 프로필에 반영
export async function syncElderProfileFromSupabase(elderId) {
  const info = await getElderInfo(elderId)
  if (!info) {
    const local = getProfile()
    if (local.ownerId && String(local.ownerId) !== String(elderId)) {
      saveProfile(createDefaultProfile({ ownerId: elderId, profileRole: 'user' }))
    }
    return
  }

  const local = getProfile()
  const sameOwner = local.ownerId && String(local.ownerId) === String(elderId)
  const base = local.ownerId && !sameOwner
    ? createDefaultProfile({ ownerId: elderId, profileRole: 'user' })
    : local

  let syncedFavorites = normalizeFavorites()
  if (info.frequent_places) {
    try {
      const parsed = JSON.parse(info.frequent_places)
      if (Array.isArray(parsed)) {
        syncedFavorites = normalizeFavorites(parsed)
      }
    } catch {
      syncedFavorites = normalizeFavorites(info.frequent_places
        .split(',')
        .map(place => ({ id: `remote_${place}`, name: place.trim(), icon: '📍', address: place.trim(), showOnHome: true, custom: true }))
        .filter(place => place.name))
    }
  }

  const nextProfile = {
    ...base,
    ownerId: elderId,
    profileRole: 'user',
    homeAddress: info.home_address || '',
    district: info.home_address
      ? (info.home_address.match(/(\S+구)/)?.[1] || info.district || '종로구')
      : (info.district || '종로구'),
    maxWalkMin: info.max_walk_min || 20,
    allowStairs: info.allow_stairs ?? false,
    mobilityAid: info.mobility_aid ?? false,
    guardianPhone: info.phone || '',
    healthNotes: info.notes || '',
    favorites: syncedFavorites,
  }

  if (!nextProfile.guardianPhone) {
    const { data: link } = await supabase
      .from('links')
      .select('guardian:profiles!links_guardian_id_fkey(name, phone)')
      .eq('user_id', elderId)
      .maybeSingle()

    const guardian = Array.isArray(link?.guardian) ? link.guardian[0] : link?.guardian
    if (guardian?.phone) nextProfile.guardianPhone = guardian.phone
  }

  saveProfile(nextProfile)
}
