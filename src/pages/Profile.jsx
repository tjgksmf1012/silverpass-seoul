import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav.jsx'
import { ArrowLeft, UserIcon, PhoneIcon, WalkIcon, SettingsIcon, MapPin, CheckCircle, BuildingIcon } from '../components/Icons.jsx'
import { getProfile, saveProfile } from '../services/storage.js'

const WALK_OPTIONS = [10, 15, 20, 30]
const FAV_ICONS = { 복지관: '🏛️', 병원: '🏥', 약국: '💊', 집: '🏠' }
const DISTRICTS = [
  '종로구','중구','용산구','성동구','광진구','동대문구','중랑구','성북구',
  '강북구','도봉구','노원구','은평구','서대문구','마포구','양천구','강서구',
  '구로구','금천구','영등포구','동작구','관악구','서초구','강남구','송파구','강동구',
]

export default function Profile() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState(getProfile())
  const [saved, setSaved] = useState(false)

  function update(key, val) { setProfile(p => ({ ...p, [key]: val })); setSaved(false) }
  function updateFav(id, field, val) {
    setProfile(p => ({ ...p, favorites: p.favorites.map(f => f.id === id ? { ...f, [field]: val } : f) }))
    setSaved(false)
  }
  function handleSave() { saveProfile(profile); setSaved(true); setTimeout(() => navigate('/'), 800) }

  return (
    <div style={{ minHeight: '100vh', background: '#F8F9FA', paddingBottom: 100 }}>

      {/* 헤더 */}
      <div style={{ background: '#fff', padding: '52px 16px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', gap: 14 }}>
        <button onClick={() => navigate('/')} style={{ width: 40, height: 40, borderRadius: 12, border: '1.5px solid #E2E8F0', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <ArrowLeft size={18} color="#0F172A" />
        </button>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', margin: 0 }}>내 프로필</h1>
          <p style={{ fontSize: 13, color: '#94A3B8', margin: '2px 0 0' }}>맞춤형 경로를 위해 정보를 입력해 주세요</p>
        </div>
      </div>

      <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* 이름 */}
        <Card icon={<UserIcon size={16} color="#0D9488" />} title="이름 (선택)">
          <input type="text" value={profile.name} onChange={e => update('name', e.target.value)}
            placeholder="홍길동" style={inputSt} />
        </Card>

        {/* 보호자 전화번호 */}
        <Card icon={<PhoneIcon size={16} color="#0D9488" />} title="보호자 전화번호">
          <input type="tel" value={profile.guardianPhone} onChange={e => update('guardianPhone', e.target.value)}
            placeholder="010-0000-0000" style={inputSt} />
          <p style={{ fontSize: 12, color: '#94A3B8', margin: '8px 0 0' }}>응급 상황 및 이동 완료 시 알림을 드려요</p>
        </Card>

        {/* 거주 구 */}
        <Card icon={<BuildingIcon size={16} color="#0D9488" />} title="거주 구 (대기질·약국 정보 기준)">
          <select value={profile.district} onChange={e => update('district', e.target.value)}
            style={{ ...inputSt, appearance: 'none', cursor: 'pointer' }}>
            {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </Card>

        {/* 최대 도보 시간 */}
        <Card icon={<WalkIcon size={16} color="#0D9488" />} title="최대 도보 시간">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
            {WALK_OPTIONS.map(min => {
              const active = profile.maxWalkMin === min
              return (
                <button key={min} onClick={() => update('maxWalkMin', min)} style={{
                  border: active ? 'none' : '1.5px solid #E2E8F0',
                  borderRadius: 12, padding: '13px 0', fontWeight: 800, fontSize: 15,
                  cursor: 'pointer', transition: 'all 0.15s',
                  background: active ? 'linear-gradient(135deg, #0F766E, #0D9488)' : '#fff',
                  color: active ? '#fff' : '#64748B',
                  boxShadow: active ? '0 3px 12px rgba(13,148,136,0.25)' : 'none',
                }}>{min}분</button>
              )
            })}
          </div>
        </Card>

        {/* 이동 조건 */}
        <Card icon={<SettingsIcon size={16} color="#0D9488" />} title="이동 조건">
          <Toggle label="계단 이용 가능" desc="계단이 있는 경로도 안내해요" value={profile.allowStairs} onChange={v => update('allowStairs', v)} />
          <div style={{ height: 1, background: '#F1F5F9', margin: '14px 0' }} />
          <Toggle label="보행보조기구 사용" desc="휠체어, 워커, 지팡이 등" value={profile.mobilityAid} onChange={v => update('mobilityAid', v)} />
        </Card>

        {/* 자주 가는 곳 */}
        <Card icon={<MapPin size={16} color="#0D9488" />} title="자주 가는 곳 주소">
          {profile.favorites.map((fav, i) => (
            <div key={fav.id} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: i < profile.favorites.length - 1 ? 14 : 0 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: '#F0FDFA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                {FAV_ICONS[fav.name] || '📍'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 700, fontSize: 14, color: '#0F172A', margin: '0 0 6px' }}>{fav.name}</p>
                <input type="text" value={fav.address} onChange={e => updateFav(fav.id, 'address', e.target.value)}
                  placeholder="주소 입력 (선택)" style={{ ...inputSt, fontSize: 13, padding: '10px 13px' }} />
              </div>
            </div>
          ))}
        </Card>

        {/* 저장 */}
        <button onClick={handleSave} style={{
          width: '100%', border: 'none', borderRadius: 16, padding: '18px 0',
          background: saved ? '#059669' : 'linear-gradient(135deg, #0F766E, #0D9488)',
          color: '#fff', fontWeight: 800, fontSize: 17, cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(13,148,136,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          transition: 'background 0.3s',
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
  padding: '13px 14px', fontSize: 16, outline: 'none',
  background: '#F8F9FA', color: '#0F172A', boxSizing: 'border-box',
  fontFamily: 'inherit',
}

function Card({ icon, title, children }) {
  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: '18px', border: '1.5px solid #F1F5F9', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: '#F0FDFA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
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
        <p style={{ fontWeight: 700, fontSize: 15, color: '#0F172A', margin: 0 }}>{label}</p>
        <p style={{ color: '#94A3B8', fontSize: 13, margin: '3px 0 0' }}>{desc}</p>
      </div>
      <button onClick={() => onChange(!value)} role="switch" aria-checked={value} style={{
        width: 52, height: 30, borderRadius: 99, border: 'none', cursor: 'pointer', flexShrink: 0,
        background: value ? 'linear-gradient(135deg, #0F766E, #0D9488)' : '#E2E8F0',
        position: 'relative', transition: 'background 0.2s',
        boxShadow: value ? '0 2px 8px rgba(13,148,136,0.3)' : 'none',
      }}>
        <span style={{
          position: 'absolute', top: 3, width: 24, height: 24, borderRadius: '50%',
          background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
          transition: 'left 0.2s', left: value ? 25 : 3,
        }} />
      </button>
    </div>
  )
}
