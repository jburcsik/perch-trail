'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import toast from 'react-hot-toast'

// Exported so the E2E spec asserts the real string.
export const VALIDATION_MESSAGE = "A script needs both a label and a body. If you want this one gone, use Delete instead."
// Postgres check_violation.
const CHECK_VIOLATION = '23514'

type ReplyScript = { id: string; label: string; body: string; sort_order: number }

type ReplyScriptsPanelProps = {
  scripts: ReplyScript[]
  onChange: () => void
}

function nextSortOrder(scripts: ReplyScript[]): number {
  return scripts.length === 0 ? 0 : Math.max(...scripts.map(s => s.sort_order)) + 1
}

export function ReplyScriptsPanel({ scripts, onChange }: ReplyScriptsPanelProps) {
  const [newLabel, setNewLabel] = useState('')
  const [newBody, setNewBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [editBody, setEditBody] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ReplyScript | null>(null)

  const reportError = (error: { code?: string; message: string }, fallback: string) => {
    toast.error(error.code === CHECK_VIOLATION ? VALIDATION_MESSAGE : fallback)
  }

  const create = async () => {
    const label = newLabel.trim()
    const body = newBody.trim()
    if (!label || !body) {
      toast.error(VALIDATION_MESSAGE)
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase.from('reply_scripts').insert({ label, body, sort_order: nextSortOrder(scripts) })
      if (error) { reportError(error, 'Failed to save the script'); return }
      toast.success('Script added!')
      setNewLabel('')
      setNewBody('')
      onChange()
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (script: ReplyScript) => {
    setEditingId(script.id)
    setEditLabel(script.label)
    setEditBody(script.body)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditLabel('')
    setEditBody('')
  }

  const saveEdit = async (id: string) => {
    const label = editLabel.trim()
    const body = editBody.trim()
    if (!label || !body) {
      toast.error(VALIDATION_MESSAGE)
      return
    }
    setEditSaving(true)
    try {
      const { error } = await supabase
        .from('reply_scripts')
        .update({ label, body, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) { reportError(error, 'Failed to update the script'); return }
      toast.success('Script updated!')
      cancelEdit()
      onChange()
    } finally {
      setEditSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    const { error } = await supabase.from('reply_scripts').delete().eq('id', deleteTarget.id)
    if (error) { reportError(error, 'Failed to delete the script'); return }
    toast.success('Script deleted.')
    onChange()
  }

  return (
    <Card data-testid="reply-scripts-panel">
      <CardHeader>
        <CardTitle>Email scripts ({scripts.length})</CardTitle>
        <p className="text-sm text-gray-500">Reusable canned replies available from the inquiry pane&apos;s reply dropdown.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3" data-testid="reply-scripts-list">
          {scripts.map(script => (
            <div
              key={script.id}
              data-testid={`reply-script-${script.id}`}
              className="rounded-lg border border-gray-200 p-3"
            >
              {editingId === script.id ? (
                <div className="space-y-2">
                  <Input
                    value={editLabel}
                    onChange={e => setEditLabel(e.target.value)}
                    placeholder="Label"
                  />
                  <Textarea
                    rows={4}
                    value={editBody}
                    onChange={e => setEditBody(e.target.value)}
                    placeholder="Body"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={editSaving}
                      onClick={() => saveEdit(script.id)}
                      className="bg-amber-600 hover:bg-amber-700 text-white"
                    >
                      {editSaving ? '...' : 'Save'}
                    </Button>
                    <Button size="sm" variant="outline" onClick={cancelEdit}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{script.label}</p>
                    <p className="mt-1 text-sm text-gray-500 line-clamp-2 whitespace-pre-wrap">{script.body}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      data-testid={`reply-script-edit-${script.id}`}
                      onClick={() => startEdit(script)}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      data-testid={`reply-script-delete-${script.id}`}
                      onClick={() => setDeleteTarget(script)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {scripts.length === 0 && (
            <p className="text-sm text-gray-400">No scripts yet. Add the first one below.</p>
          )}
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Add new script</p>
          <Input
            data-testid="reply-script-new-label"
            placeholder="Label"
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            className="bg-white"
          />
          <Textarea
            data-testid="reply-script-new-body"
            rows={5}
            placeholder="Body"
            value={newBody}
            onChange={e => setNewBody(e.target.value)}
            className="bg-white"
          />
          <Button
            size="sm"
            data-testid="reply-script-new-save"
            disabled={saving}
            onClick={create}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {saving ? '...' : 'Save'}
          </Button>
        </div>
      </CardContent>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}
        title={`Delete "${deleteTarget?.label ?? ''}"?`}
        description="This removes the script from the reply dropdown. This cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => { await confirmDelete(); setDeleteTarget(null) }}
      />
    </Card>
  )
}
