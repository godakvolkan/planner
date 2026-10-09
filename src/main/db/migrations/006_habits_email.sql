-- Alışkanlıklar ve Zincir (Streak) takibi için recurrences tablosuna eklemeler
ALTER TABLE recurrences ADD COLUMN is_habit INTEGER NOT NULL DEFAULT 0;
ALTER TABLE recurrences ADD COLUMN current_streak INTEGER NOT NULL DEFAULT 0;
ALTER TABLE recurrences ADD COLUMN longest_streak INTEGER NOT NULL DEFAULT 0;

-- Alışkanlıkların günlük takibi için (hangi gün yapıldı?)
CREATE TABLE habit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recurrence_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    completed_at TEXT NOT NULL,
    FOREIGN KEY(recurrence_id) REFERENCES recurrences(id) ON DELETE CASCADE,
    UNIQUE(recurrence_id, date)
);

-- E-posta entegrasyonu (Ayarlar)
-- Ayarlar tablosuna (schema'sında zaten tek satır olduğu varsayımıyla)
-- Şimdilik settings tablosuna email yetkilendirme bilgileri eklenebilir, fakat profiller
-- her veritabanında ayrı olduğu için auth_tokens gibi bir tablo daha güvenli olabilir.
CREATE TABLE connected_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider TEXT NOT NULL, -- 'gmail', 'outlook'
    email TEXT NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    last_synced_at TEXT,
    UNIQUE(provider, email)
);
ALTER TABLE tasks ADD COLUMN attached_folder TEXT;
