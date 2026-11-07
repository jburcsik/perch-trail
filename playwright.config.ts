import { defineConfig, devices } from '@playwright/test';
import { readFileSync } from 'fs';

// Load .env.local into the test process so specs can read TEST_ADMIN_EMAIL/PASSWORD,
// ADMIN_EMAILS, Supabase keys, etc. (Playwright, unlike Next.js, doesn't auto-load it.)
try {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
  }
} catch { /* no .env.local: specs that need it will skip */ }

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Cap local workers so a run on a low-core dev machine doesn't thrash; CI runs serially.
  workers: process.env.CI ? 1 : 2,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],

  // E2E runs against a production build (next start), not next dev. The Turbopack
  // dev server hits intermittent HMR panics that remount pages mid-test; a prod
  // build has no watcher/HMR and is deterministic. scripts/e2e-server.sh also
  // builds once and starts the server with the right env.
  // Set E2E_DEV_SERVER=1 to fall back to `next dev` if you really need HMR.
  webServer: {
    command: process.env.E2E_DEV_SERVER ? 'npm run dev' : 'bash scripts/e2e-server.sh',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
