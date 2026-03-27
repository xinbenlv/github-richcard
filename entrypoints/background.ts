export default defineBackground(() => {
  // Forward messages from popup to content script tab
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'TOGGLE_SIDEBAR') {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const id = tabs[0]?.id;
        if (id) {
          chrome.tabs.sendMessage(id, { type: 'TOGGLE_SIDEBAR' });
        }
      });
      sendResponse({ ok: true });
    }
  });
});
