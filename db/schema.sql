-- 東京どっと混む DBスキーマ（SQLite）
-- 将来Postgresに移行しやすいよう、型・制約はシンプルに保つ

CREATE TABLE IF NOT EXISTS venues (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  area          TEXT NOT NULL,
  lat           REAL NOT NULL,
  lng           REAL NOT NULL,
  stations      TEXT NOT NULL,      -- JSON: [{ "name": "...", "lines": ["chuo", ...] }]
  official_url  TEXT NOT NULL,
  source_type   TEXT NOT NULL       -- 'official_table' | 'official_calendar' | 'official_list'
);

CREATE TABLE IF NOT EXISTS events (
  id            TEXT PRIMARY KEY,   -- venue_id + date + name のハッシュ
  venue_id      TEXT NOT NULL REFERENCES venues(id),
  name          TEXT NOT NULL,
  genre         TEXT NOT NULL CHECK (genre IN ('music','sports','expo','other','fireworks')),
  date          TEXT NOT NULL,      -- YYYY-MM-DD
  start_time    TEXT,               -- HH:MM、未公開の場合はNULL
  end_time      TEXT,               -- HH:MM、未公開の場合が多いためNULL許容
  scale         TEXT NOT NULL CHECK (scale IN ('large','medium','small')),
  source_url    TEXT,
  scraped_at    TEXT NOT NULL,      -- ISO8601
  raw_html_hash TEXT,               -- 変更検知用
  UNIQUE (venue_id, date, name)
);

CREATE INDEX IF NOT EXISTS idx_events_date ON events (date);
CREATE INDEX IF NOT EXISTS idx_events_venue ON events (venue_id);
