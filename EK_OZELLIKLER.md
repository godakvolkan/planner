# ➕ Ek Özellikler — Rakip Analizi Sonrası

Bu dosya `ANTIGRAVITY_GOREV.md` dosyasının **ekidir**. Rakip uygulamalar (Sunsama, Motion, Akiflow, Morgen, TickTick) ve dikkat sorunu yaşayanlar için yapılan uygulamalar incelendikten sonra planda eksik görülen özellikleri tanımlar.

Ana görev dosyası ile bu dosya çelişirse **kapsam ve fazlar için ana görev dosyası**, **bu dosyada tanımlı özelliklerin detayı için bu dosya** geçerlidir. Arayüz kuralları için her zaman `.agent/skills/planner-ui-ux/SKILL.md` dosyasına uy.

| Grup | Ne zaman | Bölüm |
|---|---|---|
| 🛠️ Faz 1 düzeltmeleri | **Hemen**, Faz 2'den önce | §F |
| 🗄️ Veri modeli | Faz 1 düzeltmeleriyle birlikte, Faz 2'den önce | §0 |
| 🔴 V1 eksikleri | Ana fazların **içinde**, ilgili fazda | §1 |
| 🟢 V1.5 | Faz 7 bittikten sonra, V2'den önce | §2 |
| 🔵 V2 / V3 | V1.5 bittikten sonra | §3 |
| ⛔ Yapılmayacaklar | Hiçbir zaman | §4 |

---

## F. 🛠️ Faz 1 düzeltmeleri (Faz 2'den ÖNCE yapılacak)

Faz 1 incelemesinde (7 Ekim 2026) çalışan ama ileride sorun çıkaracak noktalar bulundu. Bunlar düzeltilmeden Faz 2'ye geçilmez.

### F.1 Tip kontrolü hatasız geçmeli
Şu an `App.tsx:62` satırında `window.api` için `Property 'api' does not exist on type 'Window'` hatası var. Sebebi, `src/preload/index.d.ts` dosyasının renderer'ın tsconfig'inde olmaması.

- [x] `tsconfig.web.json` → `include` içine `src/preload/*.d.ts` ekle.
- [x] `package.json`'a script ekle: `"typecheck": "tsc --noEmit -p tsconfig.node.json && tsc --noEmit -p tsconfig.web.json"`.
- [x] `any` kullanma: `getAreas` dönüş tipi `src/shared/types.ts` içindeki `Area` tipi olsun. Main, preload ve renderer aynı tipi kullansın.

**Kabul:** `npm run typecheck` sıfır hatayla bitiyor.

### F.2 Migration sistemi paketlenmiş uygulamada da çalışmalı
Şu an `src/main/db/index.ts` kurulum SQL'ini `app.getAppPath()/src/main/db/migrations/001_initial.sql` yolundan okuyor. Paketlenmiş uygulamada `src/` klasörü olmadığı için uygulama **ilk açılışta çöker**. Ayrıca sistem sadece `currentVersion === 0` durumuna bakıyor, yani `002` migration'ı hiç çalışmaz.

- [x] Migration'lar build'e gömülsün: `import.meta.glob('./migrations/*.sql', { query: '?raw', import: 'default', eager: true })` (veya her dosya için `?raw` import).
- [x] Bir migration çalıştırıcısı yaz (`src/main/db/migrate.ts`):
  - Dosyaları numara sırasına göre al (`001_`, `002_`…).
  - `schema_version` tablosundaki en büyük sürümden büyük olanları sırayla çalıştır.
  - Her migration ve `schema_version` kaydını **tek bir transaction** içinde yap. Hata olursa geri al ve uygulamayı anlaşılır bir hata mesajıyla aç.
- [x] Seed (6 alan) ayrı bir migration olsun (`002_seed_areas.sql`) veya sadece `areas` tablosu boşsa çalışsın. Böylece iki kez eklenmez.
- [x] `PRAGMA foreign_keys = ON` ve `PRAGMA journal_mode = WAL` bağlantı açılınca ayarlansın.

**Kabul:** `npm run build && npm run preview` ile uygulama açılıyor ve alanlar listeleniyor. Eski bir veritabanında yeni migration eklenince sadece o migration çalışıyor.

### F.3 Veritabanının yeri
Şu an geliştirme modunda `control_center.db` proje klasörüne yazılıyor. Bu dosya GitHub'a gidebilir.

- [x] Hem geliştirmede hem paketlenmiş uygulamada `app.getPath('userData')` kullan. Geliştirmede karışmasın diye dosya adı `control_center.dev.db` olsun.
- [x] Proje kökündeki `control_center.db` dosyasını sil.
- [x] `.gitignore`'a ekle: `*.db`, `*.db-wal`, `*.db-shm`, `out/`, `dist/`.

**Kabul:** Proje klasöründe `.db` dosyası oluşmuyor.

### F.4 `cn` yardımcı fonksiyonu tek kaynaktan gelmeli
7 dosya `cn` fonksiyonunu projedeki `@/lib/utils` yerine `cn` adlı dış bir npm paketinden alıyor (`import { cn } from "cn"`). shadcn standardı ile uyumsuz ve gereksiz bir bağımlılık.

- [x] Tüm `from "cn"` importlarını `from "@/lib/utils"` yap.
- [x] `npm uninstall cn`.
- [x] Gereksiz kalan tekil Radix paketlerini kaldır (`@radix-ui/react-dialog`, `@radix-ui/react-separator`, `@radix-ui/react-slot`, `@radix-ui/react-tooltip`). Component'ler zaten birleşik `radix-ui` paketini kullanıyor. Kaldırdıktan sonra build alınarak kontrol edilir.

**Kabul:** `grep -r 'from "cn"' src` boş dönüyor, build ve typecheck geçiyor.

### F.5 Primitive kütüphanesi: Radix'te kalınıyor
shadcn kurulumu Radix ile yapılmış. Base UI'ya geçilmeyecek, **Radix ile devam edilecek**.

- [x] `asChild` kullanımı doğru, öyle kalsın. Skill dosyası buna göre güncellendi.
- [x] Yeni component eklerken `components.json` ayarları korunur ve `npx shadcn@latest add <component>` kullanılır. Component elle yazılmaz.

### F.6 Arayüz kurallarına uyum (skill)
Sayfa iskeletleri skill kurallarına göre düzeltilsin:

- [x] Sayfa başlıkları `text-xl font-bold` yerine skill'deki ölçüde olsun: 20px / 600 (`text-xl font-semibold`).
- [x] Alan rengi metne değil, isimden önce küçük bir **nokta** olarak verilsin (skill §3: alan renkleri sadece küçük nokta veya ince çizgi olarak görünür).
- [x] Her boş sayfa `Empty` component'i ile skill'deki boş durum metnini göstersin (`npx shadcn@latest add empty`).
- [x] Arayüz metinleri `src/renderer/src/i18n/tr.ts` dosyasına taşınsın.
- [x] Sayfalar `App.tsx` içinden `src/renderer/src/pages/` klasörüne ayrı dosyalar olarak taşınsın.
- [x] Sol menüde `SidebarMenuButton` için `tooltip={label}` verilsin. Menü ikona daraldığında isimler görünsün.
- [x] Özel başlık çubuğu için sürükleme alanı (`-webkit-app-region: drag`) eklensin. Şu an `titleBarStyle: 'hidden'` olduğu için pencere fareyle taşınamıyor olabilir.

### F.7 Görev dosyasını güncelle
- [x] `ANTIGRAVITY_GOREV.md` içindeki Faz 1 kutularını, gerçekten tamamlananlar için işaretle.

**Faz 1 düzeltmelerinin genel kabulü:** `npm run typecheck`, `npm run build` ve `npm run dev` hatasız. Uygulama açılıyor, pencere taşınabiliyor, 6 alan veritabanından geliyor, proje klasöründe `.db` dosyası yok. Bitince kısa bir rapor ver ve **dur**.

---

## 0. Veri modeli (Faz 1 düzeltmelerinden hemen sonra, Faz 2'den önce)

Bu bölüm **sıradaki boş numarayla ayrı bir migration** olarak yazılır (ör. `003_planning_fields.sql`). `001_initial.sql` dosyası değiştirilmez.

🔴 ve 🟢 özelliklerin ihtiyaç duyduğu alanlar **ilk migration'da veya Faz 2'nin başındaki migration'da** eklenir. Sonradan veritabanı yapısını değiştirmekle uğraşılmasın diye 🟢 alanları da şimdiden eklenir, ama arayüzleri V1.5'te yapılır.

```
tasks (yeni alanlar)
  recurrence_id        → recurrences.id (tekrarlayan görevden üretildiyse)
  status               → 'waiting' durumu eklenir (inbox|planned|active|waiting|done|archived)
  waiting_for          TEXT     "Hoca", "Deneyap öğrencileri"
  follow_up_date       DATE     bekleyen görevin hatırlatma tarihi
  first_step_target    TEXT     dosya yolu, klasör yolu veya URL
  first_step_type      TEXT     'file' | 'folder' | 'url' | NULL

recurrences
  id, title, area_id, estimate_min, priority, first_step, first_step_target, first_step_type,
  rule        TEXT   'daily' | 'weekdays' | 'weekly' | 'monthly' (V1 kapsamı; RRULE gerekmez)
  weekdays    TEXT   "1,3,5" (weekly için; 1=Pazartesi)
  day_of_month INTEGER (monthly için)
  time        TEXT   "14:00" (opsiyonel)
  start_date, end_date (opsiyonel), active INTEGER

fixed_events                          ← ders programı, iş, Deneyap dersleri
  id, title, area_id,
  weekday     INTEGER  1–7
  start_time  TEXT     "09:00"
  end_time    TEXT     "12:00"
  valid_from  DATE     dönem başı (opsiyonel)
  valid_to    DATE     dönem sonu (opsiyonel)
  counts_against_capacity INTEGER DEFAULT 1

day_capacity                          ← gün bazında kapasite
  weekday     INTEGER PRIMARY KEY 1–7
  minutes     INTEGER

capacity_overrides                    ← tek bir güne özel kapasite ("bugün 2 saatim var")
  date        DATE PRIMARY KEY
  minutes     INTEGER

daily_rituals
  date            DATE PRIMARY KEY
  morning_done_at DATETIME
  shutdown_done_at DATETIME
  note            TEXT    (gün kapanışında tek satırlık not)

backups (sadece kayıt amaçlı)
  id, created_at, path, size_bytes
```

Varsayılan `day_capacity` değerleri (seed): Pazartesi–Cuma **300 dk**, Cumartesi **360 dk**, Pazar **180 dk**.

**Kabul:** Migration temiz bir veritabanında ve mevcut bir veritabanında hatasız çalışıyor, eski veriler kaybolmuyor.

---

## 1. 🔴 V1 eksikleri (ana fazların içinde yapılacak)

### 1.1 Tekrarlayan görevler → **Faz 2**

Örnek: her salı Deneyap dersi hazırlığı, her pazartesi haftalık rapor.

- [ ] Görev düzenleyicide "Tekrarla" seçeneği: **Her gün · Hafta içi · Haftanın günleri (seçimli) · Her ay (gün)**
- [ ] Tekrar kuralından görev örneği, **sadece bugün ve yarın için** üretilir (uygulama açılışında ve gece yarısı). İleriye dönük yüzlerce görev oluşturulmaz.
- [ ] Bir örneği tamamlamak veya silmek kuralı etkilemez. "Bu ve sonrakileri durdur" seçeneği kuralı pasif yapar.
- [ ] Tekrarlayan bir örnek ertelenirse sadece o örnek kayar, sonraki örnek normal tarihinde gelir.
- [ ] Quick Add desteği: `her salı 19:00 Deneyap hazırlık 30 dk`, `her gün mail kontrol 10 dk`, `hafta içi 09:00 standup 15 dk`
- [ ] Görev satırında küçük bir tekrar ikonu (lucide `Repeat`), metadata renginde.

**Kabul:** "Her salı" kuralı oluşturulunca salı günü görev kendiliğinden Bugün listesine geliyor. Tamamlanınca sonraki salı yeniden geliyor.

### 1.2 Sabit etkinlikler / ders programı → **Faz 5**

Kullanıcı üniversite öğrencisi olduğu için haftalık ders programı kapasiteyi doğrudan belirler.

- [ ] Ayarlar → **Haftalık program**: haftalık tekrar eden meşgul bloklar (ders, iş, Deneyap dersi). Gün, başlangıç ve bitiş saati, alan ve dönem tarihleri girilir.
- [ ] Planlayıcı'da bu bloklar **taranmış / soluk** görünür. Görev bu blokların üstüne sürüklenemez, çakışma olursa uyarı verilir.
- [ ] Ana ekranda, şu an sabit bir etkinliğin içindeysen ŞİMDİ kartında şu görünür: "Şu an: Veri Yapıları dersi · 11:00'de bitiyor". Ders bitince bir sonraki görev önerilir.
- [ ] Dönem bitince (`valid_to`) bloklar otomatik olarak devre dışı kalır.

**Kabul:** Pazartesi 09:00–12:00 ders eklenince Pazartesi'nin kullanılabilir kapasitesi 3 saat düşüyor ve Planlayıcı'da bu saatler dolu görünüyor.

### 1.3 Gün bazında kapasite → **Faz 3 / Faz 5**

Tek bir "5 saat" ayarı yerine:

- [ ] Ayarlar'da 7 satırlık tablo olur: her gün için kullanılabilir süre.
- [ ] **Günün gerçek kapasitesi** şöyle hesaplanır:
  ```
  kapasite = (capacity_overrides[bugün] ?? day_capacity[haftanın günü])
           − bugünkü fixed_events süresi (counts_against_capacity = 1 olanlar)
           − (şu an gün içindeysek) zaten geçmiş zaman değil; sadece kalan plan kıyaslanır
  ```
  Bu hesap `src/renderer/lib/capacity.ts` içinde saf bir fonksiyon olarak yazılır ve test edilir.
- [ ] Kapasite çubuğunun yanında "Bugün" için tek tıkla değiştirme seçeneği: "Bugün sadece 2 saatim var" (`capacity_overrides`).
- [ ] Ana ekranda kalan zaman satırı: **"Günün bitmesine 3s 20dk · planında 4s var"**. Gün bitiş saati Ayarlar'dan alınır (varsayılan 22:00).

**Kabul:** Cumartesi ile Pazartesi'nin kapasiteleri farklı gösteriliyor. Ders eklenince kapasite düşüyor. "Fazla planladın" uyarısı bu gerçek kapasiteye göre çıkıyor.

### 1.4 Sabah planlama ritüeli ve gün kapanışı → **Faz 5**

Sunsama'nın en güçlü özelliği. Bizde **kısa ve atlanabilir** olur: en fazla 2 dakika sürer.

**Sabah planlama** (o gün ilk açılışta, `morning_done_at` boşsa küçük bir davet olarak gösterilir, zorla açılmaz):
```
Günaydın. Bugünü planlayalım mı?            [ Planla ]  [ Şimdi değil ]

1/3  Dünden kalanlar      → her biri için: Bugün · Yarın · Inbox · Sil
2/3  Inbox (varsa)        → hızlı triage, en fazla 5 tanesi gösterilir
3/3  Bugünün 3'ü          → en önemli 3 görevi seç
     Kapasite özeti        → aşım varsa [ Günü dengele ]
```

**Gün kapanışı** (gün bitiş saatinden 30 dk önce bildirimle veya komut paletinden "Günü kapat" ile açılır):
```
Bugün
✓ 4 görev tamamlandı · 3s 52dk odak
  Tahmin 3s 10dk → Gerçek 3s 52dk (+42 dk)

Kalanlar
○ GitHub README       → Yarın · Bu hafta · Inbox
○ TÜBİTAK grafikleri  → (3. erteleme) Neden? ...   ← erteleme nedeni burada sorulur

Yarın için tek satır not (opsiyonel)
[ ........................................ ]

[ Günü kapat ]
```

- [ ] Gün kapatılınca sayaç çalışıyorsa durdurulur ve tray "Gün kapandı" durumuna geçer.
- [ ] Ertesi sabah, bir önceki günün notu ŞİMDİ kartının üstünde küçük bir satır olarak gösterilir.
- [ ] Ritüeller Ayarlar'dan kapatılabilir.
- [ ] Ton kuralı geçerlidir: "Bugün 2 görev kaldı" yazılır, "2 görevi bitiremedin" yazılmaz.

**Kabul:** Sabah akışı 3 adımda, gün kapanışı tek ekranda tamamlanıyor. Kalan görevler kullanıcının seçtiği yere taşınıyor ve **Geri al** toast'ı gösteriliyor.

### 1.5 Otomatik yedek → **Faz 7**

- [ ] Uygulama açılışında, son yedek 24 saatten eskiyse `userData/backups/control_center-YYYY-MM-DD.db` oluşturulur (`better-sqlite3`'ün `db.backup()` fonksiyonu ile, uygulama açıkken güvenli şekilde).
- [ ] Son **7 günlük** yedek saklanır, daha eskiler silinir.
- [ ] Ayarlar → Veri: son yedek tarihi, **[Şimdi yedekle]**, **[Yedek klasörünü aç]**, **[Yedekten geri yükle]** (`AlertDialog` ile onay alınır, geri yüklemeden önce mevcut veritabanının da yedeği alınır).

**Kabul:** Saat 24 saat ileri alınıp uygulama açılınca yeni bir yedek dosyası oluşuyor. 8. yedekte en eski yedek siliniyor.

### 1.6 Hızlı arama → **Faz 7**

- [ ] SQLite **FTS5** sanal tablosu: görev başlığı, notlar, ilk adım. Trigger'larla `tasks` tablosuyla senkron tutulur.
- [ ] `/` tuşu ve komut paleti (`Ctrl+K`) bu aramayı kullanır. Türkçe karakterler için `unicode61 remove_diacritics 2` tokenizer kullanılır. Böylece "tubitak" yazınca "TÜBİTAK" da bulunur.
- [ ] Tamamlanmış ve arşivlenmiş görevler de bulunur ama altta, soluk renkte gösterilir.

**Kabul:** 1000 görevlik test verisinde arama sonuçları 50 ms altında geliyor. "tubitak" araması "TÜBİTAK" geçen görevleri buluyor.

---

## 2. 🟢 V1.5 — Farkı yaratan özellikler (Faz 7'den sonra)

### 2.1 Çalışan "İlk adım"

Projenin ertelemeyi azaltma fikrinin en güçlü uygulaması.

- [ ] İlk adım alanına bir hedef bağlanabilir: **dosya** (dosya seçici), **klasör** veya **URL**.
- [ ] **[Başla]**'ya basınca: önce hedef açılır (`shell.openPath` / `shell.openExternal`), sonra zamanlayıcı başlar.
- [ ] Güvenlik: URL'lerde sadece `http`, `https` ve `mailto` kabul edilir. Dosya yolu açılmadan önce var olup olmadığı kontrol edilir. Çalıştırılabilir dosyalar (`.exe`, `.bat`, `.cmd`, `.ps1`, `.lnk`) **açılmaz**, uyarı verilir.
- [ ] Hedef bulunamazsa: "Dosya bulunamadı. Yeniden seç?" yazar, zamanlayıcı yine de başlatılabilir.
- [ ] Görev satırında ve ŞİMDİ kartında küçük bir ikon (dosya / klasör / link) gösterilir.
- [ ] Quick Add: Quick Add penceresine dosya sürüklenip bırakılırsa ilk adım hedefi o dosya olur.

**Kabul:** Hedefi `rapor.docx` olan görevde [Başla]'ya basınca Word açılıyor ve sayaç başlıyor.

### 2.2 Kişisel tahmin çarpanı (basit hâli)

V2'deki "seni tanıyan profil"in ilk ve basit adımı. Veri zaten V1'de toplanıyor.

- [ ] En az **5 tamamlanmış ve süresi ölçülmüş** görev olduğunda hesaplanır:
  ```
  çarpan = median(actual_min / estimate_min)   (aykırı değerleri azaltmak için ortalama değil, medyan)
  ```
  Alan bazında da hesaplanır (alan başına en az 5 görev varsa).
- [ ] Analiz ekranında tek bir sayı: **"Tahminlerin ortalama 1.4x sürüyor."** Altında alan bazında kısa bir liste.
- [ ] Görev oluştururken, süre girildiğinde ve alan çarpanı ≥ 1.2 ise ince bir öneri satırı gösterilir: "Araştırma görevlerin genelde 1.5x sürüyor. 1s 30dk yapalım mı? **[Evet]**". Zorlamaz, tek tıkla kabul edilir.
- [ ] Hesap `src/renderer/lib/estimation.ts` içinde yazılır ve test edilir.

**Kabul:** 5 görevden sonra çarpan görünüyor. 5'ten az görev varsa "Birkaç görev daha tamamlayınca tahmin alışkanlığını göstereceğim." yazıyor.

### 2.3 Focus içinde hızlı yakalama

- [ ] Focus ekranındayken `Ctrl+Space` (veya Focus'ta sadece `N`), Focus'u kapatmadan küçük bir input açar. Yazılan şey Inbox'a gider, sayaç durmaz.
- [ ] Focus bitince özet ekranında: "Odaklanırken 2 şey yakaladın → Inbox'a bak".

**Kabul:** Focus sırasında 3 şey yakalanınca hepsi Inbox'ta görünüyor ve sayaç hiç durmuyor.

### 2.4 Görsel zamanlayıcı

Zamanı görünür kılmak, zaman algısı zayıf olanlar için en etkili yöntemlerden biri.

- [ ] Focus'ta sayacın etrafında **küçülen bir halka** (SVG): tahmini sürenin ne kadarının kaldığını gösterir. Tahmin aşılınca halka dolu ve amber renkli kalır, yanıp sönmez.
- [ ] Tray ikonu ilerlemeyi gösterir (4 aşamalı ikon: ¼ · ½ · ¾ · dolu).
- [ ] `prefers-reduced-motion` açıksa halka sürekli değil, dakikada bir güncellenir.

### 2.5 Bekleyenler

- [ ] Yeni görev durumu **Bekliyor**: "Kimi/neyi bekliyorum?" (`waiting_for`) ve hatırlatma tarihi (`follow_up_date`, varsayılan +3 gün) girilir.
- [ ] Bekleyen görevler "Şimdi ne?" algoritmasına **girmez** ve kapasiteye sayılmaz.
- [ ] Hatırlatma günü geldiğinde görev Bugün listesine "Takip et: Hocadan cevap geldi mi?" şeklinde düşer.
- [ ] Inbox temizleme ve görev menüsüne "Bekliyor olarak işaretle" seçeneği eklenir (kısayol `W`).
- [ ] Sol menüye yeni bir öğe **eklenmez**. Bekleyenler Bugün ekranının altında katlanabilir bir grup olarak ve komut paletinde gösterilir.

### 2.6 Mola hatırlatıcısı

- [ ] Ayarlar'dan açılır (varsayılan **kapalı**). Süre 25 / 50 / 90 dk seçilir.
- [ ] Süre dolunca sakin bir bildirim: "50 dakikadır odaktasın. Kısa bir mola?" **[5 dk mola] [Devam et]**. Mola süresi sayaçtan düşülür, `sessions` tablosunda ayrı bir oturum olarak saklanır.
- [ ] Pomodoro zorunlu değildir, Focus'u bölmez.

---

## 3. 🔵 V2 / V3

Bu özellikler sadece başlık seviyesinde tanımlıdır. Başlamadan önce kullanıcıyla detay konuşulacak.

| Özellik | Kısa tanım | Not |
|---|---|---|
| **Deadline'dan geriye planlama** | "TÜBİTAK raporu 20 Ekim'de teslim." Alt görevler kapasiteye göre günlere dağıtılarak **önerilir**. | Motion bunu otomatik yapıyor. Bizde her zaman öneri olur, kullanıcı onaylar. |
| **Takvim okuma (ICS / Google Calendar)** | Takvim etkinlikleri `fixed_events` gibi kapasiteden düşülür. **Sadece okuma** yapılır. | İlk adım ICS URL'si. OAuth sonra düşünülür. |
| **GitHub issue içe aktarma** | Seçilen repo'lardan kullanıcıya atanmış issue'lar Inbox'a gelir. | Personal access token yerel ve şifreli saklanır (`safeStorage`). |
| **Telefondan yakalama** | Telefondan Inbox'a hızlı not. | Sunucu olmadan zor. Seçenekler: yerel ağda QR ile eşleşme veya e-posta ile içe aktarma. En son düşünülecek. |

---

## 4. ⛔ Yapılmayacaklar

Rakipler genelde bu noktalarda karmaşıklaşıyor. Bu ürünün farkı sakin ve odaklı kalmak.

- Seri sayacı (streak), rozet, puan, alışkanlık takibi
- Kanban panosu, Gantt şeması
- Ekip, paylaşım, yorum, atama özellikleri
- Her ekranda "AI asistan" paneli, sohbet botu
- Zorunlu hesap, bulut senkronizasyonu (V1–V2)
- Kullanıcıya sormadan görevleri otomatik yeniden planlama

---

## 5. Faz eşlemesi (özet)

| Faz | Eklenenler |
|---|---|
| Faz 2 öncesi (1) | §F Faz 1 düzeltmeleri |
| Faz 2 öncesi (2) | §0 veri modeli migration'ı |
| Faz 2 | §1.1 Tekrarlayan görevler |
| Faz 3 | §1.3 Gün bazında kapasite (hesap + ana ekran satırı) |
| Faz 5 | §1.2 Ders programı · §1.3 Ayarlar tablosu · §1.4 Sabah planlama ve gün kapanışı |
| Faz 6 | §1.1 Quick Add'de "her salı…" ayrıştırması |
| Faz 7 | §1.5 Otomatik yedek · §1.6 FTS5 arama |
| V1.5 | §2.1 – §2.6 |
| V2 / V3 | §3 |

**Birim testleri:** `capacity.ts`, `estimation.ts`, tekrar kuralı üretimi ve Quick Add'in tekrar ifadeleri için Vitest testleri zorunludur.
