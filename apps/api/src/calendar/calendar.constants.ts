/** Zone applied when the client omits `?time_zone=` — senseiAPI parity. */
export const DEFAULT_TIME_ZONE = 'Asia/Jerusalem';

/** Wire format of the `from`/`to` list query params. */
export const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** A listing window may span at most a year. */
export const MAX_RANGE_DAYS = 365;

/** Days added to one bound to derive the other (Sun–Sat inclusive week). */
export const WEEK_END_OFFSET_DAYS = 6;

/** Calendar week length — used to locate the most recent Sunday. */
export const DAYS_PER_WEEK = 7;

export const TITLE_MIN_LENGTH = 1;
export const TITLE_MAX_LENGTH = 255;
export const DESCRIPTION_MAX_LENGTH = 2000;
