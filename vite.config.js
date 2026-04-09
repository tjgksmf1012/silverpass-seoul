import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // 로컬 Vite dev 서버에서 Seoul API를 직접 호출할 때 CORS 우회
    proxy: {
      '/api/seoul': {
        target: 'http://openapi.seoul.go.kr:8088',
        changeOrigin: true,
        rewrite: () => '/',  // seoulApi.js가 직접 URL 조합하므로 프록시는 경로만 열어둠
      },
    },
  },
})
