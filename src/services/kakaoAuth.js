/**
 * 카카오 OAuth 로그인 서비스
 * Kakao JavaScript SDK v2 사용
 * App Key (JavaScript): d77d48048f93debc65e6b4fa073044d3
 */

const KAKAO_KEY = 'd77d48048f93debc65e6b4fa073044d3'
const KAKAO_USER_KEY = 'silverpass_kakao_user'

function initKakao() {
  if (window.Kakao && !window.Kakao.isInitialized()) {
    window.Kakao.init(KAKAO_KEY)
  }
}

/**
 * 카카오 팝업 로그인 → 사용자 정보 반환
 * @returns {Promise<{id: string, name: string, thumbnail: string}>}
 */
export function loginWithKakao() {
  return new Promise((resolve, reject) => {
    initKakao()
    if (!window.Kakao) {
      reject(new Error('카카오 SDK가 로드되지 않았어요. 잠시 후 다시 시도해 주세요.'))
      return
    }
    window.Kakao.Auth.login({
      success: () => {
        window.Kakao.API.request({
          url: '/v2/user/me',
          success: res => {
            const profile = res.kakao_account?.profile || {}
            const user = {
              id: String(res.id),
              name: profile.nickname || '사용자',
              thumbnail: profile.thumbnail_image_url || '',
            }
            localStorage.setItem(KAKAO_USER_KEY, JSON.stringify(user))
            resolve(user)
          },
          fail: err => reject(new Error(err.msg || '사용자 정보를 가져올 수 없어요')),
        })
      },
      fail: err => reject(new Error(err.error_description || '로그인에 실패했어요')),
    })
  })
}

/**
 * 카카오 로그아웃 (토큰 폐기 + 로컬 정리)
 */
export function logoutKakao() {
  initKakao()
  try {
    if (window.Kakao?.Auth?.getAccessToken()) {
      window.Kakao.Auth.logout(() => {})
    }
  } catch {}
  localStorage.removeItem(KAKAO_USER_KEY)
}

/**
 * 로컬스토리지에서 저장된 카카오 사용자 반환
 * @returns {{id: string, name: string, thumbnail: string} | null}
 */
export function getKakaoUser() {
  try {
    return JSON.parse(localStorage.getItem(KAKAO_USER_KEY)) ?? null
  } catch {
    return null
  }
}
