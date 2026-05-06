import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav.jsx'
import { ArrowLeft, UserIcon, PhoneIcon, WalkIcon, SettingsIcon,
         MapPin, CheckCircle, BuildingIcon } from '../components/Icons.jsx'
import { createDefaultProfile, getProfile, saveProfile, markVisited } from '../services/storage.js'
import { getKakaoUser } from '../services/kakaoAuth.js'
import { getCurrentUser, signOut, getLinkedGuardian, syncElderProfileFromSupabase, syncGuardianProfileFromSupabase } from '../services/auth.js'

const WALK_OPTIONS = [10, 15, 20, 30]

export default function Profile() {
  const navigate = useNavigate()
  const [profile, setProfile]       = useState(getProfile())
  const [saved, setSaved]           = useState(false)
  const kakaoUser = getKakaoUser()
  const currentUser = getCurrentUser()
  const provider = currentUser?.provider
  const isGuardian = currentUser?.role === 'guardian' && provider !== 'guest' && provider !== 'invite'
  const isRouteUser = !isGuardian
  const [linkedGuardian, setLinkedGuardian] = useState(null)

  useEffect(() => {
    if (!currentUser?.id) return
    setProfile(p => {
      if (p.ownerId && String(p.ownerId) === String(currentUser.id)) return p
      if (p.ownerId) {
        return {
          ...createDefaultProfile(),
          ownerId: currentUser.id,
          profileRole: currentUser.role || 'user',
          ...(currentUser.name && { name: currentUser.name }),
        }
      }
      return {
        ...p,
        ownerId: currentUser.id,
        profileRole: currentUser.role || 'user',
        ...(currentUser.name && { name: currentUser.name }),
      }
    })
  }, [currentUser?.id, currentUser?.role, currentUser?.name])

  useEffect(() => {
    if (!currentUser?.id) return
    if (isRouteUser) {
      getLinkedGuardian(currentUser.id).then(setLinkedGuardian)
      syncElderProfileFromSupabase(currentUser.id).then(() => setProfile(getProfile()))
    } else {
      syncGuardianProfileFromSupabase(currentUser.id).then(() => setProfile(getProfile()))
    }
  }, [isRouteUser, currentUser?.id])

  function update(key, val)  { setProfile(p => ({ ...p, [key]: val })); setSaved(false) }
  const quickStartPlaces = [
    profile.homeAddress && { id: 'home', name: '집', icon: '🏠', address: profile.homeAddress, helper: '내 집 주소' },
    ...(profile.favorites || [])
      .filter(fav => fav.address && fav.showOnHome !== false)
      .map(fav => ({
        id: fav.id,
        name: fav.name,
        icon: fav.icon || '📍',
        address: fav.address,
        helper: '보호자 등록',
      })),
  ].filter(Boolean).reduce((acc, place) => {
    if (acc.some(item => item.address === place.address)) return acc
    return [...acc, place]
  }, [])

  function handleSave() {
    const nextProfile = currentUser?.id
      ? { ...profile, ownerId: currentUser.id, profileRole: currentUser.role || 'user' }
      : profile
    saveProfile(nextProfile)
    setProfile(nextProfile)
    markVisited()
    setSaved(true)
    setTimeout(() => navigate('/'), 800)
  }

  async function handleLogout() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F3F7FA', paddingBottom: 112 }}>

      {/* 그라디언트 헤더 */}
      <div style={{
        background: 'linear-gradient(165deg, #064E3B 0%, #0F766E 50%, #0D9488 100%)',
        padding: '54px 20px 26px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button onClick={() => { markVisited(); navigate('/') }} style={{
            width: 48, height: 48, borderRadius: 14,
            border: '1px solid rgba(255,255,255,0.25)',
            background: 'rgba(255,255,255,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}>
            <ArrowLeft size={22} color="#fff" />
          </button>
          <div>
            <h1 style={{ fontSize: 30, fontWeight: 900, color: '#fff', margin: 0 }}>내 정보</h1>
            <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.8)', margin: '5px 0 0', fontWeight: 700 }}>맞춤 경로 설정</p>
          </div>
        </div>
      </div>

      <div style={{ padding: '16px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* ── 계정 정보 ── */}
        <div style={{ background: '#fff', borderRadius: 16, padding: '15px 16px', border: '1.5px solid #F1F5F9', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          {currentUser?.provider === 'guest' ? (
            /* 게스트 (비로그인) */
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: '#F0FDFA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🧭</div>
                <div>
                  <p style={{ fontWeight: 800, fontSize: 15, color: '#0F172A', margin: 0 }}>비로그인 상태</p>
                  <p style={{ fontSize: 12, color: '#94A3B8', margin: '2px 0 0' }}>계정 없이 사용 중이에요</p>
                </div>
              </div>
              <button onClick={() => navigate('/login')} style={{
                width: '100%', border: 'none', borderRadius: 12, padding: '11px 0',
                background: 'linear-gradient(135deg, #0F766E, #0D9488)', color: '#fff',
                fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
              }}>로그인 / 회원가입하기</button>
            </div>
          ) : (
            /* 로그인 상태 */
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {kakaoUser?.thumbnail
                ? <img src={kakaoUser.thumbnail} alt="" style={{ width: 44, height: 44, borderRadius: 12, objectFit: 'cover' }} />
                : (
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: '#F0FDFA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 20 }}>👤</span>
                  </div>
                )
              }
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 800, fontSize: 15, color: '#0F172A', margin: 0 }}>{kakaoUser?.name}</p>
                <p style={{ fontSize: 12, color: '#94A3B8', margin: '2px 0 0' }}>
                  {currentUser?.provider === 'kakao' ? '카카오 계정'
                    : currentUser?.provider === 'invite' ? '초대 코드로 시작'
                    : '이메일 계정'}
                </p>
              </div>
              <button onClick={handleLogout} style={{
                border: '1px solid #E2E8F0', borderRadius: 10, padding: '7px 13px',
                background: '#F8F9FA', color: '#64748B', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}>로그아웃</button>
            </div>
          )}
        </div>

        {/* 이름 - invite 유저는 보호자가 설정해서 숨김, guest는 직접 입력 가능 */}
        {currentUser?.provider !== 'invite' && (
          <Card icon={<UserIcon size={15} color="#0D9488" />} title="이름">
            <input type="text" value={profile.name} onChange={e => update('name', e.target.value)}
              placeholder="홍길동" style={inputSt} />
          </Card>
        )}

        {/* 보호자 전화번호 - 길찾기 사용자에게만 표시 */}
        {isRouteUser && (
          <Card icon={<PhoneIcon size={15} color="#0D9488" />} title="보호자 전화번호">
            <input type="tel" value={profile.guardianPhone} onChange={e => update('guardianPhone', e.target.value)}
              placeholder="010-0000-0000" style={inputSt} />
            <p style={{ fontSize: 12, color: '#94A3B8', margin: '6px 0 0' }}>응급 상황 시 알림을 보내드려요</p>
          </Card>
        )}

        {/* 집 주소 */}
        <Card icon={<BuildingIcon size={15} color="#0D9488" />} title="집 주소">
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={profile.homeAddress || ''}
              readOnly
              placeholder="주소 검색 또는 GPS"
              onClick={() => {
                if (window.daum?.Postcode) {
                  new window.daum.Postcode({
                    oncomplete(data) { update('homeAddress', data.roadAddress || data.jibunAddress) },
                  }).open()
                }
              }}
              style={{ ...inputSt, flex: 1, cursor: 'pointer', background: '#F8FAFC' }}
            />
            {/* GPS 버튼 */}
            <button
              onClick={() => {
                if (!navigator.geolocation) return
                update('homeAddress', '감지 중…')
                navigator.geolocation.getCurrentPosition(
                  async pos => {
                    try {
                      const { latitude: lat, longitude: lon } = pos.coords
                      const res = await fetch(
                        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=ko`,
                        { headers: { 'User-Agent': 'SilverPassSeoulCare/1.0' } }
                      )
                      const data = await res.json()
                      const addr = [data.address?.city || data.address?.state, data.address?.city_district || data.address?.suburb, data.address?.road].filter(Boolean).join(' ')
                      update('homeAddress', addr || '')
                    } catch { update('homeAddress', '') }
                  },
                  () => update('homeAddress', '')
                )
              }}
              style={{ flexShrink: 0, width: 44, height: 44, borderRadius: 12, border: '1.5px solid #E2E8F0', background: '#F0FDFA', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#0D9488" strokeWidth="2.2" strokeLinecap="round">
                <circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
              </svg>
            </button>
          </div>
          <p style={{ fontSize: 12, color: '#94A3B8', margin: '6px 0 0' }}>주소를 탭하면 검색창이 열려요 · GPS로 자동 입력도 가능해요</p>
        </Card>

        {/* 최대 도보 시간 */}
        <Card icon={<WalkIcon size={15} color="#0D9488" />} title="최대 도보 시간">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
            {WALK_OPTIONS.map(min => {
              const active = profile.maxWalkMin === min
              return (
                <button key={min} onClick={() => update('maxWalkMin', min)} style={{
                  border: active ? 'none' : '1.5px solid #E2E8F0',
                  borderRadius: 12, padding: '12px 0', fontWeight: 800, fontSize: 15,
                  cursor: 'pointer', transition: 'all 0.15s',
                  background: active ? 'linear-gradient(135deg, #0F766E, #0D9488)' : '#F8F9FA',
                  color: active ? '#fff' : '#64748B',
                  boxShadow: active ? '0 2px 8px rgba(13,148,136,0.25)' : 'none',
                  fontFamily: 'inherit',
                }}>{min}분</button>
              )
            })}
          </div>
        </Card>

        {/* 이동 조건 */}
        <Card icon={<SettingsIcon size={15} color="#0D9488" />} title="이동 조건">
          <p style={{ color: '#64748B', fontSize: 14, fontWeight: 700, lineHeight: 1.45, margin: '0 0 12px' }}>
            선택한 조건은 길찾기 추천 순서에 반영돼요.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Toggle label="계단 없는 길 우선" desc="계단보다 엘리베이터·완만한 길을 먼저 안내" value={!profile.allowStairs} onChange={v => update('allowStairs', !v)} />
            <Toggle label="보행보조기구 사용" desc="휠체어, 워커, 지팡이 등" value={profile.mobilityAid} onChange={v => update('mobilityAid', v)} />
            <Toggle label="저상버스 우선" desc="버스 경로는 저상버스 가능성을 더 우선" value={profile.preferLowFloorBus} onChange={v => update('preferLowFloorBus', v)} />
            <Toggle label="승강기 있는 경로 우선" desc="지하철 출구와 환승은 승강기 접근을 우선" value={profile.preferElevator} onChange={v => update('preferElevator', v)} />
            <Toggle label="환승 적은 길 우선" desc="조금 돌아가도 갈아타는 횟수를 줄이기" value={profile.avoidTransfers} onChange={v => update('avoidTransfers', v)} />
            <Toggle label="중간에 쉴 곳 필요" desc="쉼터·약국 같은 안전 지점을 더 중요하게 보기" value={profile.needRestStops} onChange={v => update('needRestStops', v)} />
            <Toggle label="천천히 걷기" desc="예상 시간을 여유 있게 잡고 도보 부담을 낮추기" value={profile.slowPace} onChange={v => update('slowPace', v)} />
          </div>
        </Card>

        {/* 바로 출발 목적지 */}
        <Card icon={<MapPin size={15} color="#0D9488" />} title="바로 출발 목적지">
          <p style={{ color: '#64748B', fontSize: 14, fontWeight: 700, lineHeight: 1.5, margin: '0 0 12px' }}>
            보호자가 등록한 장소는 홈 화면의 큰 바로 출발 카드로 보여요.
          </p>
          {quickStartPlaces.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {quickStartPlaces.map(place => (
                <div key={place.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  border: '1.5px solid #CCFBF1',
                  borderRadius: 16,
                  background: '#F8FAFC',
                  padding: '12px 13px',
                }}>
                  <div style={{ width: 44, height: 44, borderRadius: 14, background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                    {place.icon}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ fontWeight: 900, fontSize: 16, color: '#0F172A', margin: 0 }}>{place.name}</p>
                    <p style={{ color: '#0F766E', fontSize: 12, fontWeight: 900, margin: '3px 0 0' }}>{place.helper}</p>
                    <p style={{
                      color: '#64748B',
                      fontSize: 13,
                      fontWeight: 700,
                      lineHeight: 1.35,
                      margin: '4px 0 0',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {place.address}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ border: '1.5px dashed #CBD5E1', borderRadius: 16, background: '#F8FAFC', padding: '16px 14px', textAlign: 'center' }}>
              <p style={{ color: '#64748B', fontSize: 14, fontWeight: 800, lineHeight: 1.5, margin: 0 }}>
                보호자 화면에서 목적지를 등록하면 여기에 표시돼요.
              </p>
            </div>
          )}
        </Card>

        {/* 보호자 연결 영역 */}
        {isRouteUser ? (
          <div style={{ background: '#fff', borderRadius: 16, padding: '15px 16px', border: '1.5px solid #F1F5F9', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
              <div style={{ width: 26, height: 26, borderRadius: 7, background: '#F0FDFA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>👨‍👩‍👧</div>
              <p style={{ fontWeight: 700, fontSize: 14, color: '#0F172A', margin: 0 }}>연결된 보호자</p>
            </div>
            {linkedGuardian ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: '#EDE9FE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>👤</div>
                <div>
                  <p style={{ fontWeight: 700, fontSize: 15, color: '#0F172A', margin: 0 }}>{linkedGuardian.name}</p>
                  <p style={{ fontSize: 12, color: '#10B981', margin: '2px 0 0' }}>✅ 연결됨</p>
                </div>
              </div>
            ) : (
              <p style={{ fontSize: 14, color: '#94A3B8', textAlign: 'center', padding: '8px 0' }}>아직 연결된 보호자가 없어요</p>
            )}
          </div>
        ) : (
          <button onClick={() => navigate('/guardian')} style={{
            width: '100%', border: '1.5px solid #E2E8F0', borderRadius: 16, padding: '15px 0',
            background: '#F8F9FA', color: '#0F172A', fontWeight: 700, fontSize: 16, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            fontFamily: 'inherit',
          }}>
            👨‍👩‍👧 보호자 등록
          </button>
        )}

        {/* 저장 */}
        <button onClick={handleSave} style={{
          width: '100%', border: 'none', borderRadius: 16, padding: '18px 0',
          background: saved ? '#059669' : 'linear-gradient(135deg, #0F766E, #0D9488)',
          color: '#fff', fontWeight: 900, fontSize: 19, cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(13,148,136,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          transition: 'background 0.3s', fontFamily: 'inherit', minHeight: 62,
        }}>
          {saved ? <><CheckCircle size={18} color="#fff" /> 저장됐어요!</> : '저장하기'}
        </button>

      </div>
      <BottomNav />
    </div>
  )
}

const inputSt = {
  width: '100%', border: '1.5px solid #CBD5E1', borderRadius: 14,
  padding: '14px 14px', fontSize: 17, outline: 'none',
  background: '#F8F9FA', color: '#0F172A', boxSizing: 'border-box',
  minHeight: 56,
  fontFamily: 'inherit',
}

function Card({ icon, title, children }) {
  return (
    <div style={{ background: '#fff', borderRadius: 18, padding: '17px 16px', border: '1.5px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 13 }}>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: '#F0FDFA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
        <p style={{ fontWeight: 900, fontSize: 17, color: '#0F172A', margin: 0 }}>{title}</p>
      </div>
      {children}
    </div>
  )
}

function Toggle({ label, desc, value, onChange }) {
  const active = Boolean(value)
  return (
    <button
      type="button"
      onClick={() => onChange(!active)}
      role="switch"
      aria-checked={active}
      style={{
        width: '100%',
        minHeight: 82,
        border: active ? '1.5px solid #5EEAD4' : '1.5px solid #E2E8F0',
        borderRadius: 18,
        background: active ? '#F0FDFA' : '#FFFFFF',
        boxShadow: active ? '0 6px 16px rgba(13,148,136,0.12)' : '0 1px 2px rgba(15,23,42,0.04)',
        cursor: 'pointer',
        padding: '13px 13px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        textAlign: 'left',
        fontFamily: 'inherit',
      }}
    >
      <span style={{
        width: 34,
        height: 34,
        borderRadius: 12,
        background: active ? 'linear-gradient(135deg, #0F766E, #0D9488)' : '#F1F5F9',
        border: active ? 'none' : '1.5px solid #CBD5E1',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#FFFFFF',
        fontWeight: 950,
        fontSize: 18,
        flexShrink: 0,
      }}>
        {active ? '✓' : ''}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontWeight: 950, fontSize: 16, color: '#0F172A', lineHeight: 1.25 }}>{label}</span>
        <span style={{ display: 'block', color: '#64748B', fontSize: 13, marginTop: 4, fontWeight: 700, lineHeight: 1.35 }}>{desc}</span>
      </span>
      <span style={{
        flexShrink: 0,
        borderRadius: 999,
        padding: '6px 9px',
        background: active ? '#CCFBF1' : '#F1F5F9',
        color: active ? '#0F766E' : '#64748B',
        fontSize: 12,
        fontWeight: 950,
      }}>
        {active ? '켜짐' : '꺼짐'}
      </span>
    </button>
  )
}
