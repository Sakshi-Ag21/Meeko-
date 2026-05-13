import { Navbar } from '../components/Navbar'

const steps = [
  { n: '1', title: 'Download the extension', desc: 'Click the button below to download the MeetIQ Recorder zip file.' },
  { n: '2', title: 'Unzip the file', desc: 'Extract the downloaded zip — you\'ll get a folder called "meetiq-recorder".' },
  { n: '3', title: 'Open Manage Extensions', desc: 'Click the puzzle icon 🧩 in Chrome\'s toolbar → select "Manage Extensions". Or go to chrome://extensions in the address bar.' },
  { n: '4', title: 'Enable Developer Mode', desc: 'Toggle on "Developer mode" in the top-right corner.' },
  { n: '5', title: 'Load the extension', desc: 'Click "Load unpacked" and select the "meetiq-recorder" folder you extracted.' },
  { n: '6', title: 'Pin it to your toolbar', desc: 'Click the puzzle icon 🧩 again → click the pin icon next to MeetIQ Recorder so it always stays visible.' },
]

export function Download() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/20 dark:from-slate-950 dark:via-slate-950 dark:to-slate-950">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-12">

        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800 text-xs font-semibold text-indigo-600 dark:text-indigo-400 mb-4">
            🎙 Chrome Extension
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            MeetIQ Recorder
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
            Record Google Meet meetings with speaker-wise transcription. When your meeting ends, the transcript is sent directly to MeetIQ for analysis.
          </p>
        </div>

        {/* Download button */}
        <div className="rounded-2xl border border-indigo-200 dark:border-indigo-800/60 bg-white dark:bg-slate-900 shadow-sm p-6 mb-8 text-center">
          <a
            href="/meetiq-recorder.zip"
            download
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-all shadow-sm hover:shadow-md"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download MeetIQ Recorder
          </a>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-3">Chrome & Edge · Free · No account needed for the extension</p>
        </div>

        {/* Install steps */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Installation Steps</h2>
          </div>
          <div className="px-6 py-5 space-y-5">
            {steps.map(({ n, title, desc }) => (
              <div key={n} className="flex gap-4">
                <span className="shrink-0 w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-xs font-bold text-indigo-600 dark:text-indigo-400">
                  {n}
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-0.5">{title}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* How to use */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden mt-6">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">How to Use</h2>
          </div>
          <div className="px-6 py-5 space-y-3">
            {[
              'Make sure you are logged in to MeetIQ in another tab.',
              'Join your Google Meet as usual.',
              'Click the MeetIQ Recorder icon in your Chrome toolbar.',
              'Enter your name (as it appears in Meet) and click Start Recording.',
              'When the meeting ends, click Stop & Analyze — the transcript is automatically analyzed and saved to your team. You will be taken directly to the meeting summary.',
            ].map((step, i) => (
              <div key={i} className="flex gap-3 text-sm text-slate-600 dark:text-slate-400">
                <span className="shrink-0 mt-1 w-1.5 h-1.5 rounded-full bg-indigo-400" />
                {step}
              </div>
            ))}
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 dark:text-slate-500 mt-8">
          Chrome shows a &quot;Developer mode extension&quot; notice on restart — click Keep. This is normal for extensions installed outside the Chrome Web Store.
        </p>

      </main>
    </div>
  )
}
