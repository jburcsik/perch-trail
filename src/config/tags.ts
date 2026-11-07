export interface TagDefinition {
  id: string
  label: string
  color: string
  adminOnly: boolean
}

export const TAGS: TagDefinition[] = [
  { id: 'featured-artist', label: 'Featured Artist', color: 'amber',  adminOnly: true  },
  { id: 'family',          label: 'Family',          color: 'green',  adminOnly: false },
  { id: 'youth',           label: 'Youth Artist',    color: 'blue',   adminOnly: false },
  { id: 'senior',          label: 'Senior Artist',   color: 'purple', adminOnly: false },
  { id: 'mural',           label: 'Mural Style',     color: 'red',    adminOnly: false },
]

export const TAG_MAP = Object.fromEntries(TAGS.map(t => [t.id, t])) as Record<string, TagDefinition>

export const TAG_COLOR_CLASSES: Record<string, { bg: string; text: string; border: string }> = {
  amber:  { bg: 'bg-amber-100',  text: 'text-amber-800',  border: 'border-amber-300' },
  green:  { bg: 'bg-green-100',  text: 'text-green-800',  border: 'border-green-300' },
  blue:   { bg: 'bg-blue-100',   text: 'text-blue-800',   border: 'border-blue-300' },
  purple: { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-300' },
  red:    { bg: 'bg-red-100',    text: 'text-red-800',    border: 'border-red-300' },
}
