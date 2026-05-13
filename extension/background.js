// Background service worker
// Gets a tabCapture stream ID and passes it to the content script
// so content script can call getUserMedia({chromeMediaSource}) to get all audio

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_STREAM_ID') {
    const tabId = sender.tab?.id || msg.tabId
    if (!tabId) { sendResponse({ error: 'No tab ID' }); return true }

    chrome.tabCapture.getMediaStreamId({ targetTabId: tabId }, (streamId) => {
      if (chrome.runtime.lastError) {
        sendResponse({ error: chrome.runtime.lastError.message })
      } else {
        sendResponse({ streamId })
      }
    })
    return true // keep channel open for async response
  }
})
