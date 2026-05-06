import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCurrentUser, signOut, generateInviteCode, getLinkedUser, getLinkedUserHistory, updateElderInfo, getElderInfo, generateReloginCode } from '../services/auth.js'
import { DEFAULT_FAVORITES, createFavoritePlace, normalizeFavorites } from '../services/storage.js'

function openAddressSearch(onSelect) {
  if (!window.daum?.Postcode) return
  new window.daum.Postcode({
    oncomplete(data) { onSelect(data.roadAddress || data.jibunAddress) },
  }).open()
}

const BURDEN_LABEL = { low: '낮음', medium: '보통', high: '높음' }
const BURDEN_COLOR = { low: 'text-green-600 bg-green-50', medium: 'text-yellow-600 bg-yellow-50', high: 'text-red-600 bg-red-50' }

const ICON_OPTIONS = ['📍', '🏠', '👨‍👩‍👧', '🏥', '💊', '🏛️', '🛒', '☕', '🌳', '🚉']

function parseFavorites(frequentPlaces) {
  try {
    const parsed = JSON.parse(frequentPlaces)
    if (Array.isArray(parsed)) return normalizeFavorites(parsed)
  } catch {}
  if (typeof frequentPlaces === 'string' && frequentPlaces.trim()) {
    return normalizeFavorites([
      ...DEFAULT_FAVORITES,
      ...frequentPlaces.split(',').map(place => createFavoritePlace({ name: place.trim(), address: place.trim() })),
    ])
  }
  return normalizeFavorites(DEFAULT_FAVORITES)
}

export default function GuardianDashboard() {
  const navigate = useNavigate()
  const user = getCurrentUser()

  const [linkedUser, setLinkedUser] = useState(null)
  const [history, setHistory] = useState([])
  const [loadingLink, setLoadingLink] = useState(true)
  const [inviteCode, setInviteCode] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [elderName, setElderName] = useState('')

  const [elderInfo, setElderInfo] = useState({
    homeAddress: '', favorites: normalizeFavorites(DEFAULT_FAVORITES),
    notes: '', phone: '', district: '', maxWalkMin: 20, allowStairs: true, mobilityAid: false,
  })
  const [editingInfo, setEditingInfo] = useState(false)
  const [infoSaving, setInfoSaving] = useState(false)
  const [infoSaved, setInfoSaved] = useState(false)

  const [reloginCode, setReloginCode] = useState('')
  const [reloginLoading, setReloginLoading] = useState(false)
  const [reloginCopied, setReloginCopied] = useState(false)

  const loadLinkedUser = useCallback(async () => {
    if (!user) return
    setLoadingLink(true)
    try {
      const linked = await getLinkedUser(user.id)
      setLinkedUser(linked)
      if (linked) {
        const [hist, info] = await Promise.all([
          getLinkedUserHistory(linked.id),
          getElderInfo(linked.id),
        ])
        setHistory(hist)
        if (info) {
          setElderInfo({
            homeAddress: info.home_address || '',
            favorites: parseFavorites(info.frequent_places),
            notes: info.notes || '',
            phone: info.phone || '',
            district: info.district || '',
            maxWalkMin: info.max_walk_min || 20,
            allowStairs: info.allow_stairs ?? true,
            mobilityAid: info.mobility_aid ?? false,
          })
        }
      }
    } finally {
      setLoadingLink(false)
    }
  }, [user?.id])

  useEffect(() => { loadLinkedUser() }, [loadLinkedUser])

  async function handleGenerateCode() {
    if (!elderName.trim()) return
    setInviteLoading(true)
    try {
      const code = await generateInviteCode(user.id, elderName.trim())
      setInviteCode(code)
    } finally {
      setInviteLoading(false)
    }
  }

  async function handleShare() {
    const link = `${window.location.origin}/invite/${inviteCode}`
    try {
      if (navigator.share) {
        await navigator.share({ title: '실버패스 서울 초대', text: '어르신, 이 링크로 접속해 주세요!', url: link })
      } else {
        await navigator.clipboard.writeText(link)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } catch {}
  }

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  async function handleReloginCode() {
    if (!linkedUser) return
    setReloginLoading(true)
    try {
      const code = await generateReloginCode(user.id, linkedUser.id)
      setReloginCode(code)
    } finally {
      setReloginLoading(false)
    }
  }

  async function handleShareRelogin() {
    const link = `${window.location.origin}/invite/${reloginCode}`
    try {
      if (navigator.share) {
        await navigator.share({ title: '실버패스 서울 재로그인', text: `${linkedUser.name}님, 이 링크로 다시 접속해 주세요!`, url: link })
      } else {
        await navigator.clipboard.writeText(link)
        setReloginCopied(true)
        setTimeout(() => setReloginCopied(false), 2000)
      }
    } catch {}
  }

  async function handleSaveInfo() {
    if (!linkedUser) return
    setInfoSaving(true)
    try {
      await updateElderInfo(linkedUser.id, {
        ...elderInfo,
        frequentPlaces: JSON.stringify(normalizeFavorites(elderInfo.favorites)),
      })
      setInfoSaved(true)
      setEditingInfo(false)
      setTimeout(() => setInfoSaved(false), 2500)
    } finally {
      setInfoSaving(false)
    }
  }

  function updateFavorite(id, patch) {
    setElderInfo(p => ({
      ...p,
      favorites: normalizeFavorites(p.favorites.map(f => f.id === id ? { ...f, ...patch } : f)),
    }))
  }

  function addFavorite() {
    setElderInfo(p => ({
      ...p,
      favorites: normalizeFavorites([
        ...p.favorites,
        createFavoritePlace({ name: '보호자 집', icon: '👨‍👩‍👧', showOnHome: true }),
      ]),
    }))
  }

  function removeFavorite(id) {
    setElderInfo(p => ({
      ...p,
      favorites: normalizeFavorites(p.favorites.filter(f => f.id !== id)),
    }))
  }

  function formatTime(iso) {
    const d = new Date(iso)
    const diff = Math.floor((Date.now() - d) / 60000)
    if (diff < 60) return `${diff}분 전`
    if (diff < 1440) return `${Math.floor(diff / 60)}시간 전`
    return `${Math.floor(diff / 1440)}일 전`
  }

  return (
    <div className="min-h-screen bg-cream-50 pb-8">

      {/* 헤더 */}
      <div className="bg-white border-b border-gray-100 px-5 pt-12 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {user?.thumbnail ? (
            <img src={user.thumbnail} alt="" className="w-9 h-9 rounded-full object-cover" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold">
              {user?.name?.[0] || '보'}
            </div>
          )}
          <div>
            <p className="text-xs text-gray-400">보호자</p>
            <p className="font-semibold text-gray-900">{user?.name || '보호자'}</p>
          </div>
        </div>
        <button onClick={handleSignOut} className="text-sm text-gray-400 hover:text-gray-600 px-3 py-1">
          로그아웃
        </button>
      </div>

      <div className="px-5 pt-5 space-y-5 max-w-lg mx-auto">

        {loadingLink ? (
          <div className="flex items-center justify-center py-20">
            <span className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : linkedUser ? (
          <>
            {/* 연결된 어르신 카드 */}
            <div className="bg-white rounded-3xl p-5 shadow-sm">
              <p className="text-xs text-gray-400 mb-3 font-medium uppercase tracking-wide">연결된 어르신</p>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-brand-100 flex items-center justify-center text-2xl">
                  👴
                </div>
                <div className="flex-1">
                  <p className="text-xl font-bold text-gray-900">{linkedUser.name}</p>
                  <p className="text-sm text-green-500 flex items-center gap-1 mt-0.5">
                    <span className="w-2 h-2 bg-green-400 rounded-full inline-block" />
                    연결됨
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4">
                <button
                  onClick={() => navigate('/emergency')}
                  className="flex items-center justify-center gap-2 bg-red-50 text-red-600 font-semibold rounded-2xl py-3 active:scale-95 transition-all"
                >
                  <span className="text-lg">🚨</span> 응급신고
                </button>
                <button
                  onClick={loadLinkedUser}
                  className="flex items-center justify-center gap-2 bg-brand-50 text-brand-700 font-semibold rounded-2xl py-3 active:scale-95 transition-all"
                >
                  <span className="text-lg">🔄</span> 새로고침
                </button>
              </div>

              {/* 재로그인 */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-400 mb-2">어르신 기기에서 로그인이 풀렸나요?</p>
                {reloginCode ? (
                  <div className="space-y-2">
                    <div className="bg-amber-50 rounded-2xl p-3 text-center">
                      <p className="text-xs text-amber-600 mb-1">재로그인 코드 (1회용)</p>
                      <p className="text-2xl font-mono font-bold text-amber-700 tracking-widest">{reloginCode}</p>
                    </div>
                    <button
                      onClick={handleShareRelogin}
                      className="w-full py-3 rounded-2xl bg-amber-500 text-white font-semibold text-sm active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                      <span>{reloginCopied ? '✅' : '📤'}</span>
                      {reloginCopied ? '링크 복사됐어요!' : '재로그인 링크 공유'}
                    </button>
                    <button onClick={() => setReloginCode('')} className="w-full text-xs text-gray-400 py-1">
                      닫기
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleReloginCode}
                    disabled={reloginLoading}
                    className="w-full py-3 rounded-2xl border border-amber-200 bg-amber-50 text-amber-700 font-semibold text-sm active:scale-95 transition-all disabled:opacity-50"
                  >
                    {reloginLoading ? '생성 중...' : '🔑 재로그인 링크 만들기'}
                  </button>
                )}
              </div>
            </div>

            {/* 어르신 정보 등록 */}
            <div className="bg-white rounded-3xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">어르신 정보</p>
                {!editingInfo && (
                  <button
                    onClick={() => setEditingInfo(true)}
                    className="text-sm text-brand-600 font-semibold px-3 py-1 bg-brand-50 rounded-xl active:scale-95 transition-all"
                  >
                    {elderInfo.homeAddress || elderInfo.phone || elderInfo.favorites.some(f => f.address) ? '수정' : '+ 등록'}
                  </button>
                )}
              </div>

              {editingInfo ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">집 주소</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={elderInfo.homeAddress}
                        onChange={e => setElderInfo(p => ({ ...p, homeAddress: e.target.value }))}
                        placeholder="주소 검색 버튼을 눌러주세요"
                        readOnly
                        className="input-base flex-1 bg-gray-50 cursor-pointer"
                        onClick={() => openAddressSearch(addr => setElderInfo(p => ({ ...p, homeAddress: addr })))}
                      />
                      <button
                        type="button"
                        onClick={() => openAddressSearch(addr => setElderInfo(p => ({ ...p, homeAddress: addr })))}
                        className="px-3 py-2 bg-brand-600 text-white text-sm font-semibold rounded-xl active:scale-95 transition-all whitespace-nowrap"
                      >
                        검색
                      </button>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <label className="text-xs font-semibold text-gray-500 block">바로 출발 목적지</label>
                        <p className="text-xs text-gray-400 mt-0.5">어르신 홈 화면의 큰 바로 출발 카드에 보여요</p>
                      </div>
                      <button
                        type="button"
                        onClick={addFavorite}
                        className="px-3 py-2 rounded-xl bg-brand-50 text-brand-700 text-xs font-bold active:scale-95 transition-all"
                      >
                        + 장소 추가
                      </button>
                    </div>
                    <div className="space-y-3">
                      {elderInfo.favorites.map(fav => (
                        <div key={fav.id} className="rounded-2xl border border-gray-100 bg-gray-50 p-3 space-y-2">
                          <div className="flex items-center gap-2">
                            <select
                              value={fav.icon || '📍'}
                              onChange={e => updateFavorite(fav.id, { icon: e.target.value })}
                              className="w-12 h-11 rounded-xl border border-gray-200 bg-white text-lg text-center"
                              aria-label={`${fav.name} 아이콘`}
                            >
                              {ICON_OPTIONS.map(icon => <option key={icon} value={icon}>{icon}</option>)}
                            </select>
                            <input
                              type="text"
                              value={fav.name}
                              onChange={e => updateFavorite(fav.id, { name: e.target.value })}
                              placeholder="장소 이름"
                              className="input-base flex-1 min-w-0 text-sm py-2 bg-white"
                            />
                            <button
                              type="button"
                              onClick={() => updateFavorite(fav.id, { showOnHome: !fav.showOnHome })}
                              className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap ${
                                fav.showOnHome ? 'bg-brand-600 text-white' : 'bg-white text-gray-400 border border-gray-200'
                              }`}
                            >
                              {fav.showOnHome ? '홈 표시' : '숨김'}
                            </button>
                          </div>
                          <div className="flex gap-1.5">
                            <input
                              type="text"
                              value={fav.address}
                              readOnly
                              placeholder="탭해서 주소 검색"
                              className="input-base flex-1 min-w-0 text-xs py-2 cursor-pointer bg-white"
                              onClick={() => openAddressSearch(addr => updateFavorite(fav.id, { address: addr }))}
                            />
                            {fav.address && (
                              <button
                                type="button"
                                onClick={() => updateFavorite(fav.id, { address: '' })}
                                className="w-8 h-8 rounded-lg border border-gray-200 bg-white text-gray-400 text-sm flex-shrink-0 flex items-center justify-center"
                              >×</button>
                            )}
                            {fav.custom && (
                              <button
                                type="button"
                                onClick={() => removeFavorite(fav.id)}
                                className="px-2 rounded-lg border border-red-100 bg-white text-red-400 text-xs font-bold flex-shrink-0"
                              >
                                삭제
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">보호자 전화번호</label>
                    <input
                      type="tel"
                      value={elderInfo.phone}
                      onChange={e => setElderInfo(p => ({ ...p, phone: e.target.value }))}
                      placeholder="010-0000-0000 (어르신이 전화할 번호)"
                      className="input-base"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">거주 구</label>
                    <input
                      type="text"
                      value={elderInfo.district}
                      onChange={e => setElderInfo(p => ({ ...p, district: e.target.value }))}
                      placeholder="종로구"
                      className="input-base"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-2 block">최대 도보 시간</label>
                    <div className="flex gap-2">
                      {[10, 15, 20, 30].map(min => (
                        <button key={min} type="button"
                          onClick={() => setElderInfo(p => ({ ...p, maxWalkMin: min }))}
                          className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-all ${
                            elderInfo.maxWalkMin === min
                              ? 'bg-brand-600 text-white border-brand-600'
                              : 'bg-white text-gray-600 border-gray-200'
                          }`}
                        >{min}분</button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="text-xs font-semibold text-gray-500 block">이동 조건</label>
                    <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">계단 이용 가능</p>
                        <p className="text-xs text-gray-400">계단 있는 경로도 안내</p>
                      </div>
                      <button type="button"
                        onClick={() => setElderInfo(p => ({ ...p, allowStairs: !p.allowStairs }))}
                        className={`w-12 h-6 rounded-full transition-colors relative ${elderInfo.allowStairs ? 'bg-brand-500' : 'bg-gray-300'}`}
                      >
                        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${elderInfo.allowStairs ? 'translate-x-6' : 'translate-x-0.5'}`} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">보행보조기구 사용</p>
                        <p className="text-xs text-gray-400">휠체어, 워커, 지팡이 등</p>
                      </div>
                      <button type="button"
                        onClick={() => setElderInfo(p => ({ ...p, mobilityAid: !p.mobilityAid }))}
                        className={`w-12 h-6 rounded-full transition-colors relative ${elderInfo.mobilityAid ? 'bg-brand-500' : 'bg-gray-300'}`}
                      >
                        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${elderInfo.mobilityAid ? 'translate-x-6' : 'translate-x-0.5'}`} />
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">메모</label>
                    <textarea
                      value={elderInfo.notes}
                      onChange={e => setElderInfo(p => ({ ...p, notes: e.target.value }))}
                      placeholder="특이사항, 건강 정보 등"
                      rows={2}
                      className="input-base resize-none"
                    />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => setEditingInfo(false)}
                      className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-500 font-semibold text-sm active:scale-95 transition-all"
                    >
                      취소
                    </button>
                    <button
                      onClick={handleSaveInfo}
                      disabled={infoSaving}
                      className="flex-1 py-3 rounded-2xl btn-primary font-semibold text-sm disabled:opacity-50"
                    >
                      {infoSaving ? '저장 중...' : '저장'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {infoSaved && (
                    <p className="text-green-600 text-sm text-center bg-green-50 rounded-xl py-2 mb-2">저장됐어요!</p>
                  )}
                  {!elderInfo.homeAddress && !elderInfo.phone && !elderInfo.notes && !elderInfo.favorites.some(f => f.address) ? (
                    <div className="text-center py-6 text-gray-400">
                      <p className="text-3xl mb-2">📋</p>
                      <p className="text-sm">아직 등록된 정보가 없어요</p>
                    </div>
                  ) : (
                    <>
                      {elderInfo.homeAddress && (
                        <InfoRow icon="🏠" label="집 주소" value={elderInfo.homeAddress} />
                      )}
                      {elderInfo.favorites.filter(f => f.address).map(fav => (
                        <InfoRow
                          key={fav.id}
                          icon={fav.icon}
                          label={`${fav.name}${fav.showOnHome ? ' · 홈 표시' : ' · 숨김'}`}
                          value={fav.address}
                        />
                      ))}
                      {elderInfo.phone && (
                        <InfoRow icon="📞" label="보호자 전화번호" value={elderInfo.phone} />
                      )}
                      {elderInfo.district && (
                        <InfoRow icon="📌" label="거주 구" value={elderInfo.district} />
                      )}
                      <InfoRow icon="🚶" label="최대 도보" value={`${elderInfo.maxWalkMin}분`} />
                      <InfoRow icon={elderInfo.allowStairs ? '✅' : '🚫'} label="계단" value={elderInfo.allowStairs ? '이용 가능' : '이용 불가'} />
                      {elderInfo.mobilityAid && (
                        <InfoRow icon="♿" label="보행보조기구" value="사용 중" />
                      )}
                      {elderInfo.notes && (
                        <InfoRow icon="📝" label="메모" value={elderInfo.notes} />
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* 최근 이동 기록 */}
            <div className="bg-white rounded-3xl p-5 shadow-sm">
              <p className="text-xs text-gray-400 mb-3 font-medium uppercase tracking-wide">최근 이동 기록</p>
              {history.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <p className="text-3xl mb-2">🗺️</p>
                  <p className="text-senior">아직 이동 기록이 없어요</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {history.map((h) => (
                    <div key={h.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                      <div className="w-10 h-10 rounded-2xl bg-brand-50 flex items-center justify-center text-lg flex-shrink-0">
                        🏠
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{h.destination}</p>
                        <p className="text-sm text-gray-400">{h.duration} · {formatTime(h.created_at)}</p>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${BURDEN_COLOR[h.burden] || 'text-gray-500 bg-gray-50'}`}>
                        {BURDEN_LABEL[h.burden] || h.burden}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          /* 연결 안 된 상태 - 초대 코드 생성 */
          <div className="bg-white rounded-3xl p-6 shadow-sm">
            <div className="text-center mb-6">
              <p className="text-5xl mb-3">📨</p>
              <h2 className="text-xl font-bold text-gray-900">어르신을 초대하세요</h2>
              <p className="text-gray-500 text-senior mt-2 leading-relaxed">
                초대 링크를 만들어서<br />어르신께 카카오톡으로 보내드리세요
              </p>
            </div>

            {!inviteCode && (
              <div className="space-y-2 mb-3">
                <label className="text-sm font-semibold text-gray-700">어르신 성함</label>
                <input
                  type="text"
                  value={elderName}
                  onChange={e => setElderName(e.target.value)}
                  placeholder="홍길동"
                  className="input-base text-center text-lg"
                />
              </div>
            )}

            {inviteCode ? (
              <div className="space-y-3">
                <div className="bg-brand-50 rounded-2xl p-4 text-center">
                  <p className="text-xs text-brand-600 mb-1">초대 코드</p>
                  <p className="text-3xl font-mono font-bold text-brand-700 tracking-widest">{inviteCode}</p>
                </div>

                <button
                  onClick={handleShare}
                  className="w-full btn-primary py-4 text-lg rounded-2xl flex items-center justify-center gap-2"
                >
                  <span>{copied ? '✅' : '📤'}</span>
                  {copied ? '링크 복사됐어요!' : '초대 링크 공유하기'}
                </button>

                <button
                  onClick={handleGenerateCode}
                  className="w-full text-sm text-gray-400 py-2"
                >
                  코드 다시 생성하기
                </button>
              </div>
            ) : (
              <button
                onClick={handleGenerateCode}
                disabled={inviteLoading || !elderName.trim()}
                className="w-full btn-primary py-4 text-lg rounded-2xl disabled:opacity-40"
              >
                {inviteLoading ? '생성 중...' : '초대 코드 만들기'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function InfoRow({ icon, label, value }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
      <span className="text-lg mt-0.5">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-400 mb-0.5">{label}</p>
        <p className="text-sm text-gray-800 break-words">{value}</p>
      </div>
    </div>
  )
}
