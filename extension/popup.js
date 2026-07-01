const $ = id => document.getElementById(id)

let meetTab = null
let finalTranscript = []

const DEFAULT_URL = 'https://meeko-henna.vercel.app'
const DEFAULT_API = 'https://meeko-henna.vercel.app/api'

async function getMeetTab() {
  const tabs = await chrome.tabs.query({ url: 'https://meet.google.com/*' })
  return tabs[0] || null
}

// Read token + teamId from localStorage on the MeetIQ tab
async function getMeetIQAuth(meetiqUrl) {
  const pattern = meetiqUrl.startsWith('http://localhost')
    ? 'http://localhost/*'
    : meetiqUrl.replace(/^https?:\/\//, 'https://') + '/*'
  const tabs = await chrome.tabs.query({ url: pattern })
  if (!tabs.length) return null

  const results = await chrome.scripting.executeScript({
    target: { tabId: tabs[0].id },
    func: () => ({
      token: localStorage.getItem('token'),
      teamId: localStorage.getItem('teamId'),
    }),
  })
  return results?.[0]?.result || null
}

function setRecordingUI(recording) {
  $('dot').className = 'dot' + (recording ? ' recording' : '')
  $('status-text').textContent = recording ? 'Recording…' : 'Ready to record'
  $('btn-record').style.display = recording ? 'none' : 'block'
  $('btn-stop').style.display = recording ? 'block' : 'none'
  $('lines').style.display = recording ? 'block' : 'none'
}

function setStatus(msg) {
  $('status-text').textContent = msg
}

function showError(msg) {
  $('error').textContent = msg
  $('error').style.display = msg ? 'block' : 'none'
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return 'unknown size'
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unit = units.shift()
  while (value >= 1024 && units.length) {
    value /= 1024
    unit = units.shift()
  }
  return `${value.toFixed(value >= 10 ? 1 : 2)} ${unit}`
}

function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return 'unknown duration'
  const totalSeconds = Math.round(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return minutes ? `${minutes}m ${seconds}s` : `${seconds}s`
}

function describeRecording(recording) {
  if (!recording) return 'No local audio file was created.'
  if (recording.error) return `Local audio issue: ${recording.error}`
  return `Local audio saved: ${recording.fileName} • ${formatBytes(recording.sizeBytes)} • ${formatDuration(recording.durationMs)}`
}

function savePrefs() {
  chrome.storage.local.set({
    meetiq_url: $('meetiq-url').value.trim(),
    meetiq_user: $('user-name').value.trim(),
  })
}

async function fetchDeepgramKey(apiUrl, token) {
  const res = await fetch(`${apiUrl}/deepgram-key`, {
    headers: { 'Authorization': `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Could not fetch Deepgram key from server.')
  const data = await res.json()
  return data.key
}

async function init() {
  const prefs = await chrome.storage.local.get(['meetiq_url', 'meetiq_user', 'meetiq_recording', 'meetiq_transcript'])
  $('meetiq-url').value = prefs.meetiq_url || DEFAULT_URL
  $('user-name').value = prefs.meetiq_user || ''

  $('meetiq-url').addEventListener('change', savePrefs)
  $('user-name').addEventListener('change', savePrefs)

  meetTab = await getMeetTab()

  if (!meetTab) {
    $('not-meet').style.display = 'block'
    $('main').style.display = 'none'
    return
  }

  $('not-meet').style.display = 'none'
  $('main').style.display = 'block'

  if (prefs.meetiq_recording) {
    setRecordingUI(true)
    finalTranscript = prefs.meetiq_transcript || []
    $('lines').textContent = `${finalTranscript.length} lines captured`
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'TRANSCRIPT_UPDATE') {
      finalTranscript.push(msg.entry)
      $('lines').textContent = `${finalTranscript.length} lines captured`
    }
    if (msg.type === 'ERROR') showError(msg.message)
  })

  $('btn-record').addEventListener('click', async () => {
    showError('')
    savePrefs()
    try {
      const meetiqUrl = ($('meetiq-url').value.trim() || DEFAULT_URL).replace(/\/$/, '')
      const apiUrl = meetiqUrl.includes('localhost') ? DEFAULT_API : `${meetiqUrl}/api`
      const auth = await getMeetIQAuth(meetiqUrl)
      if (!auth?.token) {
        showError('Not logged in to MeetIQ. Open MeetIQ and log in first.')
        return
      }

      let deepgramKey
      try {
        deepgramKey = await fetchDeepgramKey(apiUrl, auth.token)
      } catch {
        showError('Could not get transcription key from server. Check your MeetIQ connection.')
        return
      }

      const resp = await chrome.tabs.sendMessage(meetTab.id, {
        type: 'START_RECORDING',
        userName: $('user-name').value.trim(),
        deepgramKey,
      })
      if (resp?.ok) {
        finalTranscript = []
        setRecordingUI(true)
      } else if (resp?.error) {
        showError(resp.error)
      }
    } catch {
      showError('Could not connect to Google Meet tab. Reload the Meet page and try again.')
    }
  })

  $('btn-stop').addEventListener('click', async () => {
    try {
      const resp = await chrome.tabs.sendMessage(meetTab.id, { type: 'STOP_RECORDING' })
      if (!resp?.ok) return

      // Prefer content-script transcript; fall back to storage if it was reset mid-session
      const fromContent = resp.transcript || []
      if (fromContent.length > 0) {
        finalTranscript = fromContent
      } else if (!finalTranscript.length) {
        const saved = await chrome.storage.local.get('meetiq_transcript')
        finalTranscript = saved.meetiq_transcript || []
      }

      setRecordingUI(false)
      $('lines').style.display = 'block'
      $('lines').textContent = `${finalTranscript.length} lines captured\n${describeRecording(resp.recording)}`

      if (!finalTranscript.length) {
        showError('No speech captured. Make sure your microphone is working.')
        return
      }

      const meetiqUrl = ($('meetiq-url').value.trim() || DEFAULT_URL).replace(/\/$/, '')
      const apiUrl = meetiqUrl.includes('localhost') ? DEFAULT_API : `${meetiqUrl}/api`

      $('lines').textContent = `${finalTranscript.length} lines captured — analyzing…`
      setStatus('Analyzing…')

      // Get auth from the open MeetIQ tab
      const auth = await getMeetIQAuth(meetiqUrl)
      if (!auth?.token || !auth?.teamId) {
        showError('Not logged in to MeetIQ. Open MeetIQ and log in first, then try again.')
        setStatus('Ready to record')
        return
      }

      const text = finalTranscript.map(e => `${e.speaker}: ${e.text}`).join('\n')
      const date = new Date().toISOString().slice(0, 10)
      const title = `Google Meet — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`

      // Call the API directly — saves to Supabase under the user's team
      const res = await fetch(`${apiUrl}/analyze-transcript`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${auth.token}`,
          'X-Team-Id': auth.teamId,
        },
        body: JSON.stringify({ transcript: text, title, date }),
      })

      const data = await res.json()
      if (!res.ok || data.error) {
        showError(data.error || 'Analysis failed. Try again.')
        setStatus('Ready to record')
        return
      }

      // Open the meeting detail page directly
      setStatus('Done!')
      $('lines').textContent = `Saved! Opening meeting…`
      chrome.tabs.create({ url: `${meetiqUrl}/meetings/${data.id}` })

    } catch (err) {
      showError('Error: ' + err.message)
      setStatus('Ready to record')
    }
  })
}

init()
