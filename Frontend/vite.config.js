import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': ['framer-motion', 'lucide-react'],
          'vendor-charts': ['recharts'],
          'vendor-flow': ['@xyflow/react', 'dagre'],
          'vendor-math': ['katex', 'rehype-katex', 'remark-gfm', 'remark-math']
        }
      }
    },
    chunkSizeWarningLimit: 600
  }
})
