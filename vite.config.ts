import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Served from the domain root in the Capacitor Android app and in local dev,
  // but from a project sub-path on GitHub Pages - the Pages workflow sets
  // VITE_BASE=/SharksVsDolphins/. Vite rewrites index.html and CSS url()s from
  // this; runtime asset paths in src/ use import.meta.env.BASE_URL to match.
  base: process.env.VITE_BASE || '/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
  },
  plugins: [
    VitePWA({
      // We already ship a hand-authored public/manifest.json (with the real icon set) -
      // let the plugin only generate/register the service worker, not a competing manifest.
      manifest: false,
      injectRegister: false,
      // 'prompt', not 'autoUpdate': a new deploy must NOT swap JS chunks under a running
      // game (old hashed chunks are deleted from Pages on every deploy, so a mid-session
      // swap leaves the page requesting files that now 404 and the loop dies). The new
      // service worker installs and waits; it takes over on the next cold launch, when the
      // asset set is guaranteed consistent.
      registerType: 'prompt',
      workbox: {
        // Audio is cached at runtime (first play), not precached at install - it's large
        // relative to everything else here and shouldn't block/bloat the initial install.
        globPatterns: ['**/*.{js,css,html,webp,png,svg,json}'],
        runtimeCaching: [
          {
            urlPattern: /\.(?:mp3|ogg)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'svsd-audio',
              expiration: { maxEntries: 6 },
            },
          },
        ],
      },
    }),
  ],
});
