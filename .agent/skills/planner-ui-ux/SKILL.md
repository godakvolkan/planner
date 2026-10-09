---
name: planner-ui-ux
description: Control Center (Electron + React + TypeScript kişisel planlama uygulaması) için UI/UX ve frontend kuralları. Herhangi bir ekran, React component'i, stil, renk, tipografi, animasyon, kısayol, boş/hata durumu veya arayüz metni yazarken ya da değiştirirken bu skill'i kullan. Tetikleyiciler - ekran tasarla, component yaz, UI, UX, tasarım, stil, Tailwind, tema, dark mode, Today, Focus, Planner, Quick Add, Inbox, Insights.
---

# Planner UI / UX Skill

Sen bu projede kıdemli bir **Desktop Product Designer + Frontend Engineer** gibi davranıyorsun.

Bu uygulama görev listelemek için değil, kullanıcının **"Şimdi ne yapmalıyım?"** kararını kolaylaştırmak için var.

> Daha fazla iş yapmak değil, yapabileceğin işi doğru planlamak.

Kullanıcı uygulamayı açtığında şunu hissetmeli: **"Tamam. Ne yapacağımı biliyorum."**

Kapsam ve fazlar için tek doğru kaynak `ANTIGRAVITY_GOREV.md` dosyasıdır. Bu skill **nasıl görüneceğini ve hissettireceğini** tanımlar, **ne zaman yapılacağını** değil. Bir özellik görev dosyasında V2 ise V1'de arayüzünü yapma.

---

## 1. Her ekrandan önce: 5 soru

Kod yazmadan önce cevapla:

1. Kullanıcı bu ekrana neden geliyor?
2. Buradaki en önemli karar ne?
3. Ana aksiyon hangisi? (Ekranda **tek** birincil buton olur.)
4. Hangi bilgi bu karara katkı sağlamıyor? → Kaldır.
5. Bu ekran klavyeyle baştan sona kullanılabiliyor mu?

Öncelik sırası her zaman: **ŞİMDİ > SONRA > BUGÜN > geri kalan her şey**

---

## 2. Dil ve ton

- **Arayüz metinleri Türkçe**, kod İngilizce. Tüm metinler `src/renderer/src/i18n/tr.ts` içinde toplanır, component'e gömülmez.
- Kişilik: sakin, doğrudan, pratik, **yargılamayan**.
- Emir verme, öner. Suçlama, durumu tarif et.

| Kullanma | Kullan |
|---|---|
| Bunu yap. | Önerilen sonraki adım |
| Geride kaldın. | Planın sıkışıyor. |
| Başarısız oldun. | Planın iddialı. |
| Kötü tahmin | Bu tür işler sende genelde daha uzun sürüyor. |
| SQLITE_CONSTRAINT failed | Görev kaydedilemedi. **[Tekrar dene]** |

- Teknik hata detayı sadece açılır bir "Geliştirici detayı" alanında gösterilir.
- Süre formatı: `45 dk`, `1s 20dk`. Tarih: `Çarşamba · 7 Ekim` (`Intl.DateTimeFormat('tr-TR')`).

---

## 3. Görsel dil: tasarım token'ları

"Modern" kelimesi tek başına bir şey anlatmaz. Aşağıdaki token'lar zorunludur, rastgele değer (`#3b82f6`, `mt-[13px]`) yazılmaz.

### Teknoloji
- **shadcn/ui (CLI v4)** arayüzün temelidir. Component'ler `src/renderer/src/components/ui/` içine kopyalanır, kod bizimdir.
  - Primitive kütüphanesi: **Radix** (proje Radix ile kuruldu, Base UI'ya geçilmeyecek). Başka bir elemanı render etmek için **`asChild`** kullanılır: `<SidebarMenuButton asChild><Link to="/today">…</Link></SidebarMenuButton>`. İnternette Base UI örneği görürsen (`render={…}`), `asChild`'a çevir.
  - Stil `new-york`, `baseColor: "neutral"`, `cssVariables: true`, ikonlar `lucide`.
  - Bir component eklemeden önce `npx shadcn@latest docs <component>` ile güncel API'ye bak, prop tahmin etme. Eklerken `--dry-run` ile neyin değişeceğini kontrol et.
  - Component listesi, prop'lar ve hangi ekranda hangisinin kullanılacağı: **[references/shadcn.md](references/shadcn.md)**
- **Tailwind CSS v4.** Ayrı `tailwind.config` dosyası yok, token'lar CSS'te tanımlanır.
- **lucide-react** ikonları, 16px, `stroke-width: 1.75`. Butondaki ikonlara `data-icon="inline-start"` veya `data-icon="inline-end"` verilir.
- Font **Inter Variable** (`@fontsource-variable/inter`). Uygulama offline çalışacağı için font CDN'den değil, paketten yüklenir. Sayılar ve sayaçlar için `font-variant-numeric: tabular-nums`.

### Renk (shadcn tema değişkenleri, OKLCH)
shadcn'in standart değişken adları kullanılır, değerler bu projeye göre ayarlanır. Tek bir ana renk (`--primary`) vardır. Renk anlam taşır, süs olarak kullanılmaz.

`src/renderer/src/styles/globals.css`:
```css
@import "tailwindcss";
@import "@fontsource-variable/inter";
@custom-variant dark (&:is(.dark *));

:root {
  --radius: 0.625rem;                          /* 10px panel; sm=6px input/buton */
  --background: oklch(0.985 0.003 250);        /* kırık beyaz */
  --foreground: oklch(0.22 0.01 250);
  --card: oklch(1 0 0);
  --card-foreground: var(--foreground);
  --popover: oklch(1 0 0);
  --popover-foreground: var(--foreground);
  --primary: oklch(0.58 0.16 255);             /* tek ana renk */
  --primary-foreground: oklch(0.98 0 0);
  --secondary: oklch(0.96 0.003 250);
  --secondary-foreground: var(--foreground);
  --muted: oklch(0.96 0.003 250);
  --muted-foreground: oklch(0.55 0.01 250);
  --accent: oklch(0.95 0.01 255);              /* hover / seçili satır */
  --accent-foreground: var(--foreground);
  --destructive: oklch(0.6 0.19 25);
  --border: oklch(0.92 0.005 250);
  --input: oklch(0.92 0.005 250);
  --ring: oklch(0.58 0.16 255);
  --sidebar: oklch(0.975 0.003 250);
  --sidebar-foreground: var(--foreground);
  --sidebar-primary: var(--primary);
  --sidebar-primary-foreground: var(--primary-foreground);
  --sidebar-accent: var(--accent);
  --sidebar-accent-foreground: var(--foreground);
  --sidebar-border: var(--border);
  --sidebar-ring: var(--ring);
  /* projeye özel anlam renkleri */
  --priority-high: oklch(0.6 0.19 25);
  --priority-medium: oklch(0.78 0.15 80);
  --success: oklch(0.65 0.15 150);
  --warning: oklch(0.75 0.15 70);
}

.dark {
  --background: oklch(0.18 0.005 250);         /* koyu charcoal */
  --foreground: oklch(0.93 0.005 250);
  --card: oklch(0.21 0.005 250);
  --popover: oklch(0.23 0.005 250);
  --primary: oklch(0.68 0.15 255);
  --primary-foreground: oklch(0.18 0.005 250);
  --secondary: oklch(0.25 0.005 250);
  --muted: oklch(0.25 0.005 250);
  --muted-foreground: oklch(0.65 0.01 250);
  --accent: oklch(0.27 0.02 255);
  --destructive: oklch(0.65 0.19 25);
  --border: oklch(1 0 0 / 9%);
  --input: oklch(1 0 0 / 12%);
  --ring: oklch(0.68 0.15 255);
  --sidebar: oklch(0.16 0.005 250);
  /* card-foreground, popover-foreground, sidebar-* değişkenleri :root'taki var() ile otomatik takip eder */
}

@theme inline {
  --font-sans: "Inter Variable", system-ui, sans-serif;
  /* shadcn init'in ürettiği --color-* eşlemeleri burada kalır; ek olarak: */
  --color-priority-high: var(--priority-high);
  --color-priority-medium: var(--priority-medium);
  --color-success: var(--success);
  --color-warning: var(--warning);
}
```

- Tema `<html>` etiketine `.dark` class'ı eklenerek değişir. Varsayılan sistem temasıdır (`nativeTheme.shouldUseDarkColors`), Ayarlar'dan Açık / Koyu / Sistem seçilir.
- Sadece semantik class'lar kullanılır: `bg-background`, `text-muted-foreground`, `border-border`, `text-priority-high`. `bg-blue-500` gibi ham Tailwind renkleri yasaktır.
- Düşük öncelikli görev renksiz (nötr) olur.
- Alan (area) renkleri sadece küçük bir nokta veya ince çizgi olarak görünür, arka planı doldurmaz.
- Metinde kontrast en az **4.5:1** olmalı. Renk hiçbir zaman tek gösterge olmaz, yanında ikon veya metin de bulunur.

### Boşluk, köşe ve gölge
- Boşluk ölçeği 4px katlarıdır: `4 · 8 · 12 · 16 · 24 · 32 · 48`.
- Köşe yuvarlaklığı: `6px` (input, buton), `10px` (panel, modal). Hap/yuvarlak sadece etiketlerde.
- Gölge sadece üstte açılan katmanlarda (modal, popover, Quick Add) olur. Liste ve kartlarda gölge yok, ince ayırıcı kullanılır.

### Tipografi
| Rol | Boyut / ağırlık |
|---|---|
| Ekran başlığı | 20px / 600 |
| ŞİMDİ görev başlığı | 24px / 600 (ekrandaki en büyük metin) |
| Görev başlığı | 14px / 500 |
| Gövde | 14px / 400 |
| Metadata | 12px / 400, `--color-muted` |
| Bölüm etiketi (ŞİMDİ, SONRA) | 11px / 600, büyük harf, `letter-spacing: 0.06em`, muted |

Örnek görev satırı:
```
TÜBİTAK Sonuç Raporu
1s 20dk · Araştırma · Yüksek
```

### Hareket
- Süre 120–200ms, `ease-out`. Sadece `opacity` ve `transform` animasyonu yapılır.
- Animasyon kullanılan yerler: hover, panel açılış/kapanış, görev tamamlama, Focus'a geçiş.
- Zıplayan efekt, büyük sayfa geçişi ve dekoratif loading kullanılmaz. Yüklemelerde skeleton gösterilir ve sadece 300ms'den uzun sürerse görünür.
- `prefers-reduced-motion` açıksa animasyonlar kapatılır.

### Masaüstü hissi (Electron)
- Özel başlık çubuğu: `titleBarStyle: 'hidden'` + `titleBarOverlay` (Windows pencere butonları korunur). Sürükleme alanı `-webkit-app-region: drag`.
- Windows 11'de ayar ile açılabilen `backgroundMaterial: 'mica'` (varsayılan kapalı).
- Metin seçimi sadece içerik alanlarında açık, arayüz elemanlarında `user-select: none`.
- Sağ tık menüsü özel olur (shadcn `Context Menu`), tarayıcı menüsü görünmez.
- Minimum pencere boyutu **960×600**. Pencere daralınca sırasıyla: ikincil panel kapanır → sol menü sadece ikona iner → metadata azalır. Görev başlığı her zaman okunur kalır.

---

## 4. Navigasyon

Sol menü (sadece ikon ve kısa etiket):

**Şimdi · Bugün · Inbox · Planlayıcı · Alanlar · Focus · Analiz**

Altta: **Ara** · **Ayarlar**

Komut paleti `Ctrl+K` ile açılır (shadcn `CommandDialog`): tüm ekranlar, görev arama ve tüm aksiyonlar burada. Menüye yeni öğe eklemek yerine komut paletine eklemeyi tercih et.

---

## 5. Ekranlar

Ekran ekran ASCII taslaklar ve detaylar [references/screens.md](references/screens.md) dosyasında. Bir ekranı kodlamadan önce o bölümü oku.

Özet kurallar:
- **Şimdi (ana ekran):** Ekrandaki en baskın alan ŞİMDİ kartıdır. Görev başlığı, ilk adım, tahmini süre ve tek bir **[Başla]** butonu içerir. Altında en fazla 3 SONRA görevi ve kapasite çubuğu.
- **Quick Add:** Tek satırlık input. Yazarken ayrıştırılan alanlar (tarih, saat, süre, alan) input'un altında küçük "chip" olarak canlı gösterilir. Başka form alanı yok. `Enter` oluşturur, `Esc` kapatır.
- **Focus:** Görev adı, büyük sayaç, ince ilerleme çubuğu, **[Duraklat] [Bitir]**. Başka hiçbir şey yok. Bitince sonucu tahminle kıyaslar: `Tahmin 1s · Gerçek 1s 23dk · +23 dk`.
- **Kapasite aşımı:** Amber renkli, sakin bir uyarı: "Planın kapasitenin 2s 15dk üzerinde." Yanında **[Günü dengele]** butonu. Bu buton sadece **önerileri gösterir**, kullanıcı onaylamadan hiçbir görev taşınmaz.
- **Analiz:** Boş metrikler (vanity metrics) gösterilmez. Planlanan ve gerçekleşen süre, tahmin doğruluğu, erteleme ve odak süresi gösterilir. Her hafta **tek bir** iyileştirme önerisi verilir.

---

## 6. Klavye (keyboard-first)

| Kısayol | Aksiyon | Kapsam |
|---|---|---|
| `Ctrl+Space` | Quick Add | Global (değiştirilebilir, Windows'ta IME ile çakışabilir) |
| `Ctrl+K` | Komut paleti | Uygulama |
| `Ctrl+Shift+F` | Focus Mode | Global |
| `/` | Ara | Liste ekranları |
| `J` / `K` | Görevler arasında aşağı / yukarı | Liste ekranları |
| `Enter` | Görevi aç | Liste |
| `X` | Tamamla | Liste |
| `F` | Seçili görevle Focus başlat | Liste |
| `E` | Düzenle | Liste |
| `Esc` | Kapat / geri | Her yerde |
| `?` | Kısayol listesini göster | Uygulama |

- Tek tuşlu kısayollar **input, textarea veya contenteditable odaktayken çalışmaz.**
- Tamamlamak için `X` kullan, `Space` değil (Space buton/checkbox odağıyla çakışır).
- Kısayollar keşfedilebilir olmalı: tooltip'te ve komut paletinde görünür.
- Odak halkası her zaman görünür olmalı: `outline: 2px solid var(--color-accent); outline-offset: 2px`.

---

## 7. Component yapısı

```
src/renderer/src/components/
├── ui/          shadcn component'leri (CLI ile eklenir: button, item, empty, kbd, command...)
├── dashboard/   NowCard · NextTasks · DailyCapacity
├── task/        TaskItem · TaskEditor · TaskMeta · TaskQuickActions
├── planner/     Timeline · TimeBlock · CapacityBar
├── focus/       FocusSession
├── quick-add/   QuickAddInput · ParsedChips
└── common/      AppSidebar · CommandPalette · EmptyState · ErrorState · TitleBar
```

- Kendi `Button`, `Modal`, `Input` veya `Tooltip` component'ini yazma, shadcn'inkini kullan. Projeye özel component'ler shadcn component'lerini birleştirerek yapılır (ör. `TaskItem` = `Item` + `Checkbox` + `Badge`).
- `components/ui/` içindeki dosyalar sadece token veya varyant uyarlaması için düzenlenir. İş mantığı buraya girmez.
- Bir component 150 satırı geçiyorsa böl.
- İş mantığı (quick-add parser, "şimdi ne" algoritması, kapasite hesabı) component'te yazılmaz, `src/renderer/src/lib/` içinde saf fonksiyon olarak yazılır ve test edilir.
- Her liste ekranının boş durumu (`EmptyState`) ve hata durumu (`ErrorState`) olmalı.

---

## 8. Yapma

- Todoist, Notion, Linear veya Trello'yu birebir kopyalama. Hazır SaaS dashboard görünümünden kaçın.
- Her şeyi kart içine koyma, dashboard'u grafiklerle doldurma.
- Bir görev satırında 2'den fazla rozet (badge) gösterme.
- Kullanıcıdan istemediği popup'lar açma, gereksiz onboarding ekleme.
- Kullanıcı adına sessizce görev taşıma veya silme.
- Streak, rozet, puan gibi oyunlaştırma ekleme.
- Login ekleme, cloud bağımlılığı ekleme.
- "AI-powered" gibi pazarlama dili kullanma. Akıllı öneri sadece somut bir cümle olabilir: "Benzer görevler ortalama 1s 35dk sürdü. 1s 30dk planlayayım mı?"

---

## 9. Bitti kontrol listesi (her UI değişikliğinden sonra)

- [ ] Ekranda tek bir birincil aksiyon var
- [ ] Sadece token'lar ve semantik class'lar kullanıldı (rastgele hex, px değeri veya `bg-blue-500` yok)
- [ ] shadcn'de karşılığı olan bir component sıfırdan yazılmadı
- [ ] Açık ve koyu temada kontrol edildi
- [ ] Klavyeyle baştan sona kullanılabiliyor, odak halkası görünüyor
- [ ] Boş, yükleniyor ve hata durumları var
- [ ] Tüm metinler Türkçe ve `tr.ts` içinde, ton yargılamayan
- [ ] 960px genişlikte bozulmuyor
- [ ] `prefers-reduced-motion` açıkken animasyon yok
