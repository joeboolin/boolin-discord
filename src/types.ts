export type ShowStatus =
  | 'backlog'
  | 'to_be_requested'
  | 'awaiting_response'
  | 'awaiting_full_confirmation'
  | 'fully_confirmed'

export type ReviewStatus = 'not_started' | 'in_progress' | 'done'

export interface Show {
  id:              string
  artist:          string
  location:        string
  show_date:       string
  photographer_id: string | null
  writer_id:       string | null
  status:          ShowStatus
  priority:        boolean
  notes:           string | null
  created_at:      string
  updated_at:      string
}

export interface Review {
  id:          string
  artist:      string
  notes:       string | null
  nmf_week_id: string
  assignee_id: string | null
  status:      ReviewStatus
  wp_post_id:  number | null
  created_at:  string
  updated_at:  string
}

export interface NmfWeek {
  id:                  string
  week_date:           string
  wp_post_id:          number | null
  spotify_playlist_id: string | null
  status:              'pending' | 'draft' | 'published'
  created_at:          string
}

export interface User {
  id:         string
  name:       string
  email:      string
  discord_id: string | null
  role:       'admin' | 'editor' | 'contributor'
}

export const STATUS_LABELS: Record<ShowStatus, string> = {
  backlog:                    'Backlog',
  to_be_requested:            'To Be Requested',
  awaiting_response:          'Awaiting Response',
  awaiting_full_confirmation: 'Awaiting Full Confirmation',
  fully_confirmed:            'Fully Confirmed',
}

// Safe label lookup. The internal site owns the status list and has grown it
// before (backlog was added there first) — an unknown status must never
// render as "undefined" in an embed again. Falls back to Title Casing the
// raw value, so a future status degrades gracefully instead of breaking.
export function statusLabel(status: string): string {
  const known = (STATUS_LABELS as Record<string, string>)[status]
  if (known) return known
  return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

// Today's date (YYYY-MM-DD) in Europe/London — NOT UTC. The board's show
// dates are UK dates; using toISOString() made "today" flip an hour early
// (or late, in BST) around midnight. en-CA locale formats as YYYY-MM-DD.
export function todayLondon(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date())
}

// Discord-native timestamp — renders in each viewer's own locale/timezone:
// style 'D' = "4 July 2026", 'R' = "in 3 days". Date-only values anchor to
// noon UTC so no viewer's timezone rolls them to the previous day.
// NOTE: only renders in message content, embed DESCRIPTIONS and FIELD VALUES
// — not titles, field names, or footers (use fmtDate/fmtWeekDate there).
export function discordDate(isoDate: string, style: 'D' | 'R' = 'D'): string {
  const unix = Math.floor(Date.parse(isoDate + 'T12:00:00Z') / 1000)
  return `<t:${unix}:${style}>`
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })
}

export function fmtWeekDate(iso: string): string {
  return new Date(iso + 'T12:00:00Z').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  })
}
