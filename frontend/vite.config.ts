import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';

const documents: Plugin = {
  name: 'afterhours-document-routes',
  configureServer(server) {
    server.middlewares.use((request, _response, next) => {
      for (const page of ['login', 'achievements']) {
        if (new RegExp(`^/${page}/?(?:\\?|$)`).test(request.url || '')) {
          request.url = request.url!.replace(new RegExp(`^/${page}/?`), `/pages/${page}/index.html`);
          break;
        }
      }
      next();
    });
  },
};

export default defineConfig({
  // Absolute /assets URLs belong to the existing authenticated/static server.
  plugins: [vue({ template: { transformAssetUrls: { includeAbsolute: false } } }), documents],
  publicDir: false,
  build: {
    outDir: 'dist',
    assetsDir: 'frontend-assets',
    manifest: true,
    target: 'es2022',
    rolldownOptions: {
      input: {
        login: fileURLToPath(new URL('./pages/login/index.html', import.meta.url)),
        achievements: fileURLToPath(new URL('./pages/achievements/index.html', import.meta.url)),
      },
    },
  },
  server: {
    proxy: {
      '^/(?!pages/|src/|@|node_modules/|frontend-assets/)': {
        target: 'http://127.0.0.1:3140',
        changeOrigin: true,
        configure(proxy) {
          proxy.on('proxyReq', (upstream, request) => {
            // Keep legitimate dev-origin requests equivalent at the backend.
            // Other Origin values remain unchanged and are rejected normally.
            if (request.headers.origin === `http://${request.headers.host}`) {
              upstream.setHeader('Origin', 'http://127.0.0.1:3140');
            }
          });
        },
      },
    },
  },
});
