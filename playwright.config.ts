import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  use: { baseURL: process.env['E2E_BASE_URL'] ?? 'http://127.0.0.1:8080', browserName: 'chromium', channel: process.env['E2E_CHANNEL'], launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } },
  reporter: 'list',
});
