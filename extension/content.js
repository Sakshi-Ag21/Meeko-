// Injected into meet.google.com
// Captures full tab audio (all participants) via tabCapture + Web Speech API
// Speaker names read from Meet's DOM active-speaker indicator

let recognition = null
let isRecording = false
let transcript = []
let currentSpeaker = 'Unknown'
let speakerObserver = null
let mediaStream = null

// ── Speaker detection ─────────────────────────────────────────────────────────
const SPEAKER_SELECTORS = [
  '[data-is-dominant-speaker="true"] [data-self-name]',
  '[data-is-dominant-speaker="true"] .zWGUib',
  '[data-is-dominant-speaker="true"] .KF4T6b',
  '[jsname="EydYod"]',
  '.YTbUzc',
  '.zWGUib',
  '.KF4T6b',
]

function getCurrentSpeaker() {
  for (const sel of SPEAKER_SELECTORS) {
    const el = document.querySelector(sel)
    const name = el?.textContent?.trim()
    if (name && name.length > 1 && name.length < 60) return name
  }
  return currentSpeaker
}

function observeSpeaker() {
  speakerObserver = new MutationObserver(() => {
    const name = getCurrentSpeaker()
    if (name) currentSpeaker = name
  })
  speakerObserver.observe(document.body, {
    childList: true, subtree: true, attributes: true,
    attributeFilter: ['data-is-dominant-speaker', 'class', 'aria-label'],
  })
}

// ── Audio capture ─────────────────────────────────────────────────────────────
// Ask background for a tabCapture stream ID, then reconstruct via getUserMedia.
// This gives us all participants' audio, not just the local mic.
async function captureAllAudio() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'GET_STREAM_ID' }, async (resp) => {
      if (resp?.error || !resp?.streamId) {
        // Fallback to mic-only if tab capture fails
        console.warn('[MeetIQ] Tab capture failed, falling back to mic:', resp?.error)
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
          resolve(micStream)
        } catch {
          resolve(null)
        }
        return
      }

      try {
        // Reconstruct the tab audio stream from the stream ID
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            mandatory: {
              chromeMediaSource: 'tab',
              chromeMediaSourceId: resp.streamId,
            },
          },
          video: false,
        })
        resolve(stream)
      } catch (err) {
        console.warn('[MeetIQ] Failed to use tab stream, falling back to mic:', err)
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
          resolve(micStream)
        } catch {
          resolve(null)
        }
      }
    })
  })
}

// ── Speech recognition ────────────────────────────────────────────────────────
function startRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!SpeechRecognition) {
    chrome.runtime.sendMessage({ type: 'ERROR', message: 'Speech recognition not supported. Use Chrome.' })
    return
  }

  recognition = new SpeechRecognition()
  recognition.continuous = true
  recognition.interimResults = false
  recognition.lang = 'en-US'
  recognition.maxAlternatives = 1

  recognition.onresult = (event) => {
    for (let i = event.resultIndex; i < event.results.length; i++) {
      if (!event.results[i].isFinal) continue
      const text = event.results[i][0].transcript.trim()
      if (!text) continue
      const speaker = getCurrentSpeaker() || currentSpeaker
      const entry = { speaker, text, time: new Date().toISOString() }
      transcript.push(entry)
      chrome.storage.local.set({ meetiq_transcript: transcript })
      try { chrome.runtime.sendMessage({ type: 'TRANSCRIPT_UPDATE', entry }) } catch {}
    }
  }

  recognition.onerror = (e) => {
    if (e.error === 'no-speech' || e.error === 'aborted') return
    try { chrome.runtime.sendMessage({ type: 'ERROR', message: `Speech error: ${e.error}` }) } catch {}
  }

  recognition.onend = () => {
    if (isRecording) {
      try { recognition.start() } catch {}
    }
  }

  recognition.start()
}

// ── Message handler ───────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {

  if (msg.type === 'START_RECORDING') {
    if (isRecording) { sendResponse({ ok: true }); return true }
    transcript = []
    currentSpeaker = msg.userName || getCurrentSpeaker() || 'Unknown'
    isRecording = true
    observeSpeaker()
    chrome.storage.local.set({ meetiq_recording: true, meetiq_transcript: [] })

    captureAllAudio().then((stream) => {
      mediaStream = stream
      startRecognition()
      sendResponse({ ok: true })
    })
    return true
  }

  if (msg.type === 'STOP_RECORDING') {
    isRecording = false
    try { recognition?.stop() } catch {}
    recognition = null
    speakerObserver?.disconnect()
    speakerObserver = null
    mediaStream?.getTracks().forEach(t => t.stop())
    mediaStream = null
    chrome.storage.local.set({ meetiq_recording: false })
    sendResponse({ ok: true, transcript })
    return true
  }

  if (msg.type === 'GET_STATUS') {
    sendResponse({ isRecording, lineCount: transcript.length })
    return true
  }

  return true
})
