import { defineConfig } from 'vite'; // ^4.4.5
import react from '@vitejs/plugin-react'; // ^4.0.3
import tsconfigPaths from 'vite-tsconfig-paths'; // ^4.2.0
import svgr from 'vite-plugin-svgr'; // ^3.2.0

export default defineConfig({
  plugins: [
    react(),
    tsconfigPaths(),
    svgr()
  ],

  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false
      },
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true
      }
    },
    cors: true,
    hmr: {
      overlay: true
    }
  },

  build: {
    outDir: 'dist',
    sourcemap: true,
    minify: 'terser',
    target: 'esnext',
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          // Split vendor chunks for optimal caching
          vendor: ['react', 'react-dom', 'react-router-dom'],
          ui: ['@mui/material', '@mui/icons-material'],
          charts: ['recharts']
        }
      }
    }
  },

  resolve: {
    alias: {
      '@': '/src' // Aligns with tsconfig paths
    }
  },

  css: {
    modules: {
      localsConvention: 'camelCase'
    },
    preprocessorOptions: {
      scss: {
        additionalData: '@import "src/styles/variables.scss";'
      }
    }
  },

  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'src/test/']
    }
  }
});