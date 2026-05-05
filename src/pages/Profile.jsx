import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav.jsx'
import { ArrowLeft, UserIcon, PhoneIcon, WalkIcon, SettingsIcon,
         MapPin, CheckCircle, BuildingIcon, HospitalIcon, PillIcon, HomeIcon } from '../components/Icons.jsx'
import { getProfile, saveProfile, markVisited } from '../services/storage.js'
import { getKakaoUser } from '../services/kakaoAuth.js'
import { getCurrentUser, signOut, getLinkedGuardian, syncElderProfileFromSupabase, syncGuardianProfileFromSupabase } from '../services/auth.js'

const WALK_OPTIONS = [10, 15, 20, 30]
const FAV_CFG = {
  복지관: { Icon: BuildingIcon, bg: '#F5F3FF', color: '#7C3AED' },
  병원:   { Icon: HospitalIcon, bg: '#EFF6FF', color: '#2563EB' },
  약국:   { Icon: PillIcon,     bg: '#ECFDF5', color: '#059669' },
  집:     { Icon: HomeIcon,     bg: '#FFFBEB', color: '#D97706' },
}

export default function Profile() {
  const navigate = useNavigate()
  const [profile, setProfile]       = useState(getProfile())
  const [saved, setSaved]           = useState(false)
  const kakaoUser = getKakaoUser()
  const currentUser = getCurrentUser()
  const provider = currentUser?.provider
  const isElderly = provider === 'invite' || provider === 'guest'
  const [linkedGuardian, setLinkedGuardian] = useState(null)

  useEffect(() => {
    if (!currentUser?.id) return
    if (isElderly) {
      getLinkedGuardian(currentUser.id).then(setLinkedGuardian)
      syncElderProfileFromSupabase(currentUser.id).then(() => setProfile(getProfile()))
    } else {
      syncGuardianProfileFromSupabase(currentUser.id).then(() => setProfile(getProfile()))
    }
  }, [isElderly, currentUser?.id])

  function update(key, val)  { setProfile(p => ({ ...p, [key]: val })); setSaved(false) }
  function updateFav(id, field, val) {
    setProfile(p => ({ ...p, favorites: p.favorites.map(f => f.id === id ? { ...f, [field]: val } : f) }))
    setSaved(false)
  }
  function handleSave() { saveProfile(profile); markVisited(); setSaved(true); setTimeout(() => navigate('/'), 800) }

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
                <div style={{ width: 44, height: 44, borderRadius: 12, background: '#F0FDFA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>👴</div>
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

        {/* 보호자 전화번호 - 어르신만 표시 */}
        {isElderly && (
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
          <Toggle label="계단 이용 가능" desc="계단 있는 경로도 안내" value={profile.allowStairs} onChange={v => update('allowStairs', v)} />
          <div style={{ height: 1, background: '#F1F5F9', margin: '12px 0' }} />
          <Toggle label="보행보조기구 사용" desc="휠체어, 워커, 지팡이 등" value={profile.mobilityAid} onChange={v => update('mobilityAid', v)} />
        </Card>

        {/* 자주 가는 곳 */}
        <Card icon={<MapPin size={15} color="#0D9488" />} title="자주 가는 곳">
          {profile.favorites.map((fav, i) => {
            const cfg = FAV_CFG[fav.name] || { Icon: MapPin, bg: '#F0FDFA', color: '#0D9488' }
            const { Icon } = cfg
            return (
              <div key={fav.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: i < profile.favorites.length - 1 ? 12 : 0 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={18} color={cfg.color} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 700, fontSize: 14, color: '#0F172A', margin: '0 0 5px' }}>{fav.name}</p>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input type="text" value={fav.address} readOnly
                      onClick={() => window.daum?.Postcode && new window.daum.Postcode({ oncomplete: d => updateFav(fav.id, 'address', d.roadAddress || d.jibunAddress) }).open()}
                      placeholder="탭해서 주소 검색"
                      style={{ ...inputSt, fontSize: 13, padding: '9px 12px', flex: 1, cursor: 'pointer', background: '#F8FAFC' }} />
                    {fav.address && (
                      <button onClick={() => updateFav(fav.id, 'address', '')}
                        style={{ flexShrink: 0, width: 34, height: 34, borderRadius: 8, border: '1px solid #E2E8F0', background: '#fff', cursor: 'pointer', color: '#94A3B8', fontSize: 14 }}>
                        ×
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </Card>

        {/* 보호자 연결 영역 */}
        {isElderly ? (
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
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <div>
        <p style={{ fontWeight: 900, fontSize: 17, color: '#0F172A', margin: 0 }}>{label}</p>
        <p style={{ color: '#64748B', fontSize: 14, margin: '4px 0 0', fontWeight: 600 }}>{desc}</p>
      </div>
      <button onClick={() => onChange(!value)} role="switch" aria-checked={value} style={{
        width: 58, height: 34, borderRadius: 99, border: 'none', cursor: 'pointer', flexShrink: 0,
        background: value ? 'linear-gradient(135deg, #0F766E, #0D9488)' : '#E2E8F0',
        position: 'relative', transition: 'background 0.2s',
      }}>
        <span style={{
          position: 'absolute', top: 4, width: 26, height: 26, borderRadius: '50%',
          background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
          transition: 'left 0.2s', left: value ? 28 : 4,
        }} />
      </button>
    </div>
  )
}
