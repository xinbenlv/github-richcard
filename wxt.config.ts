import { defineConfig } from 'wxt';
import { execSync } from 'child_process';
import pkg from './package.json';

const commitHash = (() => {
  try {
    return execSync('git rev-parse --short=6 HEAD').toString().trim();
  } catch {
    return '000000';
  }
})();

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'GitHub RichCard',
    description:
      'Extended info for GitHub repos — one-click DeepWiki, stars, forks, issues, and more',
    permissions: ['storage', 'activeTab'],
    host_permissions: ['https://github.com/*', 'https://api.github.com/*'],
    browser_specific_settings: {
      gecko: {
        id: 'github-richcard@xinbenlv',
        strict_min_version: '109.0',
      },
    },
  },
  vite: () => ({
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      __GIT_COMMIT__: JSON.stringify(commitHash),
    },
  }),
});
