-- EK_OZELLIKLER.md §0 veri modeli + Faz 2 için gereken alanlar

CREATE TABLE recurrences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  area_id INTEGER REFERENCES areas(id) ON DELETE SET NULL,
  estimate_min INTEGER,
  priority INTEGER NOT NULL DEFAULT 1,
  first_step TEXT,
  first_step_target TEXT,
  first_step_type TEXT CHECK (first_step_type IN ('file', 'folder', 'url')),
  rule TEXT NOT NULL CHECK (rule IN ('daily', 'weekdays', 'weekly', 'monthly')),
  weekdays TEXT,
  day_of_month INTEGER,
  time TEXT,
  start_date TEXT NOT NULL,
  end_date TEXT,
  active INTEGER NOT NULL DEFAULT 1
);

-- Bir kuraldan hangi gün için örnek üretildiği. Kullanıcı örneği silse bile aynı gün yeniden üretilmez.
CREATE TABLE recurrence_log (
  recurrence_id INTEGER NOT NULL REFERENCES recurrences(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  PRIMARY KEY (recurrence_id, date)
);

ALTER TABLE tasks ADD COLUMN notes TEXT;
ALTER TABLE tasks ADD COLUMN planned_week TEXT;
ALTER TABLE tasks ADD COLUMN top3_date TEXT;
ALTER TABLE tasks ADD COLUMN recurrence_id INTEGER REFERENCES recurrences(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN waiting_for TEXT;
ALTER TABLE tasks ADD COLUMN follow_up_date TEXT;
ALTER TABLE tasks ADD COLUMN first_step_target TEXT;
ALTER TABLE tasks ADD COLUMN first_step_type TEXT CHECK (first_step_type IN ('file', 'folder', 'url'));

CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_scheduled_date ON tasks(scheduled_date);
CREATE INDEX idx_tasks_parent_id ON tasks(parent_id);
CREATE INDEX idx_tasks_top3_date ON tasks(top3_date);

CREATE TABLE fixed_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  area_id INTEGER REFERENCES areas(id) ON DELETE SET NULL,
  weekday INTEGER NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  valid_from TEXT,
  valid_to TEXT,
  counts_against_capacity INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE day_capacity (
  weekday INTEGER PRIMARY KEY CHECK (weekday BETWEEN 1 AND 7),
  minutes INTEGER NOT NULL
);

INSERT INTO day_capacity (weekday, minutes) VALUES
  (1, 300), (2, 300), (3, 300), (4, 300), (5, 300), (6, 360), (7, 180);

CREATE TABLE capacity_overrides (
  date TEXT PRIMARY KEY,
  minutes INTEGER NOT NULL
);

CREATE TABLE daily_rituals (
  date TEXT PRIMARY KEY,
  morning_done_at TEXT,
  shutdown_done_at TEXT,
  note TEXT
);

CREATE TABLE backups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  path TEXT NOT NULL,
  size_bytes INTEGER
);
