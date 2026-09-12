#!/usr/bin/env node
/**
 * Release preflight: refuses to let a build ship while any third-party identifier is still a
 * placeholder.
 *
 * Every one of these is a value the app points at in someone else's console - AdMob, Play
 * Billing, Play Games Services - and every one of them is harmless during development and
 * expensive in production. Test ad units earn nothing and violate AdMob policy; a missing
 * billing product silently hides the paid Continue; an unconfigured Play Games project fails
 * sign-in with DEVELOPER_ERROR and drops players back to local leaderboards. None of them
 * break a build or a test, which is exactly why they need a gate of their own.
 *
 * This is deliberately NOT wired into `npm run build`. Day-to-day builds are supposed to carry
 * the test identifiers - swapping them in and out to develop is how people end up clicking
 * their own live ads. It guards the release scripts only.
 *
 * What it cannot tell you: whether an ID that is no longer a placeholder is the RIGHT one, or
 * whether the products and leaderboards it names actually exist in Play Console. It only
 * catches the values nobody has touched yet.
 *
 * Usage: node tools/preflight-release.mjs
 *   Exit 0 - nothing left to replace.
 *   Exit 1 - at least one blocker; each is printed with the file to edit.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Google's public test publisher. Every one of its IDs is a test ID, so match the prefix. */
const ADMOB_TEST_PUBLISHER = 'ca-app-pub-3940256099942544';

const read = (relative) => {
  const path = join(ROOT, relative);
  return existsSync(path) ? readFileSync(path, 'utf8') : null;
};

const blockers = [];
const notes = [];

/** @param {string} file @param {string} what @param {string} fix */
const block = (file, what, fix) => blockers.push({ file, what, fix });

// ---------------------------------------------------------------- AdMob
const adsXml = read('android/app/src/main/res/values/ads-ids.xml');
if (adsXml === null) {
  notes.push('android/app/src/main/res/values/ads-ids.xml is missing - skipped the AdMob app id check.');
} else if (adsXml.includes(ADMOB_TEST_PUBLISHER)) {
  block(
    'android/app/src/main/res/values/ads-ids.xml',
    'admob_app_id is still Google’s test app id',
    'Paste your real AdMob application id (AdMob → App settings). App ids contain a "~".',
  );
}

const adsTs = read('src/ads.ts');
if (adsTs === null) {
  notes.push('src/ads.ts is missing - skipped the ad unit checks.');
} else {
  for (const unit of ['rewarded', 'interstitial']) {
    const match = adsTs.match(new RegExp(`${unit}:\\s*'([^']+)'`));
    if (match && match[1].startsWith(ADMOB_TEST_PUBLISHER)) {
      block(
        'src/ads.ts',
        `the ${unit} ad unit is still a Google test unit`,
        `Paste your real ${unit} unit id (AdMob → Ad units). Unit ids contain a "/".`,
      );
    }
  }
}

// ---------------------------------------------------------------- Play Games Services
const gamesXml = read('android/app/src/main/res/values/games-ids.xml');
if (gamesXml === null) {
  notes.push('android/app/src/main/res/values/games-ids.xml is missing - skipped the project id check.');
} else {
  const projectId = gamesXml.match(/name="game_services_project_id"[^>]*>([^<]*)</)?.[1]?.trim() ?? '';
  // A real project id is a plain number and is never all zeroes.
  if (!/^\d+$/.test(projectId) || /^0+$/.test(projectId)) {
    block(
      'android/app/src/main/res/values/games-ids.xml',
      `game_services_project_id is a placeholder (${projectId || 'empty'})`,
      'Paste the numeric Project ID from Play Console → Play Games Services → Configuration.',
    );
  }
}

const playGamesTs = read('src/playGames.ts');
if (playGamesTs === null) {
  notes.push('src/playGames.ts is missing - skipped the leaderboard id checks.');
} else {
  for (const board of ['campaign', 'endless']) {
    const value = playGamesTs.match(new RegExp(`${board}:\\s*'([^']*)'`))?.[1] ?? '';
    if (!value || value.includes('REPLACE_WITH') || !value.startsWith('CgkI')) {
      block(
        'src/playGames.ts',
        `the ${board} leaderboard id is not a real one (${value || 'empty'})`,
        'Create the leaderboard in Play Games Services and paste its id. Real ids start "CgkI".',
      );
    }
  }
}

// ---------------------------------------------------------------- Release signing
// Not a placeholder, but the same class of problem: the Gradle config deliberately leaves the
// release build UNSIGNED when the keystore properties are absent, rather than failing, so a
// missing keystore produces an artifact Play will reject rather than an error you can see.
if (!existsSync(join(ROOT, 'android/keystore/keystore.properties'))) {
  block(
    'android/keystore/keystore.properties',
    'the release keystore properties are missing, so a release build would be left unsigned',
    'Restore the gitignored keystore and its properties file before building for upload.',
  );
}

// ---------------------------------------------------------------- Report
const BOLD = '[1m';
const RED = '[31m';
const GREEN = '[32m';
const DIM = '[2m';
const OFF = '[0m';

console.log(`\n${BOLD}Release preflight${OFF}`);

if (blockers.length === 0) {
  console.log(`${GREEN}No placeholder identifiers left.${OFF}`);
  console.log(
    `${DIM}It cannot tell whether these ids are the right ones, or whether the products and\n` +
      `leaderboards they name exist in Play Console. Check a real purchase and a real sign-in\n` +
      `from the internal testing track before you promote a build.${OFF}\n`,
  );
  for (const note of notes) console.log(`${DIM}note: ${note}${OFF}`);
  process.exit(0);
}

console.log(`${RED}${blockers.length} blocker${blockers.length === 1 ? '' : 's'} still to clear.${OFF}\n`);
for (const { file, what, fix } of blockers) {
  console.log(`  ${RED}x${OFF} ${what}`);
  console.log(`    ${DIM}${file}${OFF}`);
  console.log(`    ${fix}\n`);
}
for (const note of notes) console.log(`${DIM}note: ${note}${OFF}`);
console.log(`${DIM}Day-to-day builds are meant to carry the test ids - this guards the release\nscripts only, so nothing here blocks npm run build or npm run build:android.${OFF}\n`);
process.exit(1);
