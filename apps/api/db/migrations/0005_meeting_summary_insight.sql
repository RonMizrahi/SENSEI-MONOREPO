-- 0005_meeting_summary_insight.sql — add the per-session clinical "insight".
-- SessionDetail in the SPA shows a short insight alongside the summary; the
-- meeting_summaries row is its natural home (1:1 with the meeting). Nullable, so
-- existing/AI-generated summaries without an insight are unaffected.

ALTER TABLE meeting_summaries ADD COLUMN insight text;
