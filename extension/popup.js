const $ = id => document.getElementById(id)

let meetTab = null
let finalTranscript = []

const DEFAULT_URL = 'http://localhost:5173'
const DEFAULT_API = 'http://localhost:5001'

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

function savePrefs() {
  chrome.storage.local.set({
    meetiq_url: $('meetiq-url').value.trim(),
    meetiq_user: $('user-name').value.trim(),
  })
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
      const resp = await chrome.tabs.sendMessage(meetTab.id, {
        type: 'START_RECORDING',
        userName: $('user-name').value.trim(),
      })
      if (resp?.ok) {
        finalTranscript = []
        setRecordingUI(true)
      }
    } catch {
      showError('Could not connect to Google Meet tab. Reload the Meet page and try again.')
    }
  })

  $('btn-stop').addEventListener('click', async () => {
    try {
      const resp = await chrome.tabs.sendMessage(meetTab.id, { type: 'STOP_RECORDING' })
      if (!resp?.ok) return

      finalTranscript = resp.transcript || []
      setRecordingUI(false)
      $('lines').style.display = 'block'

      if (!finalTranscript.length) {
        showError('No speech captured. Make sure your microphone is working.')
        return
      }

      const meetiqUrl = ($('meetiq-url').value.trim() || DEFAULT_URL).replace(/\/$/, '')
      const isLocal = meetiqUrl.includes('localhost')
      const apiUrl = isLocal ? DEFAULT_API : `${meetiqUrl}/api`

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
