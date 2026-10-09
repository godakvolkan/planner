CREATE TABLE IF NOT EXISTS areas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  icon TEXT,
  color TEXT,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  area_id INTEGER,
  status TEXT DEFAULT 'inbox',
  priority INTEGER DEFAULT 1,
  deadline TEXT,
  scheduled_date TEXT,
  scheduled_time TEXT,
  estimate_min INTEGER,
  first_step TEXT,
  context TEXT,
  energy_level TEXT,
  postpone_count INTEGER DEFAULT 0,
  parent_id INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  FOREIGN KEY (area_id) REFERENCES areas(id),
  FOREIGN KEY (parent_id) REFERENCES tasks(id)
);

CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS task_tags (
  task_id INTEGER,
  tag_id INTEGER,
  PRIMARY KEY (task_id, tag_id),
  FOREIGN KEY (task_id) REFERENCES tasks(id),
  FOREIGN KEY (tag_id) REFERENCES tags(id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  duration_min INTEGER,
  FOREIGN KEY (task_id) REFERENCES tasks(id)
);

CREATE TABLE IF NOT EXISTS time_blocks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER,
  date TEXT NOT NULL,
  start_time TEXT,
  end_time TEXT,
  FOREIGN KEY (task_id) REFERENCES tasks(id)
);

CREATE TABLE IF NOT EXISTS daily_stats (
  date TEXT PRIMARY KEY,
  capacity_min INTEGER DEFAULT 300,
  planned_min INTEGER DEFAULT 0,
  actual_min INTEGER DEFAULT 0,
  energy TEXT
);

CREATE TABLE IF NOT EXISTS postpone_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER,
  date TEXT NOT NULL,
  reason TEXT,
  FOREIGN KEY (task_id) REFERENCES tasks(id)
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
