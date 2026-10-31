import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
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
            'coc',
            'gift',
            'poker',
            'quacks',
            'race',
            'ceo',
            'second-wind',
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

// Image paths written in the sources (/assets/...png|webp|svg|jpg|gif) get their
// file's content version (?v=), the same value the server checks, so browsers keep
// them until the bytes change. Paths built at runtime are left alone.
const publicRoot = fileURLToPath(new URL('../public', import.meta.url));
const versions = new Map<string, string | null>();
function versionOf(pathname: string) {
  if (!versions.has(pathname)) {
    const file = publicRoot + pathname;
    versions.set(
      pathname,
      existsSync(file)
        ? createHash('sha256').update(readFileSync(file)).digest('base64url').slice(0, 12)
        : null,
    );
  }
  return versions.get(pathname);
}
const ASSET =
  /(\/assets\/[A-Za-z0-9_./-]+\.(?:png|webp|svg|jpe?g|gif))(\?[A-Za-z0-9_=&.-]*)?(?=['"`)\s])/g;
function versionAssets(code: string) {
  return code.replace(ASSET, (match, pathname: string, query = '') => {
    const version = versionOf(pathname);
    if (!version || /[?&]v=/.test(query)) return match;
    return pathname + (query ? query + '&' : '?') + 'v=' + version;
  });
}
const assetVersions: Plugin = {
  name: 'afterhours-asset-versions',
  enforce: 'pre',
  transform(code, id) {
    if (!/\/frontend\/src\/.*\.(?:vue|ts|js|scss|css)(?:\?|$)/.test(id)) return null;
    const next = versionAssets(code);
    return next === code ? null : { code: next, map: null };
  },
  transformIndexHtml: (html) => versionAssets(html),
};

export default defineConfig({
  // Absolute /assets URLs belong to the existing authenticated/static server.
  plugins: [
    assetVersions,
    vue({ template: { transformAssetUrls: { includeAbsolute: false } } }),
    documents,
  ],
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
