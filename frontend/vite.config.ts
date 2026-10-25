import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';
import pages from './pages.json' with { type: 'json' };

const documents: Plugin = {
  name: 'afterhours-document-routes',
  configureServer(server) {
    server.middlewares.use((request, _response, next) => {
      const url = new URL(request.url || '/', 'http://localhost');
      for (const page of pages) {
        if (
          url.pathname === page.route ||
          url.pathname === page.route + '/' ||
          ([
            'draw',
            'musicquiz',
            'minimal',
            'lounge',
            'bluff',
            'telephone',
            'majority',
            'trpg',
            'gift',
            'poker',
            'quacks',
            'race',
          ].includes(page.id) &&
            new RegExp('^' + page.route + '/[a-f0-9]{6}/?$', 'i').test(url.pathname))
        ) {
          request.url = `/pages/${page.id}/index.html${url.search}`;
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
      input: Object.fromEntries(
        pages.map((page) => [
          page.id,
          fileURLToPath(new URL(`./pages/${page.id}/index.html`, import.meta.url)),
        ]),
      ),
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
