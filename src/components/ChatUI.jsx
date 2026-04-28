import { motion } from 'framer-motion'
import { useEffect, useRef } from 'react'
import { cn } from '../utils/cn'

export function ChatUI({ messages, input, onInputChange, onSend, disabled }) {
  const bottomRef = useRef(null)
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!input.trim() || disabled) return
    onSend()
  }

  return (
    <div className="flex h-[calc(100vh-220px)] min-h-[420px] flex-col overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-card dark:border-slate-700/80 dark:bg-slate-900/60 dark:shadow-none">
      <div className="flex-1 space-y-4 overflow-y-auto p-5 md:p-6">
        {messages.length === 0 && (
          <div className="flex h-full min-h-[200px] flex-col items-center justify-center px-4 text-center">
            <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">
              No conversation yet. After you upload and analyze transcripts, you can ask questions about your meetings
              here.
            </p>
          </div>
        )}
        {messages.map((m, i) => (
          <motion.div
            key={m.id}
            initial={i === messages.length - 1 ? { opacity: 0, y: 10, scale: 0.98 } : false}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}
          >
            <div
              className={cn(
                'max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm transition-all duration-150',
                m.role === 'user'
                  ? 'rounded-br-md bg-primary text-white'
                  : 'rounded-bl-md border border-slate-100 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100'
              )}
            >
              {m.content}
            </div>
          </motion.div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form
        onSubmit={handleSubmit}
        className="border-t border-slate-100 p-4 dark:border-slate-800 md:p-5"
      >
        <div className="flex gap-3">
          <input
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder="Ask about meetings, decisions, or action items..."
            disabled={disabled}
            className="flex-1 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-primary/30 focus:bg-white focus:ring-2 focus:ring-primary/20 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:bg-slate-900"
            aria-label="Message"
          />
          <motion.button
            type="submit"
            whileTap={{ scale: 0.97 }}
            disabled={disabled || !input.trim()}
            className="rounded-xl bg-primary px-5 py-3 text-sm font-medium text-white shadow-sm transition-all duration-150 hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Send
          </motion.button>
        </div>
      </form>
    </div>
  )
}
