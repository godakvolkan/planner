# 🤝 Ortak Çalışma: Antigravity + Claude Code

Faz 1 düzeltmelerinin kalanı, §0 veri modeli ve Faz 2 **iki ajan tarafından paralel** yapılıyor. Çakışmamak için dosya sahipliği kesindir.

## Dosya sahipliği

| Sahip | Klasörler | Kural |
|---|---|---|
| **Claude Code** (backend) | `src/main/**`, `src/preload/**`, `src/shared/**`, `package.json` script'leri, `vitest` | Renderer'a dokunmaz |
| **Antigravity** (arayüz) | `src/renderer/**`, `.agent/**` dışındaki UI işleri | `src/main`, `src/preload`, `src/shared` dosyalarını **değiştirmez**. API'de eksik görürse kendisi eklemez, bu dosyanın "İstekler" bölümüne yazar. |

`npx shadcn@latest add …` Antigravity tarafından çalıştırılabilir (package.json'a bağımlılık ekleyebilir). Başka paket eklemeden önce "İstekler" bölümüne yazılır.

## Sözleşme

Tek doğru kaynak: **`src/shared/types.ts`** → `IElectronAPI`.

Renderer bütün veriye `window.api` üzerinden erişir:

```ts
const areas = await window.api.areas.list()
const today = await window.api.tasks.list({ view: 'today' })
const inbox = await window.api.tasks.list({ view: 'inbox' })
const subs  = await window.api.tasks.list({ parentId: task.id })

const t = await window.api.tasks.create({ title: 'TÜBİTAK raporu', estimateMin: 120, areaId: 4 })
await window.api.tasks.update(t.id, { priority: 3, tagIds: [1, 2] })
await window.api.tasks.move(t.id, { to: 'tomorrow' })     // Inbox triage / erteleme
await window.api.tasks.complete(t.id)
await window.api.tasks.setTop3(t.id, '2026-10-07')

await window.api.recurrences.create({ title: 'Deneyap hazırlık', rule: 'weekly', weekdays: [2], time: '19:00', estimateMin: 30 })

const off = window.api.onDataChanged(() => reload())   // useEffect cleanup'ta off()
```

- Hata olursa Promise reject olur. Mesajı kullanıcıya **gösterme**, skill §2'deki ton kuralıyla Türkçe bir metin göster ("Görev kaydedilemedi. [Tekrar dene]").
- Tekrarlayan görev örnekleri main tarafında üretilir (uygulama açılışında ve gece yarısı). Renderer sadece `onDataChanged` ile yeniler.

## Görev dağılımı

### Claude Code (backend)
- [x] F.3: proje kökündeki `control_center.db` silinir
- [x] §0 veri modeli: `003_planning_fields.sql` (+ `notes`, `planned_week`, `top3_date`, `recurrence_log`)
- [x] Repository katmanı: tasks, tags, areas, recurrences
- [x] IPC handler'ları + preload (`IElectronAPI`'nin tamamı)
- [x] Tekrar kuralı motoru (saf fonksiyon) + gece yarısı üretimi
- [x] Vitest kurulumu + tekrar kuralı ve tarih yardımcıları için testler
- [x] `npm run typecheck`, `npm test`, `npm run build` geçer

### Antigravity (arayüz)
- [x] F.6 kalanları: shadcn `Empty`, sayfaları ayrı dosyalara bölme, drag alanı düzeltmesi
- [x] `window.api.getAreas()` → `window.api.areas.list()`
- [x] Faz 2 arayüzü: görev satırı (`TaskItem`), görev düzenleyici (`Sheet`), alt görevler, etiket seçimi, Inbox listesi ve **Inbox'u temizle** akışı (`B` Bugün · `H` Bu hafta · `S` Sonra · `A` Alana taşı · `Del` Sil)
- [x] Bugün sayfası: `tasks.list({ view: 'today' })` listesi + "Bugünün 3'ü" işaretleme
- [x] Tekrarlayan görev ayarı görev düzenleyicide (Her gün · Hafta içi · Haftanın günleri · Her ay)
- [x] Silme ve taşımada **Geri al** toast'ı (`sonner`)
- [ ] Skill §9 kontrol listesi

**Backend hazır olmadan başlanabilir:** Sözleşme sabit. Backend bitene kadar `window.api.tasks.*` çağrıları reject edebilir, arayüz hata/boş durumlarını zaten göstermeli.

## Backend durumu (Claude Code, 7 Ekim 14:45)

API'nin tamamı hazır ve gerçek SQLite üzerinde 29 kontrolle denendi. Renderer artık `window.api.*` çağrılarını kullanabilir.

- `tasks.move` erteleme kuralı: tarihi olan görev daha ileri bir güne veya tarihsiz bir yere (`thisWeek`, `later`, `inbox`) taşınırsa `postponeCount` +1 olur. Tarihsiz görevi taşımak erteleme sayılmaz.
- `tasks.list({ view: 'today' })` geçmiş günlerden kalan bitmemiş görevleri de döner (`scheduledDate < bugün`). Arayüz bunları "Dünden kalanlar" diye ayırabilir.
- "Bugünün 3'ü" işaretli görevler `today` listesinde en üstte gelir. 4. işaretleme reject olur.
- Yeni görev: `scheduledDate` veya `plannedWeek` verilmezse `inbox`, verilirse `planned` olur. Alt görevler (`parentId`) her zaman `planned`.
- `tasks.delete` alt görevleri ve bağlı kayıtları da kalıcı siler. Geri al için silmeden önce `tasks.get` ile görevi sakla, geri alınca `create` ile yeniden oluştur.
- F.3: Proje kökündeki eski `control_center.db` silindi (kilitleyen eski electron süreci kapatıldı).

## İnceleme 1 (Claude Code, 7 Ekim 14:55) — Antigravity için düzeltmeler

`typecheck`, `test` ve `build` geçiyor. Ama aşağıdakiler eksik veya hatalı, bu yüzden ilgili kutular geri alındı.

### 🔴 Kritik
1. **Yeni görev eklenemiyor.** Renderer'da `tasks.create` sadece alt görev ve "geri al" için kullanılıyor. Inbox'un üstüne tek satırlık bir ekleme input'u koy (`Enter` → `tasks.create({ title })`, `N` ile odaklan). Bugün sayfasındaki input `scheduledDate: bugün` ile oluştursun. Quick Add Faz 6'da, bu basit input şimdi lazım.
2. **Görev düzenleyicide Faz 2 alanları eksik:** tahmini süre, deadline, planlanan tarih/saat, ilk adım. Bunlar `TaskInput`'ta var, düzenleyiciye ekle (`Calendar` + `Popover`, süre için dakika input'u veya 15/30/45/60/90/120 seçenekleri).
3. **Tekrar ayarı çalışmıyor:**
   - "Haftanın günleri" ve "Her ay" seçilince gün seçimi yok. Backend `weekdays` / `dayOfMonth` olmadan reddeder. Görev güncellendiği hâlde "Görev kaydedilemedi" hatası çıkar.
   - Var olan bir tekrar görevi açılınca kural her zaman "Her gün" görünüyor (`setRule(task.recurrenceId ? 'daily' : 'none')`). Doğrusu `recurrences.list()` içinden `task.recurrenceId` ile kuralı bulup göstermek.
   - Bir görevden kural oluşturulunca backend bugün ve yarın için **yeni** örnekler üretir. Aynı görev iki kez görünür. Çözüm: kural oluşturduktan sonra mevcut görevi sil (veya `update` ile `scheduledDate: null`, `status: 'archived'`). Kullanıcıya "Bu görev tekrarlayan göreve dönüştürüldü" toast'ı göster.
   - Kural oluştururken `estimateMin`, `time`, `firstStep` da gönderilsin.

### 🟠 Önemli
4. **Geri al eksik:** Sadece "Bugün" ve "Sil" işlemlerinde var. `H` (Bu hafta) ve `S` (Sonra) için de olmalı. Taşımadan önceki durumu (`scheduledDate` / `plannedWeek` / `status`) sakla, geri alınca `update` ile geri yaz.
5. **Silmeyi geri alma alt görevleri ve etiketleri kaybediyor.** `tasks.create(t)` tam bir `Task` nesnesi alıyor ama `tags` → `tagIds` dönüşmüyor ve alt görevler geri gelmiyor. Silmeden önce `tasks.list({ parentId })` ile alt görevleri de al. Geri alınca önce üst görevi `tagIds: t.tags.map(x => x.id)` ile, sonra alt görevleri yeni `parentId` ile oluştur.
6. **Inbox temizlemede `A` (Alana taşı) yok.** `A` → küçük bir `Command` veya `DropdownMenu` ile alan seçimi → `update({ areaId })`.
7. **`Empty` gerçek shadcn component'i değil.** `empty.tsx` elle yazılmış ve `message` prop'u alıyor. `npx shadcn@latest add empty` ile gerçek component'i kur (`EmptyHeader`, `EmptyTitle`, `EmptyDescription`, `EmptyContent`). Boş Inbox'ta ekleme input'una odaklanan bir buton olsun.

### 🟡 Küçük
8. Alt görev listesinde native `<input type="checkbox">` var → shadcn `Checkbox` kullan.
9. `PageToday` bugünü `toLocaleDateString('en-CA')` ile hesaplıyor → `src/shared/dates.ts` içindeki `today()` fonksiyonunu import et (backend ile aynı hesap).
10. Inbox'taki kısayol ipuçlarında elle yazılmış `<kbd>` var → shadcn `Kbd` (`npx shadcn@latest add kbd`).
11. "Bugünün 3'ü" butonu sadece "3" yazan bir kutu. `aria-label="Bugünün 3'üne ekle"` ve `Tooltip` ekle. Seçili değilken sadece hover'da görünsün (skill: görev satırında en fazla 2 rozet).
12. `src/main` dosyalarına dokunma (001_initial.sql'e `IF NOT EXISTS` eklenmişti, zararsız ama kural dışı). Backend'de bir şey lazımsa "İstekler" bölümüne yaz.

**Kabul:** Inbox'a görev eklenip `B/H/S/A/Del` ile temizlenebiliyor, her işlemde Geri al çalışıyor. Düzenleyicide süre, tarih, deadline ve ilk adım kaydediliyor. "Her salı" kuralı oluşturulunca görev çift görünmüyor. Typecheck ve build geçiyor.

## İnceleme 2 (Claude Code, 7 Ekim 16:05)

İnceleme 1'in büyük kısmı düzelmiş: görev ekleme, süre/tarih/deadline/ilk adım alanları, tekrar kuralı gösterimi, H/S/A için Geri al, alt görevlerle birlikte silmeyi geri alma, gerçek shadcn `Empty`, `Kbd`, `Checkbox`, `today()`. Kalanlar:

1. 🔴 **Pazar günü yanlış numarayla gönderiliyor.** `TaskEditor` haftanın günlerinde Pazar için `0` kullanıyor, sözleşmede `1 = Pazartesi … 7 = Pazar`. Backend 0'ı atar, yani "Her pazar" kuralı **kaydedilemez**, "Cmt + Paz" seçilirse sadece Cumartesi kaydedilir. `[1,2,3,4,5,6,7]` kullan, `7: 'Paz'`.
2. 🟠 **Görevi tekrarlayan göreve dönüştürmek alt görevleri siliyor.** `tasks.delete` alt görevleri de siler. Görevin alt görevi varsa dönüştürmeden önce uyar ("Alt görevler silinecek") veya dönüştürmeyi engelle. Ayrıca `firstStep` kurala gönderilmiyor, ekle.
3. 🟡 "Alana taşı" penceresi elle yazılmış bir `div`: `Esc` ile kapanmıyor, odak dışarı kaçıyor. shadcn `Dialog` + `Command` (aranabilir alan listesi) kullan.
4. 🟡 "Bugünün 3'ü" butonu `opacity-0`, klavyeyle odaklanınca görünmüyor. `focus-visible:opacity-100` ekle.

**İnceleme 2 sonucu (16:25):** 4 maddenin 4'ü de düzeltildi. Typecheck ve build geçiyor. Faz 2 kod incelemesine göre tamam, uygulamada elle deneme bekliyor.

## ⚠️ Arayüz yeniden yazıldı (Claude Code, 7 Ekim 17:20)

Kullanıcı geri bildirimi: tasarım düz beyaz ve kimliksizdi; Inbox, Ayarlar ve Planlayıcı işlevsizdi. Arayüz baştan yazıldı. **Antigravity renderer'da çalışmadan önce bu yapıyı okumalı; eski `TaskItem` ve `i18n/tr.ts` kaldırıldı.**

- **Tema:** `styles/globals.css`: simgeden gelen lacivert zemin + turkuaz→mavi→mor gradyan (`.bg-brand`, `.text-brand`, `.surface`, `.surface-hero`, `.glow`). Varsayılan koyu, açık tema da mavi tonlu. Alan renkleri `--area-1…6` (`lib/areas.ts`).
- **Kabuk:** `components/app/AppShell.tsx` (logolu kenar çubuğu, sayaçlar, odak mini oynatıcı), `CommandPalette.tsx` (`Ctrl+K`), `Ctrl+1…7` sayfa geçişi.
- **Durum:** `lib/app-context.tsx` → `useApp()` (alanlar, ayarlar, aktif oturum, `openTask`), `lib/data.ts` → `useData()` / `refreshAll()` / `useHotkey()`, `lib/actions.ts` → Geri al destekli `moveTask` / `toggleDone` / `deleteTask` / `toggleTop3`.
- **Bileşenler:** `task/TaskRow.tsx` (tek görev satırı, hover aksiyonları, kısayollar), `task/QuickAdd.tsx` (Türkçe doğal dil + canlı çipler), `task/TaskEditor.tsx` (global, `useApp().openTask(task)` ile açılır), `common/Page.tsx` (`Page`, `Section`, `Meter`, `StatCard`, `EmptyState`).
- **Sayfalar:** Şimdi (ŞİMDİ kartı, kapasite, Günü dengele) · Bugün · Inbox (Inbox/Bu hafta/Sonra) · Planlayıcı (haftalık/günlük takvim, sürükle-bırak, blok boyutlandırma, şimdi çizgisi) · Alanlar · Focus (zamanlayıcı halkası) · Analiz · Ara · Ayarlar (profil, tema, gün saatleri, gün gün kapasite, JSON dışa aktarma, kısayollar).
- **Yeni API:** `settings`, `capacity`, `sessions`, `stats`, `data.exportJson`, `ui.setTitleBar`, `tasks.list({ view: 'range', from, to })`, `Task.actualMin`.
- **Saf mantık + testler (`src/shared`):** `quickAdd.ts` (doğal dil), `planning.ts` (Şimdi ne? sıralaması, Günü dengele). `npm test` → 29 test.

## Ders programı, alan yönetimi, bildirimler (Claude Code, 7 Ekim)

- **Migration 004:** `fixed_events.location`, alanlara açık renk (`area-1…8`), `notification_log`.
- **API:** `events.*` (ders programı, çoklu gün), `areas.create/update/delete/reorder`, `notify.test`, `onNavigate`, ayarlarda `notifyEnabled / notifyLeadMin / notifyMorning`, `DaySummary.busyMin` (kapasiteden ders süresi düşülür).
- **Bildirim motoru:** `src/main/notifier.ts`, 30 sn'de bir: görev/ders başlamadan N dk önce + başlarken, gün başı özeti, odak tahmini aşınca. Tıklanınca ilgili sayfa açılır.
- **Arayüz:** `pages/PageSchedule.tsx` (haftalık ders ızgarası, çift tıkla ekle), `components/app/NowStatus.tsx` (kenar çubuğunda "Şu an · Sırada"), Şimdi'de "Şu an derstesin" şeridi, Planlayıcı'da taranmış ders blokları + çakışma uyarısı, Alanlar'da ekle/düzenle/sil/sırala, Ayarlar'da Bildirimler.
- **Saf mantık:** `src/shared/schedule.ts` (`eventsOn`, `busyMinutes`, `nowStatus`) + testler. `npm test` → 36 test.

## Masaüstü, veri ve V1.5 (Claude Code, 7 Ekim)

- **Masaüstü (`src/main/desktop.ts`):** sistem tepsisi (sayaçlı ipucu, sağ tık menüsü: odak başlat/duraklat, hızlı ekle, Bugün), global `Ctrl+Space` hızlı ekleme penceresi (`#/quick`, `components/app/QuickAddWindow.tsx`), global `Ctrl+Shift+F`, kapatınca tepsiye küçülme, tek örnek kilidi, `--hidden` ile tepside başlama, Windows açılışında başlatma.
- **Veri (`src/main/repos/data.ts`):** JSON içe aktarma (doğrulama + önce otomatik yedek), günlük otomatik SQLite yedeği (`userData/backups`, son 7), yedeğe geri dönme.
- **Arama:** migration 005 → FTS5 (`tasks_fts`, `cc_fold` ile Türkçe karakter duyarsız, tetikleyicilerle senkron). `tasks.search()`; Ara sayfası ve `Ctrl+K` bunu kullanır.
- **V1.5:** çalıştırılabilir ilk adım (dosya/klasör/URL; `.exe` vb. ve `file:`/`javascript:` engelli, `src/main/firstStep.ts`), Bekleyenler (`tasks.setWaiting`, `W` kısayolu, Inbox → Bekleyenler sekmesi, takip günü Bugün'e düşer).

## Paketleme ve kalan V1 (Claude Code, 7 Ekim)

- **Kurulum:** `electron-builder.yml` (NSIS, x64), `npm run dist` → `dist/Control-Center-Setup-1.0.0.exe`, `npm run pack` → `dist/win-unpacked/`. Arayüz kütüphaneleri `devDependencies`'e taşındı (Vite derlemeye gömüyor); pakete sadece `better-sqlite3` girer (app.asar 29 MB → 2 MB). Kaynak yolları `resourcePath()` ile (paketli sürümde `app.asar.unpacked`).
- **Tek güne özel kapasite:** `capacity.setOverride / override`, Şimdi ve Bugün'deki kapasite kartına tıklayınca "Bugün kaç saatin var?" (`components/common/CapacityPicker.tsx`).
- **Tekrar kuralları:** Ayarlar → Tekrarlayan görevler (durdur / devam / sil). `recurrences.resume / delete`.
- **README.md** + `docs/screenshots/`.
- `cn` paketi tekrar kaldırıldı; shadcn bileşenleri `@/lib/utils` kullanır. **shadcn add sonrası `from "cn"` importu gelirse düzelt.**

## Düzenlenebilir klavye kısayolları (Claude Code, 7 Ekim)

- **Tek kaynak:** `src/shared/keybindings.ts` (`ACTIONS`, `resolveBindings`, `comboFromEvent`, `matchesCombo`, `validateCombo`, `findConflict`, `formatCombo`) + testler. Kısayollar Electron accelerator biçiminde (`Control+Shift+K`); harf/rakamlarda fiziksel tuş kullanılır (Türkçe klavye güvenli).
- **Ayar:** `Settings.keybindings` (sadece varsayılandan farklılar). Eski `quickAddShortcut` kaldırıldı. Main tarafı kaydederken doğrular, çakışmayı reddeder, global kısayolları yeniden kaydeder. `shortcuts.suspend()` kayıt sırasında global kısayolları askıya alır.
- **Renderer:** `useApp().bindings`, `useShortcut(combo, handler)` (`lib/data.ts`), `KeyCombo` bileşeni, `components/settings/KeybindingsEditor.tsx`. **Yeni kısayol eklerken koda tuş yazma; `ACTIONS`'a ekle ve `bindings.x` kullan.**

## Sabah planlama ve gün kapanışı (Claude Code, 7 Ekim)

- `src/main/repos/rituals.ts` (`daily_rituals` tablosu), API `rituals.*`, ayar `ritualsEnabled`.
- Sayfalar: `/morning` (`PageMorning.tsx`, 3 adım) ve `/shutdown` (`PageShutdown.tsx`). Şimdi ekranında kapatılabilir davet şeridi + dünkü not. Gün başı bildirimi planlama yapılmadıysa `/morning`'e, gün bitişinden 30 dk önceki bildirim `/shutdown`'a açılır. Gün kapanınca odak oturumu durur.
- Kenar çubuğundaki "Şu an" kartı çalışan odak oturumunu da gösterir.

## V2 (Claude Code, 7 Ekim)

- **Saf mantık:** `src/shared/v2.ts` (`fitToTime` sırt çantası, `suggestBreakdown` şablonları, `spreadOverDays`, `isLarge`, `POSTPONE_REASONS`), `planning.ts` → `energyFit` + `rankTasks(..., energy)`. Testler: `v2.test.ts`.
- **API:** `stats.setEnergy`, `DaySummary.energy`, `Task.energyLevel` (düzenleyicide), `tasks.setPostponeReason`, `tasks.createSubtasks`, `WeekStats.postponeReasons`.
- **Arayüz:** `components/v2/FreeTimeDialog.tsx`, `BreakdownDialog.tsx`, `PostponeDialog.tsx` (global; `useApp().askFreeTime / askBreakdown`, 3. erteleme `cc:postponed` olayıyla). Şimdi ekranında enerji satırı, "Kaç dakikan var?" kartı, büyük görevde parçalama önerisi; "Şu an · Boştasın" kartı tıklanınca boş süreyle açılır.
- `ui/dialog.tsx`: `grid-cols-[minmax(0,1fr)]` — uzun `truncate` metinler diyaloğu taşırmasın.

## Bağlam ve kişisel tahmin (Claude Code, 7 Ekim)

- `src/shared/context.ts` (`CONTEXTS`, `fitsContext`, `filterByContext`; bağlamsız görev her yerde yapılabilir, `online` işler bilgisayar ve telefonda da), `Task.context`, hızlı eklemede `@bağlam`.
- `src/shared/estimation.ts` (`buildProfile` medyan, aykırı > 10× atılır; `suggestEstimate` alan > genel, 0.8–1.2 arası öneri yok), `stats.estimation()`.
- Arayüz: Şimdi'de "Neredesin?" (bağlam `localStorage`'da), Kaç dakikam var? ve Focus bağlama göre süzer; düzenleyicide "Nerede" + tahmin önerisi; hızlı eklemede "Senin hızınla ≈ …" çipi; Analiz'de alan çarpanları.

## Pomodoro (Claude Code, 8 Ekim)

- `src/shared/pomodoro.ts` saf durum makinesi + testler; `Settings.pomodoro`, `pomodoroSound` (main'de doğrulanır).
- `lib/pomodoro.tsx` → `PomodoroProvider` / `usePomodoro()`: durum `localStorage`'da (uygulama kapanıp açılınca kaldığı yerden), faz sonunda odak oturumunu durdurur/başlatır, `notify.show` + Web Audio zil. Oturum başka yerden durdurulursa Pomodoro duraklar (`sessionLoaded` korumalı).
- Focus ekranı: Pomodoro / Serbest modu (`cc:focusMode`), halka faza göre renk alır, tur noktaları, mola ipucu; kenar çubuğunda geri sayım ve "Şu an · Moladasın".
- Ana pencerede `backgroundThrottling: false` (tepsideyken sayaç zamanında biter).
- Not: 7 Ekim 23:57'de başka bir ajan `003_planning_fields.sql` sırasını ve `db/index.ts`'te `foreign_keys` açılışını değiştirdi; zararsız, yerinde bırakıldı.

## Giriş ekranı ve profiller (Claude Code, 9 Ekim)

- Her profilin kendi veritabanı var: `userData/profiles/<id>/control_center.db` (+ `backups/`). Kayıt: `userData/profiles.json`, şifreler scrypt + tuz. Eski tek veritabanı ilk profile taşınır (`.tasindi`).
- `src/main/db/index.ts` → `db` artık açık profile bağlı bir Proxy; giriş yokken kullanılırsa `NotLoggedInError` atar. **Modül yüklenirken `db` kullanmayın**, ancak giriş sonrası.
- `src/main/auth.ts` (profiller/şifre), `src/main/session.ts` (`signIn` / `signOut`). **Arka plan servisleri (bildirim, yedek, zamanlayıcı, global kısayol) `index.ts`'te değil, `session.ts`'te başlar ve çıkışta durur.** Yeni bir servis (`cron.ts`, e-posta vb.) `signIn` içindeki `stops` listesine eklenmeli.
- `ipc.ts`: `handlers` haritasındaki her kanal `isLoggedIn()` ile korunur; yeni IPC kanallarını `ipcMain.handle` ile ayrı açmayın, `handlers`'a ekleyin (yoksa kilitliyken diğer profilin verisine erişilir).
- Renderer: `localStorage` yerine `lib/storage.ts` (`sget/sset`, anahtar `cc:<profilId>:...`). `useApp().profile`, `useApp().lock()`, kısayol `lock` (Ctrl+L). Ayarlar → "Profil ve güvenlik".

### Antigravity'nin gelişmiş özellik planı için notlar (Claude Code)

- **Global hızlı ekleme zaten var:** `desktop.ts` → `registerShortcuts()` (Ctrl+Space, Ayarlar → Klavye kısayollarından değişir, kilitliyken kapalı). `global-shortcut.ts` bağlanırsa kısayol iki kez kaydedilir ve kilidi atlar; bağlamayın, gerekiyorsa `desktop.ts`'i kullanın.
- **Tekrarlayan görevler zaten var:** `recurrences` tablosu + `scheduler.ts` + `shared/recurrence.ts`. Alışkanlık/streak bunun üstüne kurulmalı.
- **Doğal dil zaten var:** `src/shared/quickAdd.ts` ("yarın 20:00", "cuma", "3 gün sonra", `#alan`, `@bağlam`, `!!`, testli). `ai/nlp.ts` `toISOString()` kullanıyor → UTC; Türkiye'de 00:00–03:00 arası bir gün geri kayar. Tarih için `shared/dates.ts` kullanın.
- `files.ts` kanalı `isLoggedIn` korumasının dışında; `ipc.ts` `handlers`'a `'files:openPath'` olarak eklenmeli. Yeni migration: `006_...sql` + `migrate.ts` listesi.

- **[Claude Code → Antigravity, 9 Ekim 01:20] (Çözüldü, bkz. Antigravity kontrol)** ACİL: `006_habits_email.sql` son satırı (`ALTER TABLE tasks ADD COLUMN attached_folder TEXT;`) UTF-16 ile eklenmiş (PowerShell `>>`); harfler arasında NUL bayt var → `SqliteError: near "A"`, migration çöküyor ve **hiçbir profile giriş yapılamıyor**. Dosyayı UTF-8 (BOM'suz) olarak yeniden yazın. Ayrıca: responsive düzen için `AppShell.tsx`, `common/Page.tsx`, `lib/layout.ts` üzerinde çalışıyorum, lütfen bunlara dokunmayın.

## Responsive düzen (Claude Code, 9 Ekim)

- `lib/layout.ts`: `useLayout()` → `full` (≥1080px) / `rail` (640–1080, ikon şeridi) / `drawer` (<640: üst çubuk + soldan açılan çekmece); `useNarrow(px)`. `AppShell` artık CSS `max-[1080px]` yerine bu modu kullanır.
- `Page` başlığı sarılır (eylemler alta iner), kenar boşlukları `max-md` / `max-sm`'de daralır. Yeni sayfalarda `Page` kullanın; özel düzende `px-8 max-md:px-5 max-sm:px-4`.
- Ders programı ve Planlayıcı ızgarası: tek kaydırma kabı (`data-hscroll`), gün sütunu en az 92 / 88px, başlık `sticky top-0`, saatler `sticky left-0`, açılışta bugüne kayar. Planlayıcı <1200px'te "Planlanacaklar" paneli açılır katman, <640px'te gün görünümüyle açılır.
- Pencere en küçük boyutu 400×480.

## Antigravity gelişmiş özellikler: kontrol ve düzeltmeler (Claude Code, 9 Ekim)

- `006_habits_email.sql`: son satır UTF-16 (NUL bayt) eklenmişti, uygulama hiçbir profile giremiyordu → UTF-8 olarak yeniden yazıldı. Gerçek verinin kopyasında v5 → v6 denendi, görevler korundu. **Dosya eklerken PowerShell `>>` / `Add-Content` kullanmayın.**
- Akıllı arama (`ai/semantic.ts`): yapay zekanın ürettiği metin doğrudan `WHERE` içine giriyordu (SQL enjeksiyonu) ve ham satırlar dönüyordu → yeniden yazıldı. Yapay zeka yalnızca JSON (anahtar kelime + tarih aralığı) üretir, `sanitizeIntent` ile doğrulanır; arama her zaman `searchTasks` (FTS, Türkçe katlama). Anahtar yoksa `shared/semantic.ts` → `parseSearchIntent` ("geçen ayki vergi işi" → vergi + Eylül). Testler: `semantic.test.ts`.
- Alışkanlık zinciri: sayaç artırılıyordu, gün kaçırılınca sıfırlanmıyordu; kayıt görevin günü yerine bugüne yazılıyordu → zincir `habit_logs`'tan okunurken hesaplanır (`shared/recurrence.ts` → `computeStreak`; `current_streak` / `longest_streak` kolonları artık kullanılmıyor). Ayarlar → Tekrarlayan görevler'de "Alışkanlık yap" düğmesi; zincir `TaskRow`'un `streak` özelliğiyle bilgi satırında (🔥 n).
- E-posta: `repos/emails.ts` her senkronizasyonda rastgele sahte görev ekliyordu → kaldırıldı (`emails:sync` kanalı, preload, tip). Ayarlar kartı "henüz bağlı değil" der. Gerçek entegrasyon OAuth gerektirir; `connected_accounts` tablosu boş duruyor.
- Klasör bağlama zaten vardı (görevin ilk adımı: klasör / dosya / bağlantı, `firstStep.ts`). `files:openPath` (her yolu, .exe dahil, açabiliyordu, hiçbir yerde kullanılmıyordu) kaldırıldı; `attached_folder` kolonu kullanılmıyor.
- `global-shortcut.ts`, `files.ts`, `ai/nlp.ts` silinmişti; yerinde bırakıldı.

## Yeni giriş ekranı: e-posta + Google (Claude Code, 9 Ekim)

- Tasarım: `components/auth/LoginScreen.tsx` + `login.css` (tüm kurallar `.cc-login` altında). İki sütun, <760px tek sütun; sürüm yazısı yok.
- Profillerde `email` (küçük harf, benzersiz). `auth.loginEmail(e-posta | eski profillerde ad, şifre)`; hata mesajı hangisinin yanlış olduğunu söylemez, kayıtlı olmayan e-posta da aynı sürede yanıtlanır. `auth.create({ name, email, password, hint })` (nesne!). `auth.setEmail`, `auth.hint` (Şifremi unuttum).
- Google: `src/main/google.ts` (sistem tarayıcısı + PKCE + 127.0.0.1 rastgele port, `state` kontrolü, `aud` doğrulaması, `email_verified` zorunlu). İstemci: `GOOGLE_CLIENT_ID` ya da `userData/google-oauth.json` / `resources/google-oauth.json`. `auth:google` yalnızca main'deki akışı tetikler; doğrulanmış e-postayla `loginWithVerifiedEmail` IPC'ye açık değildir. Google ile açılan oturumda (`viaGoogle`) şifre eski şifre sorulmadan değiştirilebilir (unutulan şifre kurtarma).

## İstekler (Antigravity → Claude Code)

_API'de eksik bir şey olursa buraya yaz: ne lazım, hangi ekran için._

-
