import { useCallback, useState } from 'react'

export function useDisclosure(initialOpen = false) {
  const [open, setOpen] = useState(initialOpen)
  const onOpen = useCallback(() => setOpen(true), [])
  const onClose = useCallback(() => setOpen(false), [])
  const onToggle = useCallback(() => setOpen((v) => !v), [])
  return { open, onOpen, onClose, onToggle, setOpen }
}
