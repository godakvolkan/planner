-- FTS5 tam metin arama: başlık + notlar + ilk adım + bekleme notu, Türkçe karakterler sadeleştirilmiş
CREATE VIRTUAL TABLE tasks_fts USING fts5(body, tokenize = 'unicode61 remove_diacritics 2');

INSERT INTO tasks_fts (rowid, body)
SELECT id, cc_fold(title || ' ' || COALESCE(notes, '') || ' ' || COALESCE(first_step, '') || ' ' || COALESCE(waiting_for, ''))
FROM tasks;

CREATE TRIGGER tasks_fts_insert AFTER INSERT ON tasks BEGIN
  INSERT INTO tasks_fts (rowid, body)
  VALUES (new.id, cc_fold(new.title || ' ' || COALESCE(new.notes, '') || ' ' || COALESCE(new.first_step, '') || ' ' || COALESCE(new.waiting_for, '')));
END;

CREATE TRIGGER tasks_fts_update AFTER UPDATE OF title, notes, first_step, waiting_for ON tasks BEGIN
  DELETE FROM tasks_fts WHERE rowid = old.id;
  INSERT INTO tasks_fts (rowid, body)
  VALUES (new.id, cc_fold(new.title || ' ' || COALESCE(new.notes, '') || ' ' || COALESCE(new.first_step, '') || ' ' || COALESCE(new.waiting_for, '')));
END;

CREATE TRIGGER tasks_fts_delete AFTER DELETE ON tasks BEGIN
  DELETE FROM tasks_fts WHERE rowid = old.id;
END;

CREATE INDEX idx_tasks_follow_up ON tasks(follow_up_date);
