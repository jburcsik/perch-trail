// Single source of truth for the birdhouse lifecycle (see migration 021).
//
//   invited:   welcome link sent, steward hasn't filled it in
//   review:    first version saved, awaiting admin's first-publish approval
//   live:      published / public
//   suspended: admin moderation (rare)
//
// Soft delete (archived_at) is orthogonal: it can apply from any status and is
// shown in its own "Deleted" bucket regardless of status.

export type HouseStatus = 'invited' | 'review' | 'live' | 'suspended'

export const HOUSE_STATUS_LABEL: Record<HouseStatus, string> = {
  invited: 'Invited',
  review: 'Ready for Review',
  live: 'Live',
  suspended: 'Suspended',
}

export function houseStatusLabel(status: string): string {
  return HOUSE_STATUS_LABEL[status as HouseStatus] ?? status
}

export function houseStatusBadgeClass(status: string): string {
  switch (status) {
    case 'invited': return 'bg-slate-100 text-slate-700'
    case 'review': return 'bg-amber-100 text-amber-800'
    case 'live': return 'bg-green-100 text-green-800'
    case 'suspended': return 'bg-red-100 text-red-800'
    default: return 'bg-gray-100 text-gray-600'
  }
}

/** A house is publicly visible only when it is live and not soft-deleted. */
export function isPublicHouse(h: { status?: string | null; archived_at?: string | null }): boolean {
  return h.status === 'live' && !h.archived_at
}
