import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command }) => {
  return {
    plugins: [react()],
    server: {
      host: '0.0.0.0', // 👈 Forces Vite to listen on both IPv4 and IPv6 loops
      port: 5173,
      allowedHosts: true,
      cors: true,
      hmr: {
        clientPort: 443,
      },
      proxy: {
        '^/(activity|answer-planner|api-keys|api|chat|create-timetable|dashboard|documents|features|feynman|flashcards|generate-flashcards|generate-mindmap|generate-podcast|generate-quiz|guest|health|insights|login|logout|metrics|mindmap-details|mindmaps|podcast-status|podcasts|progress|quiz-history|request-otp|rooms|speak|static|stt|student-insights|study-flashcard|submit-quiz|summaries|summarize|timetable|translate|update-timetable-progress|upload-avatar|upload-document|upload-url|users|verify-otp|voice-samples)': {
          target: 'http://127.0.0.1:8000',
          changeOrigin: true,
          ws: true,
          bypass(req) {
            // If the browser is requesting an HTML page (direct navigation or refresh on /login, /documents, etc.),
            // serve Vite's SPA index.html so React Router handles the page
            if (req.method === 'GET' && req.headers.accept && req.headers.accept.includes('text/html')) {
              return '/index.html';
            }
          }
        }
      }
    },
    preview: {
      host: '0.0.0.0',
      port: 5173,
      allowedHosts: true,
      cors: true,
      proxy: {
        '^/(activity|answer-planner|api-keys|api|chat|create-timetable|dashboard|documents|features|feynman|flashcards|generate-flashcards|generate-mindmap|generate-podcast|generate-quiz|guest|health|insights|login|logout|metrics|mindmap-details|mindmaps|podcast-status|podcasts|progress|quiz-history|request-otp|rooms|speak|static|stt|student-insights|study-flashcard|submit-quiz|summaries|summarize|timetable|translate|update-timetable-progress|upload-avatar|upload-document|upload-url|users|verify-otp|voice-samples)': {
          target: 'http://127.0.0.1:8000',
          changeOrigin: true,
          ws: true,
          bypass(req) {
            if (req.method === 'GET' && req.headers.accept && req.headers.accept.includes('text/html')) {
              return '/index.html';
            }
          }
        }
      }
    },
    build: {
      rollupOptions: command === 'build' ? {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-ui': ['framer-motion', 'lucide-react'],
            'vendor-charts': ['recharts'],
            'vendor-flow': ['@xyflow/react', 'dagre'],
            'vendor-math': ['katex', 'rehype-katex', 'remark-gfm', 'remark-math']
          }
        }
      } : {},
      chunkSizeWarningLimit: 600
    }
  }
})
