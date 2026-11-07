'use client'

import { useEffect, useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'

type ConfirmDialogProps = {
  open: boolean
  onOpenChange: (next: boolean) => void
  title: string
  description: string
  confirmLabel: string
  cancelLabel?: string
  destructive?: boolean
  /**
   * If set, the user must type this exact string to enable the confirm button.
   * Use for irreversible actions (typed-confirmation gate, GitHub-style).
   */
  requireTypedConfirmation?: string
  /**
   * If true, surface a textarea for an optional reason. The reason is passed
   * back via onConfirm.
   */
  withReason?: boolean
  reasonPlaceholder?: string
  onConfirm: (reason?: string) => void | Promise<void>
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  destructive,
  requireTypedConfirmation,
  withReason,
  reasonPlaceholder,
  onConfirm,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) {
      setTyped('')
      setReason('')
      setBusy(false)
    } else if (requireTypedConfirmation) {
      // Focus the typed-confirmation input when opening
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open, requireTypedConfirmation])

  const typedOk = !requireTypedConfirmation || typed.trim() === requireTypedConfirmation

  const handleConfirm = async () => {
    if (!typedOk || busy) return
    setBusy(true)
    try {
      await onConfirm(withReason ? reason.trim() : undefined)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        {/* z-[9998+]: Leaflet map panes/controls occupy z-index 400 to 1000, so a
            z-50 dialog hides BEHIND any visible map (admin markers page,
            LocationPicker pages). Matches the map page's sheet tier (9999). */}
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-[9998] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        {/* physical: intentional, a center-transform trick (left-1/2 + -translate-x-1/2), not a directional offset */}
        <Dialog.Content
          className={`fixed left-1/2 top-1/2 z-[9999] -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-md rounded-lg border bg-white p-6 shadow-lg focus:outline-none ${
            destructive ? 'border-red-200' : 'border-gray-200'
          }`}
        >
          <Dialog.Title className={`text-lg font-semibold ${destructive ? 'text-red-700' : 'text-gray-900'}`}>
            {title}
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-gray-700 whitespace-pre-line">
            {description}
          </Dialog.Description>

          {requireTypedConfirmation && (
            <div className="mt-4 space-y-1">
              <label className="text-xs text-gray-600">
                Type <span className="font-mono font-semibold">{requireTypedConfirmation}</span> to confirm:
              </label>
              <Input
                ref={inputRef}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                className={destructive ? 'border-red-200 focus-visible:ring-red-400' : ''}
              />
            </div>
          )}

          {withReason && (
            <div className="mt-4 space-y-1">
              <label className="text-xs text-gray-600">Reason (optional):</label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder={reasonPlaceholder}
              />
            </div>
          )}

          <div className="mt-6 flex justify-end gap-2">
            <Dialog.Close asChild>
              <Button variant="outline" size="sm" disabled={busy}>
                {cancelLabel}
              </Button>
            </Dialog.Close>
            <Button
              size="sm"
              variant={destructive ? 'destructive' : 'default'}
              onClick={handleConfirm}
              disabled={!typedOk || busy}
            >
              {busy ? 'Working...' : confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
