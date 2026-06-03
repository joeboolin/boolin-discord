export type ShowStatus =
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
  to_be_requested:           'To Be Requested',
  awaiting_response:         'Awaiting Response',
  awaiting_full_confirmation: 'Awaiting Full Confirmation',
  fully_confirmed:           'Fully Confirmed',
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
