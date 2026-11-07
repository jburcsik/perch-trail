'use client'

import { TAG_MAP, TAG_COLOR_CLASSES } from '@/config/tags'

interface TagBadgeProps {
  tagId: string
  size?: 'sm' | 'md'
}

export function TagBadge({ tagId, size = 'sm' }: TagBadgeProps) {
  const tag = TAG_MAP[tagId]
  if (!tag) return null

  const colors = TAG_COLOR_CLASSES[tag.color] ?? TAG_COLOR_CLASSES.blue

  const sizeClasses = size === 'sm'
    ? 'text-xs px-2 py-0.5'
    : 'text-sm px-3 py-1'

  return (
    <span className={`inline-block rounded-full border font-medium ${colors.bg} ${colors.text} ${colors.border} ${sizeClasses}`}>
      {tag.label}
    </span>
  )
}
