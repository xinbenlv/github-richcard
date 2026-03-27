import ReactDOM from 'react-dom/client';
import { Sidebar } from './Sidebar';
import sidebarStyles from './sidebar.css?inline';

export default defineContentScript({
  matches: ['https://github.com/*/*'],
  cssInjectionMode: 'manual',

  main() {
    // Create a host element with shadow DOM for full style isolation
    const host = document.createElement('div');
    host.id = 'github-richcard-host';
    host.style.cssText = 'all: initial; position: fixed; z-index: 2147483644; top: 0; right: 0; pointer-events: none;';
    document.body.appendChild(host);

    const shadow = host.attachShadow({ mode: 'open' });

    const styleEl = document.createElement('style');
    styleEl.textContent = sidebarStyles;
    shadow.appendChild(styleEl);

    const mount = document.createElement('div');
    mount.style.cssText = 'pointer-events: auto;';
    shadow.appendChild(mount);

    const root = ReactDOM.createRoot(mount);
    root.render(<Sidebar />);
  },
});
