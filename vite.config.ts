import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Vite 开发/构建配置
// - 别名 '@' → ./src，便于按模块路径导入（与 tsconfig paths 对应）
// - 开发服务器运行在 3000 端口，将 '/api' 反向代理到后端 3001，
//   使前端可用同源地址 '/api/...' 调用接口（避免跨域）
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
