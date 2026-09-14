/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

/**
 * Build date and time, stamped in by vite.config.ts at build time and shown on the title screen.
 *
 * It exists so a tester can be asked which build they are on. A service worker serves the last
 * version it cached, and on iOS a home-screen app that is resumed rather than cold-launched can
 * sit on one for days without ever checking - so "it is still broken" and "you are on Tuesday's
 * build" look identical from here unless the build says so on screen.
 */
declare const __BUILD_STAMP__: string;
