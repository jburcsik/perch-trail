'use client'

import { useState } from 'react'
import { TAGS, TAG_COLOR_CLASSES } from '@/config/tags'
import { TagBadge } from '@/components/TagBadge'
import { Button } from '@/components/ui/button'

interface TagEditorProps {
  tags: string[]
  onSave: (tags: string[]) => void
  showAdminTags?: boolean
  max?: number
}

export function TagEditor({ tags, onSave, showAdminTags = false, max = 5 }: TagEditorProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<string[]>(tags)

  const availableTags = showAdminTags ? TAGS : TAGS.filter(t => !t.adminOnly)

  const toggle = (tagId: string) => {
    if (draft.includes(tagId)) {
      setDraft(draft.filter(id => id !== tagId))
    } else if (draft.length < max) {
      setDraft([...draft, tagId])
    }
  }

  const handleEdit = () => {
    setDraft(tags)
    setEditing(true)
  }

  const handleSave = () => {
    onSave(draft)
    setEditing(false)
  }

  const handleCancel = () => {
    setDraft(tags)
    setEditing(false)
  }

  if (!editing) {
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5 min-h-[32px] items-center">
          {tags.length > 0 ? (
            tags.map(tagId => <TagBadge key={tagId} tagId={tagId} size="md" />)
          ) : (
            <span className="text-sm text-gray-400">No tags</span>
          )}
        </div>
        <Button type="button" size="sm" variant="outline" onClick={handleEdit}>
          Edit Tags
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3 border border-amber-200 bg-amber-50/50 rounded-lg p-3">
      <div className="flex flex-wrap gap-2">
        {availableTags.map(tag => {
          const isSelected = draft.includes(tag.id)
          const colors = TAG_COLOR_CLASSES[tag.color] ?? TAG_COLOR_CLASSES.blue

          return (
            <button
              key={tag.id}
              type="button"
              onClick={() => toggle(tag.id)}
              className={`rounded-full border text-sm font-medium px-3 py-1 transition-all ${
                isSelected
                  ? `${colors.bg} ${colors.text} ${colors.border} ring-2 ring-offset-1`
                  : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {tag.label}
            </button>
          )
        })}
      </div>
      <p className="text-xs text-gray-400">{draft.length}/{max} tags selected</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          className="text-sm font-medium px-4 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-colors"
        >
          Save Tags
        </button>
        <button
          type="button"
          onClick={handleCancel}
          className="text-sm font-medium px-4 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
