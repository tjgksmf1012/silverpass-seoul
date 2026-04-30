import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav.jsx'
import { ArrowLeft, UserIcon, PhoneIcon, WalkIcon, SettingsIcon,
         MapPin, CheckCircle, BuildingIcon, HospitalIcon, PillIcon, HomeIcon } from '../components/Icons.jsx'
import { getProfile, saveProfile, markVisited } from '../services/storage.js'
import { loginWithKakao, logoutKakao, getKakaoUser } from '../services/kakaoAuth.js'

const WALK_OPTIONS = [10, 15, 20, 30]
const FAV_CFG = {
  복지관: { Icon: BuildingIcon, bg: '#F5F3FF', color: '#7C3AED' },
  병원:   { Icon: HospitalIcon, bg: '#EFF6FF', color: '#2563EB' },
  약국:   { Icon: PillIcon,     bg: '#ECFDF5', color: '#059669' },
  집:     { Icon: HomeIcon,     bg: '#FFFBEB', color: '#D97706' },
}
const DISTRICTS = [
  '종로구','중구','용산구','성동구','광진구','동대문구','중랑구','성북구',
  '강북구','도봉구','노원구','은평구','서대문구','마포구','양천구','강서구',
  '구로구','금천구','영등포구','동작구','관악구','서초구','강남구','송파구','강동구',
]

export default function Profile() {
  const navigate = useNavigate()
  const [profile, setProfile]       = useState(getProfile())
  const [saved, setSaved]           = useState(false)
  const [kakaoUser, setKakaoUser]   = useState(getKakaoUser())
  const [kakaoLoading, setKakaoLoading] = useState(false)

  function update(key, val)  { setProfile(p => ({ ...p, [key]: val })); setSaved(false) }
  function updateFav(id, field, val) {
    setProfile(p => ({ ...p, favorites: p.favorites.map(f => f.id === id ? { ...f, [field]: val } : f) }))
    setSaved(false)
  }
  function handleSave() { saveProfile(profile); markVisited(); setSaved(true); setTimeout(() => navigate('/'), 800) }

  async function handleKakaoLogin() {
    setKakaoLoading(true)
    try {
      const user = await loginWithKakao()
      setKakaoUser(user)
      if (!profile.name && user.name) update('name', user.name)
    } catch (e) {
      alert(e.message || '카카오 로그인에 실패했어요')
    } finally { setKakaoLoading(false) }
  }

  function handleKakaoLogout() {
    logoutKakao()
    setKakaoUser(null)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F0F4F8', paddingBottom: 100 }}>

      {/* 그라디언트 헤더 */}
      <div style={{
        background: 'linear-gradient(165deg, #064E3B 0%, #0F766E 50%, #0D9488 100%)',
        padding: '52px 18px 24px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button onClick={() => { markVisited(); navigate('/') }} style={{
            width: 38, height: 38, borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.25)',
            background: 'rgba(255,255,255,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}>
            <ArrowLeft size={18} color="#fff" />
          </button>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: '#fff', margin: 0 }}>내 정보</h1>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', margin: '2px 0 0' }}>맞춤 경로를 위한 설정</p>
          </div>
        </div>
      </div>

      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* ── 카카오 로그인 ── */}
        <div style={{ background: '#fff', borderRadius: 16, padding: '15px 16px', border: '1.5px solid #F1F5F9', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          {kakaoUser ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {kakaoUser.thumbnail
                ? <img src={kakaoUser.thumbnail} alt="" style={{ width: 44, height: 44, borderRadius: 12, objectFit: 'cover' }} />
                : (
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: '#FEE500', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 20 }}>👤</span>
                  </div>
                )
              }
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 800, fontSize: 15, color: '#0F172A', margin: 0 }}>{kakaoUser.name}</p>
                <p style={{ fontSize: 12, color: '#94A3B8', margin: '2px 0 0' }}>카카오 계정으로 로그인됨</p>
              </div>
              <button onClick={handleKakaoLogout} style={{
                border: '1px solid #E2E8F0', borderRadius: 10, padding: '7px 13px',
                background: '#F8F9FA', color: '#64748B', fontSize: 13, fontWeight: 700,
                cursor: 'pointer',
              }}>로그아웃</button>
            </div>
          ) : (
            <div>
              <p style={{ fontWeight: 700, fontSize: 14, color: '#0F172A', margin: '0 0 10px' }}>카카오로 간편 로그인</p>
              <button onClick={handleKakaoLogin} disabled={kakaoLoading} style={{
                width: '100%', background: '#FEE500', border: 'none', borderRadius: 12,
                padding: '13px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                cursor: kakaoLoading ? 'not-allowed' : 'pointer', opacity: kakaoLoading ? 0.7 : 1,
              }}>
                <svg width={18} height={18} viewBox="0 0 24 24" fill="#3C1E1E">
                  <path d="M12 3C6.48 3 2 6.69 2 11.2c0 2.93 1.9 5.5 4.78 6.97l-.96 3.58c-.07.26.22.47.46.33l4.35-2.87c.44.05.89.09 1.37.09 5.52 0 10-3.69 10-8.2S17.52 3 12 3z"/>
                </svg>
                <span style={{ fontWeight: 800, fontSize: 15, color: '#3C1E1E' }}>
                  {kakaoLoading ? '로그인 중…' : '카카오 로그인'}
                </span>
              </button>
              <p style={{ fontSize: 12, color: '#94A3B8', textAlign: 'center', margin: '8px 0 0' }}>이름이 자동으로 입력돼요</p>
            </div>
          )}
        </div>

        {/* 이름 */}
        <Card icon={<UserIcon size={15} color="#0D9488" />} title="이름">
          <input type="text" value={profile.name} onChange={e => update('name', e.target.value)}
            placeholder="홍길동" style={inputSt} />
        </Card>

        {/* 보호자 전화번호 */}
        <Card icon={<PhoneIcon size={15} color="#0D9488" />} title="보호자 전화번호">
          <input type="tel" value={profile.guardianPhone} onChange={e => update('guardianPhone', e.target.value)}
            placeholder="010-0000-0000" style={inputSt} />
          <p style={{ fontSize: 12, color: '#94A3B8', margin: '6px 0 0' }}>응급 상황 시 알림을 보내드려요</p>
        </Card>

        {/* 거주 구 */}
        <Card icon={<BuildingIcon size={15} color="#0D9488" />} title="거주 구">
          <select value={profile.district} onChange={e => update('district', e.target.value)}
            style={{ ...inputSt, appearance: 'none', cursor: 'pointer' }}>
            {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
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
                  <input type="text" value={fav.address} onChange={e => updateFav(fav.id, 'address', e.target.value)}
                    placeholder="주소 입력 (선택)" style={{ ...inputSt, fontSize: 13, padding: '9px 12px' }} />
                </div>
              </div>
            )
          })}
        </Card>

        {/* 저장 */}
        <button onClick={handleSave} style={{
          width: '100%', border: 'none', borderRadius: 16, padding: '17px 0',
          background: saved ? '#059669' : 'linear-gradient(135deg, #0F766E, #0D9488)',
          color: '#fff', fontWeight: 800, fontSize: 17, cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(13,148,136,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          transition: 'background 0.3s', fontFamily: 'inherit',
        }}>
          {saved ? <><CheckCircle size={18} color="#fff" /> 저장됐어요!</> : '저장하기'}
        </button>

      </div>
      <BottomNav />
    </div>
  )
}

const inputSt = {
  width: '100%', border: '1.5px solid #E2E8F0', borderRadius: 12,
  padding: '12px 13px', fontSize: 15, outline: 'none',
  background: '#F8F9FA', color: '#0F172A', boxSizing: 'border-box',
  fontFamily: 'inherit',
}

function Card({ icon, title, children }) {
  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: '14px 15px', border: '1.5px solid #F1F5F9', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
        <div style={{ width: 26, height: 26, borderRadius: 7, background: '#F0FDFA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
        <p style={{ fontWeight: 700, fontSize: 14, color: '#0F172A', margin: 0 }}>{title}</p>
      </div>
      {children}
    </div>
  )
}

function Toggle({ label, desc, value, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <div>
        <p style={{ fontWeight: 700, fontSize: 14, color: '#0F172A', margin: 0 }}>{label}</p>
        <p style={{ color: '#94A3B8', fontSize: 12, margin: '2px 0 0' }}>{desc}</p>
      </div>
      <button onClick={() => onChange(!value)} role="switch" aria-checked={value} style={{
        width: 48, height: 28, borderRadius: 99, border: 'none', cursor: 'pointer', flexShrink: 0,
        background: value ? 'linear-gradient(135deg, #0F766E, #0D9488)' : '#E2E8F0',
        position: 'relative', transition: 'background 0.2s',
      }}>
        <span style={{
          position: 'absolute', top: 3, width: 22, height: 22, borderRadius: '50%',
          background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
          transition: 'left 0.2s', left: value ? 23 : 3,
        }} />
      </button>
    </div>
  )
}
