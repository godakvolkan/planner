# 🎯 Antigravity Görevi: Control Center — Personal Planning Engine

> **Slogan:** Aklında tutma. Planına bırak.

Bu dosya, Antigravity ajanı için proje görev tanımıdır. Klasik bir Todo uygulaması **değil**; yazılım, üniversite, Deneyap, TÜBİTAK, kariyer ve kişisel işler arasında kaybolmayı engelleyen, **"Şu anda ne yapmalıyım?"** sorusunu cevaplayan bir masaüstü planlama motoru geliştirilecek.

Uygulamanın amacı hafızayı değil, **karar verme yükünü** azaltmaktır.

---

## 0. Ajan için çalışma kuralları

1. **Önce sadece V1 (MVP) yapılacak.** V2 özellikleri (enerji, bağlam önerileri, öğrenen profil) V1 bitip çalışmadan başlanmayacak.
2. Her faz sonunda uygulama `npm run dev` ile çalışır durumda olmalı.
3. Arayüz dili **Türkçe**, kod (değişken, fonksiyon, dosya adları) **İngilizce**.
4. Backend/sunucu yok. Tüm veri yerelde (SQLite).
5. Proje GitHub'a konulduğunda şu üç adımla başka bilgisayarda çalışmalı:
   ```bash
   git clone <repo>
   npm install
   npm run dev
   ```
6. Her fazdan sonra kısa bir özet ve "kabul kriterleri" kontrol listesini raporla.
7. **Arayüzle ilgili her işte önce `.agent/skills/planner-ui-ux/SKILL.md` dosyasını oku ve oradaki token, ton ve kısayol kurallarına uy.**
8. **Her fazdan önce `EK_OZELLIKLER.md` dosyasındaki "Faz eşlemesi" tablosuna (§5) bak.** O faza eklenmiş maddeler de o fazın kapsamına ve kabul kriterlerine dahildir.

---

## 1. Teknik yığın

| Katman | Teknoloji |
|---|---|
| Masaüstü | Electron |
| Arayüz | React + TypeScript |
| Build | Vite (electron-vite önerilir) |
| Veri | SQLite (`better-sqlite3`) |
| Stil | Tailwind CSS v4 |
| UI component'leri | **shadcn/ui** (CLI v4, Radix primitives, `new-york` stili) + lucide-react ikonları |
| State | Zustand (veya benzeri hafif çözüm) |
| Tarih ayrıştırma | Türkçe doğal dil için özel parser (gerekirse `chrono-node` + Türkçe kurallar) |

### Mimari

```
Electron
│
├── Main Process      → SQLite erişimi, tray, global kısayollar, bildirimler
├── Preload           → contextBridge ile güvenli IPC API
└── Renderer (React)
     ├── Dashboard ("Şimdi ne?")
     ├── Today
     ├── Inbox
     ├── Calendar / Week
     ├── Focus
     ├── Analytics
     └── Settings
```

> Renderer doğrudan veritabanına erişmez; tüm veri işlemleri preload üzerinden IPC ile main process'e gider. `contextIsolation: true`, `nodeIntegration: false`.

### Önerilen klasör yapısı

```
src/
├── main/            # Electron main process
│   ├── db/          # SQLite bağlantısı, migration'lar, repository'ler
│   ├── ipc/         # IPC handler'ları
│   ├── tray.ts
│   ├── shortcuts.ts
│   └── notifications.ts
├── preload/
│   └── index.ts
├── renderer/
│   ├── pages/
│   ├── components/
│   ├── store/
│   └── lib/         # quick-add parser, planlama algoritmaları
└── shared/          # ortak tipler (Task, Area, Session...)
```

---

## 2. Veri modeli (SQLite)

> Ek tablolar ve alanlar (tekrarlayan görevler, ders programı, gün bazında kapasite, ritüeller, bekleyenler, yedekler) için **`EK_OZELLIKLER.md` §0** dosyasına bak. Bu ekler Faz 2'den önceki migration'da oluşturulur.

```
areas        id, name, icon, color, sort_order
tasks        id, title, area_id, status (inbox|planned|active|done|archived),
             priority (1-4), deadline, scheduled_date, scheduled_time,
             estimate_min, first_step, context, energy_level,
             postpone_count, parent_id (subtask için), created_at, completed_at
tags         id, name
task_tags    task_id, tag_id
sessions     id, task_id, started_at, ended_at, duration_min   ← gerçek süre takibi
time_blocks  id, task_id, date, start_time, end_time
daily_stats  date, capacity_min, planned_min, actual_min, energy
postpone_log id, task_id, date, reason
settings     key, value
```

Varsayılan alanlar (ilk çalıştırmada seed):

🎓 Üniversite · 💻 Yazılım · 🤖 Deneyap · 🔬 TÜBİTAK · 🚀 Kariyer · 🏠 Kişisel

---

## 3. V1 — MVP kapsamı (ŞİMDİ YAPILACAK)

```
CORE        Task · Area · Tag · Deadline · Estimate · Subtask
PLANNING    Today · Inbox · Daily capacity · Time blocking · Today's 3
TRACKING    Actual time · Delay count · Planned vs actual
DESKTOP     Quick Add · Tray · Notifications · Keyboard shortcuts
DATA        SQLite · JSON Export · JSON Import
```

### Faz 1 — İskelet
- [x] Electron + React + TS + Vite projesi kur
- [x] Tailwind v4 + shadcn/ui kurulumu (`.agent/skills/planner-ui-ux/references/shadcn.md` → "Kurulum"), tema değişkenleri ve Inter fontu
- [x] SQLite bağlantısı, migration sistemi, seed (alanlar)
- [x] Preload IPC API ve ortak tipler
- [x] Sol menü + sayfa yönlendirme (Şimdi, Bugün, Inbox, Planlayıcı, Alanlar, Focus, Analiz · altta Ara, Ayarlar)

**Kabul:** `npm run dev` ile pencere açılıyor, alanlar veritabanından listeleniyor.

### Faz 2 — Görev çekirdeği
- [ ] `EK_OZELLIKLER.md` §0: ek tablolar için migration
- [ ] `EK_OZELLIKLER.md` §1.1: tekrarlayan görevler
- [ ] Görev CRUD (başlık, alan, etiket, öncelik, deadline, tahmini süre, ilk adım)
- [ ] Alt görevler (subtask)
- [ ] Inbox: planlanmamış görevler
- [ ] Inbox temizleme akışı: her görev için → **Bugün / Bu hafta / Daha sonra / Alana taşı / Sil**

**Kabul:** Görev eklenip düzenlenebiliyor, uygulama kapatılıp açılınca veri duruyor.

### Faz 3 — Ana ekran: "Şimdi ne?"
Uygulama açıldığında 50 görev değil, şunu gösterir:

```
┌─────────────────────────────────────────────┐
│  ÇARŞAMBA · 7 EKİM                          │
│  ŞU ANDA                                    │
│  🔴 TÜBİTAK sonuç raporu                    │
│  İlk adım: 📄 Sonuç raporu dosyasını aç     │
│  Tahmini: 1s 20dk          [ BAŞLA ]        │
├─────────────────────────────────────────────┤
│  SONRA                                      │
│  ○ Üniversite ödevi       45 dk             │
│  ○ Deneyap hazırlık       30 dk             │
│  ○ GitHub README          20 dk             │
├─────────────────────────────────────────────┤
│  BUGÜN  4 görev · 3s 40dk                   │
│  Kapasite: ████████░░ 4 / 5 saat            │
└─────────────────────────────────────────────┘
```

- [ ] "Şu anda" seçim algoritması (v1 basit puanlama): saati gelmiş zaman bloğu > deadline yakınlığı > öncelik > "Bugünün 3'ü" işareti
- [ ] "Bugünün 3'ü": günün en önemli 3 görevi işaretlenebilir
- [ ] Her görevde **İlk adım** alanı; "Başla" ekranında ilk adım büyük gösterilir
- [ ] Günlük kapasite ayarı (varsayılan 5 saat) ve kapasite çubuğu

**Kabul:** Ana ekran tek bir "şu anda" görevi, sonraki 3 görevi ve kapasite özetini gösteriyor.

### Faz 4 — Zaman takibi ve Focus
- [ ] "Başla" → zamanlayıcı başlar, `sessions` tablosuna kayıt
- [ ] Duraklat / bitir / tamamlandı
- [ ] Focus Mode (`Ctrl+Shift+F`): sadece aktif görev + sayaç + ilk adım
- [ ] Planlanan vs gerçekleşen (görev bazında): `Tahmin 1s · Gerçek 1s 42dk · +42 dk`
- [ ] Erteleme sayacı (`postpone_count`) — görev ertesi güne kaydırıldığında artar

**Kabul:** Bir görev başlatılıp bitirildiğinde gerçek süre kaydediliyor ve tahminle kıyaslanıyor.

### Faz 5 — Planlama
- [ ] `EK_OZELLIKLER.md` §1.2: haftalık ders programı / sabit etkinlikler
- [ ] `EK_OZELLIKLER.md` §1.3: gün bazında kapasite (Ayarlar tablosu + gerçek kapasite hesabı)
- [ ] `EK_OZELLIKLER.md` §1.4: sabah planlama ritüeli ve gün kapanışı
- [ ] Bugün görünümü + zaman bloklama (saat çizelgesine sürükle-bırak)
- [ ] **"Fazla planladın" uyarısı:**
  ```
  🔴 Bugün kapasitenin 3 saat 30 dakika üzerindesin.
  [ GÜNÜ DENGELE ]
  ```
  "Günü dengele": en düşük öncelikli/deadline'ı uzak görevleri ertesi güne taşımayı önerir (kullanıcı onaylar).
- [ ] Haftalık görünüm: alanlara göre günlük dağılım + haftalık özet (planlanan, gerçekleşen, tamamlanan, ertelenen)
- [ ] Gün sonu özeti "Bugün ne yaptım?": alan bazında gerçek süreler + toplam

### Faz 6 — Masaüstü özellikleri
- [ ] **Quick Add** (`Ctrl+Space`, global kısayol — uygulama arka plandayken bile çalışır): küçük pencere açılır
- [ ] Türkçe doğal dil ayrıştırma:
  ```
  "yarın 14:00 TÜBİTAK raporunu 2 saat yap"
  → Görev: TÜBİTAK raporu · Tarih: yarın · Saat: 14:00 · Tahmini: 2 saat
  ```
  Desteklenecek ifadeler: `bugün, yarın, öbür gün, pazartesi…pazar, 14:00, 2 saat, 30 dk, 1.5 saat`, alan tespiti için anahtar kelimeler (`tübitak, deneyap, ödev, ders, github…`) ve `#alan` / `@etiket` sözdizimi. Tarih/süre içermeyen görevler Inbox'a düşer.
- [ ] System Tray: aktif görev ve sayaç (`🟢 TÜBİTAK 00:43:21`), hızlı başlat/durdur
- [ ] Bildirimler: `🔔 15 dakika sonra Deneyap hazırlığı.`
- [ ] Uygulama içi kısayollar listesi (Ayarlar'da)

### Faz 7 — Veri
- [ ] `EK_OZELLIKLER.md` §1.5: otomatik günlük yedek (son 7 gün)
- [ ] `EK_OZELLIKLER.md` §1.6: FTS5 ile hızlı arama
- [ ] JSON Export (tüm tablolar)
- [ ] JSON Import (doğrulama + çakışma durumunda uyarı)
- [ ] README.md: proje tanıtımı, ekran görüntüleri, kurulum, mimari

**Quick Add parser'ı ve "Şimdi ne?" algoritması için birim testleri yazılmalı (Vitest).**

---

## 3.5 V1.5 — Farkı yaratan özellikler (Faz 7'den sonra)

Detaylar `EK_OZELLIKLER.md` §2 içinde: çalışan "İlk adım" (dosya/link açma) · kişisel tahmin çarpanı · Focus içinde hızlı yakalama · görsel zamanlayıcı · Bekleyenler · mola hatırlatıcısı.

---

## 4. V2 — Sonraki sürüm (V1 BİTMEDEN BAŞLAMA)

> V2/V3 için ek başlıklar (deadline'dan geriye planlama, takvim okuma, GitHub içe aktarma, telefondan yakalama) ve **yapılmayacaklar listesi**: `EK_OZELLIKLER.md` §3 ve §4.

```
Personal Planning Engine → Energy → Context → Automatic suggestions → Weekly analysis
```

- **"Kaç dakikam var?"** — Kullanıcı boş süresini girer (30 dk / 2 saat), uygulama o süreye sığan görev kombinasyonunu önerir.
  ```
  30 DAKİKALIK BOŞLUĞUN VAR
  ✓ Deneyap mesajını gönder   5 dk
  ✓ GitHub issue kontrol et  10 dk
  ✓ README düzenle           15 dk
  ```
- **Bağlam (context):** 💻 Bilgisayar · 🏠 Ev · 🎓 Üniversite · 📱 Telefon · 🌐 İnternet · 👥 İnsanlarla → "Şu an yapabileceklerim" filtresi.
- **Enerji:** Sabah "Bugün nasılsın? 😴 Düşük · 🙂 Normal · 🔥 Yüksek" → düşük enerjide küçük işler, yüksekte büyük işler önerilir.
- **Büyük görevleri parçalama:** Tahmini süre eşiği aşan görevler için "Parçalamak ister misin?" ve alt görevleri günlere dağıtma.
- **"Bunu neden yapmıyorum?":** 3 kez ertelenen görevde neden sorulur (Çok büyük · Sıkıcı · Ne yapacağımı bilmiyorum · Vaktim olmadı · Önceliği değişti · Başka).
  - Çok büyük → parçalamayı öner
  - Ne yapacağımı bilmiyorum → ilk adımı belirlet
- **Seni tanıyan profil:** Alan/tür bazında tahmin doğruluğu, en verimli saatler, ortalama odak süresi.
  ```
  Rapor yaz 1 saat
  → Benzer görevler ortalama 1s 35dk sürdü. 1s 30dk planlayayım mı?
  ```
- **Planlama kalitesi skoru** (streak/gamification yerine gerçek metrikler):
  ```
  PLANLAMA KALİTESİ  ████████████████░░ 82%
  Tahminlerin %78 doğru · Günlük kapasite %91 doğru · Erteleme ↓ %18
  ```

---

## 5. Projenin farkı (README'de vurgulanacak 5 özellik)

1. **"Şu anda ne yapmalıyım?"** motoru
2. Boş zamana göre görev seçme
3. Tahmin edilen süre vs gerçek süre
4. Ertelenen görevin nedenini analiz etme
5. Kullanıcıyı tanıyıp zamanla daha gerçekçi plan yapması

> Bu bir Todo Manager değil, **Personal Planning Engine**: kişisel planlama algoritması olan bir masaüstü yazılım projesi.

---

## 6. Tasarım ilkeleri

- Ana ekran sade: tek odak görevi, az bilgi, büyük "BAŞLA" butonu.
- Görev eklemek 1 satır yazmaktan fazla sürmemeli.
- Klavye ile tüm temel işlemler yapılabilmeli.
- Koyu/açık tema desteği.
- Streak, rozet gibi abartılı oyunlaştırma yok.
