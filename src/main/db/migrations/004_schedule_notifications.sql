-- Ders programı için konum, alanlara açık renk, bildirim kaydı

ALTER TABLE fixed_events ADD COLUMN location TEXT;
CREATE INDEX idx_fixed_events_weekday ON fixed_events(weekday);

-- Alan rengi artık açıkça seçilir: 'area-1' … 'area-8' (tema değişkeni)
UPDATE areas SET color = 'area-' || (((sort_order - 1) % 8 + 8) % 8 + 1);

-- Aynı bildirim iki kez gönderilmesin (uygulama yeniden açılsa bile)
CREATE TABLE notification_log (
  key TEXT PRIMARY KEY,
  sent_at TEXT NOT NULL
);
