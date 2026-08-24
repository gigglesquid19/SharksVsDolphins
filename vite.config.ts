import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
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
      registerType: 'autoUpdate',
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
              expiration: { maxEntries: 4 },
            },
          },
        ],
      },
    }),
  ],
});
