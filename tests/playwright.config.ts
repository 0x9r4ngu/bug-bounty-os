import { defineConfig, devices } from '@playwright/test';
import path from 'path';

// bounty/os is a hash-routed SPA served by a pure-Python backend (app.py).
// The webServer below starts that backend against an ISOLATED, freshly-seeded SQLite
// database (DB_PATH + a non-existent SEED_MARKER => demo data is seeded once per run),
// so E2E never touches the user's real data/bugbounty.db. `pretest` wipes .tmp first.
const PORT = process.env.E2E_PORT ?? '8788';
const baseURL = `http://127.0.0.1:${PORT}`;
const tmp = path.resolve(__dirname, '.tmp');
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './e2e/tests',
  // A single Python process backed by one SQLite file is shared by all tests, so runs
  // are serial for data determinism (Core Principle 4: serial only when isolation is
  // genuinely impossible — a shared single DB qualifies).
  fullyParallel: false,
  workers: 1,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Reuse the system Chromium instead of downloading Playwright's bundled build.
    launchOptions: { executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium' },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'python3 app.py',
    cwd: path.resolve(__dirname, '..'),
    url: baseURL,
    reuseExistingServer: !isCI,
    timeout: 60_000,
    env: {
      PORT,
      DB_PATH: path.join(tmp, 'e2e.db'),
      SEED_MARKER: path.join(tmp, 'e2e.never-created'),
    },
  },
});
