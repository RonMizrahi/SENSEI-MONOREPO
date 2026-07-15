// Resolves the notification feed: the live senseiapi list when VITE_API_BASE_URL
// is set, falling back to the shared demo catalog otherwise. Maps the API's
// snake_case shape to the page's field names (text/time/group/pid) so the
// NotificationsPage renders either source unchanged. Leaf-layering: no store/page
// imports — the demo fallback is passed in by the caller.
import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { isApiConfigured } from '../services/apiClient';
import { listNotifications, type ApiNotification } from '../services/notifications';

/** Notification shape the NotificationsPage renders (kind/title/text/time/group/pid). */
export interface FeedNotification {
  id: string
  kind: string
  title: string
  text: string
  time: string
  group: string
  pid: string | null
  read: boolean
  archived: boolean
}

/** Maps one API notification onto the page's field names. */
function toFeed(n: ApiNotification): FeedNotification {
  return {
    id: n.id,
    kind: n.kind,
    title: n.title,
    text: n.body,
    time: n.display_time,
    group: n.group_label,
    pid: n.patient_id,
    read: n.read,
    archived: n.archived,
  };
}

/**
 * Returns the notification feed. When the API is configured it fetches the live
 * list; otherwise (and on any error) it returns `demo` unchanged. `apiMode` tells
 * the page whether read/archived state should come from the feed rows (API) or
 * the local store (demo).
 */
export function useNotifications(demo: FeedNotification[]): {
  notifs: FeedNotification[]
  setNotifs: Dispatch<SetStateAction<FeedNotification[]>>
  apiMode: boolean
} {
  const apiMode = isApiConfigured();
  const [notifs, setNotifs] = useState<FeedNotification[]>(demo);

  useEffect(() => {
    if (!apiMode) {
      setNotifs(demo);
      return undefined;
    }
    const ac = new AbortController();
    listNotifications(ac.signal)
      .then((rows) => setNotifs(rows.map(toFeed)))
      .catch(() => setNotifs(demo)); // fall back to demo copy on any error
    return () => ac.abort();
    // demo is a stable module constant; re-run only on mode change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiMode]);

  return { notifs, setNotifs, apiMode };
}
