-- E-posta (IMAP + uygulama şifresi) hesapları. Şifre Electron safeStorage (Windows DPAPI) ile şifreli saklanır.
CREATE TABLE mail_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider TEXT NOT NULL,                 -- gmail | outlook | yandex | icloud | custom
    email TEXT NOT NULL UNIQUE,
    host TEXT NOT NULL,
    port INTEGER NOT NULL DEFAULT 993,
    secret BLOB NOT NULL,                   -- şifreli uygulama şifresi; düz metin asla saklanmaz
    mailbox TEXT NOT NULL DEFAULT 'INBOX',
    rule TEXT NOT NULL DEFAULT 'flagged',   -- flagged (yıldızlı) | unread (okunmamış) | all (tümü)
    area_id INTEGER REFERENCES areas(id) ON DELETE SET NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    last_synced_at TEXT,
    last_error TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Aynı e-posta iki kez görev olmasın
CREATE TABLE mail_imports (
    account_id INTEGER NOT NULL REFERENCES mail_accounts(id) ON DELETE CASCADE,
    message_key TEXT NOT NULL,              -- Message-ID başlığı (yoksa uid)
    task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
    imported_at TEXT NOT NULL,
    PRIMARY KEY (account_id, message_key)
);

-- 006'daki connected_accounts düz metin token tutacak şekildeydi ve hiç kullanılmadı; yerine mail_accounts geldi
DROP TABLE IF EXISTS connected_accounts;
