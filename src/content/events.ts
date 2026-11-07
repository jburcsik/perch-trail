// The one list of events. The events page derives upcoming and past from the
// clock and the banner shows the entry flagged `banner: true` until it retires.
// Imports nothing, so Jest can load it directly.

export interface PerchEvent {
  /**
   * i18n key prefix in the EventsPage namespace: `<id>Badge`, `<id>Title`,
   * `<id>When`, `<id>Where`, `<id>Description`. All five must exist in every
   * locale; `npm run check` enforces parity.
   */
  id: string
  /**
   * The instant this stops being "upcoming": it moves to "The story so far"
   * and any banner hides. Convention is local midnight after the event, so it
   * stays up for the rest of the day it happened. ISO 8601 with an explicit
   * offset, never a bare date, which would be parsed as UTC and retire the
   * event hours early.
   */
  retiresAt: string
  /** Directions link, shown only while upcoming. */
  directions?: string
  /** Show the site-wide banner for this event while it is upcoming. */
  banner?: boolean
}

// Oldest first; `pastEvents` preserves this order.
export const EVENTS: PerchEvent[] = [
  { id: 'kickoff', retiresAt: '2026-05-17T00:00:00Z' },
  { id: 'ws', retiresAt: '2026-06-14T00:00:00Z' },
  {
    id: 'ss',
    retiresAt: '2027-12-13T00:00:00Z',
    directions: 'https://perchtrail.example/map',
    banner: true,
  },
]

const retiresAtMs = (e: PerchEvent) => Date.parse(e.retiresAt)

/** Events still to come, soonest first. */
export function upcomingEvents(now: Date, events: PerchEvent[] = EVENTS): PerchEvent[] {
  return events
    .filter((e) => retiresAtMs(e) > now.getTime())
    .sort((a, b) => retiresAtMs(a) - retiresAtMs(b))
}

/** Events that have happened, oldest first (the order they're listed above). */
export function pastEvents(now: Date, events: PerchEvent[] = EVENTS): PerchEvent[] {
  return events.filter((e) => retiresAtMs(e) <= now.getTime())
}

/**
 * The event the site-wide banner should advertise, or null. Only one banner is
 * ever shown: the soonest upcoming event opted in via `banner: true`.
 */
export function bannerEvent(now: Date, events: PerchEvent[] = EVENTS): PerchEvent | null {
  return upcomingEvents(now, events).find((e) => e.banner) ?? null
}
