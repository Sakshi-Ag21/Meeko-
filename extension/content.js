// Injected into meet.google.com
// Captures full tab audio via tabCapture and streams to Deepgram for real-time transcription.
// Speaker names from Deepgram diarization, mapped to Meet DOM names where possible.

let isRecording = false
let transcript = []
let currentSpeaker = 'Unknown'
let speakerObserver = null
let mediaStream = null
let deepgramSocket = null
let audioContext = null
let scriptProcessor = null

// ── Speaker detection (used to map diarization indices → real names) ──────────
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
async function captureAllAudio() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'GET_STREAM_ID' }, async (resp) => {
      if (resp?.error || !resp?.streamId) {
        console.warn('[MeetIQ] Tab capture failed, falling back to mic:', resp?.error)
        try {
          resolve(await navigator.mediaDevices.getUserMedia({ audio: true, video: false }))
        } catch { resolve(null) }
        return
      }
      try {
        resolve(await navigator.mediaDevices.getUserMedia({
          audio: { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: resp.streamId } },
          video: false,
        }))
      } catch (err) {
        console.warn('[MeetIQ] Tab stream failed, falling back to mic:', err)
        try {
          resolve(await navigator.mediaDevices.getUserMedia({ audio: true, video: false }))
        } catch { resolve(null) }
      }
    })
  })
}

// ── Deepgram streaming ────────────────────────────────────────────────────────
// Maps diarization speaker index → real name (resolved from DOM at first sight)
const speakerMap = {}

function startDeepgram(stream, apiKey) {
  audioContext = new AudioContext()
  const source = audioContext.createMediaStreamSource(stream)

  const params = new URLSearchParams({
    model: 'nova-3',
    language: 'en-US',
    diarize: 'true',
    interim_results: 'false',
    smart_format: 'true',
    no_delay: 'true',
    endpointing: '300',
    encoding: 'linear16',
    sample_rate: String(audioContext.sampleRate),
  })

  deepgramSocket = new WebSocket(
    `wss://api.deepgram.com/v1/listen?${params}`,
    ['token', apiKey]
  )

  deepgramSocket.onopen = () => {
    console.log('[MeetIQ] Deepgram connected, sample rate:', audioContext.sampleRate)

    // ScriptProcessor sends raw PCM to Deepgram every ~85ms (4096 samples @ 48kHz)
    scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1)
    source.connect(scriptProcessor)
    scriptProcessor.connect(audioContext.destination)

    scriptProcessor.onaudioprocess = (e) => {
      if (!isRecording || deepgramSocket?.readyState !== WebSocket.OPEN) return
      const float32 = e.inputBuffer.getChannelData(0)
      const int16 = new Int16Array(float32.length)
      for (let i = 0; i < float32.length; i++) {
        const s = Math.max(-1, Math.min(1, float32[i]))
        int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
      }
      deepgramSocket.send(int16.buffer)
    }
  }

  deepgramSocket.onmessage = (event) => {
    let data
    try { data = JSON.parse(event.data) } catch { return }
    if (data.type !== 'Results') return

    const alt = data.channel?.alternatives?.[0]
    if (!alt?.transcript?.trim()) return

    // Resolve speaker: prefer diarization index mapped to DOM name
    const speakerIdx = alt.words?.[0]?.speaker
    let speaker
    if (speakerIdx !== undefined) {
      if (!speakerMap[speakerIdx]) {
        speakerMap[speakerIdx] = currentSpeaker || `Speaker ${speakerIdx + 1}`
      }
      speaker = speakerMap[speakerIdx]
    } else {
      speaker = currentSpeaker
    }

    const entry = { speaker, text: alt.transcript.trim(), time: new Date().toISOString() }
    transcript.push(entry)
    chrome.storage.local.set({ meetiq_transcript: transcript })
    try { chrome.runtime.sendMessage({ type: 'TRANSCRIPT_UPDATE', entry }) } catch {}
  }

  deepgramSocket.onerror = (err) => {
    console.error('[MeetIQ] Deepgram error:', err)
    try { chrome.runtime.sendMessage({ type: 'ERROR', message: 'Deepgram connection error. Check your API key in the extension.' }) } catch {}
  }

  deepgramSocket.onclose = (event) => {
    console.warn('[MeetIQ] Deepgram closed:', event.code, event.reason)
    scriptProcessor?.disconnect()
    source.disconnect()
    // Reconnect if still recording and it wasn't a clean close
    if (isRecording && event.code !== 1000) {
      console.log('[MeetIQ] Reconnecting Deepgram...')
      setTimeout(() => startDeepgram(stream, apiKey), 1500)
    }
  }
}

function stopDeepgram() {
  isRecording = false
  if (deepgramSocket) {
    deepgramSocket.close(1000, 'recording stopped')
    deepgramSocket = null
  }
  if (scriptProcessor) {
    scriptProcessor.disconnect()
    scriptProcessor = null
  }
  if (audioContext) {
    audioContext.close()
    audioContext = null
  }
}

// ── Message handler ───────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {

  if (msg.type === 'START_RECORDING') {
    if (isRecording) { sendResponse({ ok: true }); return true }

    if (!msg.deepgramKey) {
      sendResponse({ ok: false, error: 'No Deepgram API key. Add it in the extension popup.' })
      return true
    }

    transcript = []
    Object.keys(speakerMap).forEach(k => delete speakerMap[k])
    currentSpeaker = msg.userName || getCurrentSpeaker() || 'Unknown'
    isRecording = true
    observeSpeaker()
    chrome.storage.local.set({ meetiq_recording: true, meetiq_transcript: [] })

    captureAllAudio().then((stream) => {
      if (!stream) {
        isRecording = false
        sendResponse({ ok: false, error: 'Could not access audio.' })
        return
      }
      mediaStream = stream
      startDeepgram(stream, msg.deepgramKey)
      sendResponse({ ok: true })
    })
    return true
  }

  if (msg.type === 'STOP_RECORDING') {
    stopDeepgram()
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
