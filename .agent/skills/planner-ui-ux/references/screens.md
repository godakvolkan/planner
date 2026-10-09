# Ekran Taslakları

Her taslak bir yerleşim fikridir, birebir piksel değildir. Görsel değerler için SKILL.md'deki token'lar kullanılır.
`[V2]` etiketli bölümler V1'de yapılmaz.

---

## Şimdi (ana ekran)

```
Çarşamba · 7 Ekim
İyi akşamlar.

ŞİMDİ
TÜBİTAK Sonuç Raporu                       ← ekrandaki en büyük metin
İlk adım: Sonuç raporu dosyasını aç
1s 20dk · Araştırma

[ Başla ]                                  ← tek birincil buton

SONRA
○ Üniversite ödevi        45 dk
○ Deneyap hazırlığı       30 dk
○ GitHub README           20 dk

BUGÜN · 4 görev · 3s 40dk
████████████░░░░  4s / 5s
```

- Selamlama günün saatine göre değişir (Günaydın / İyi günler / İyi akşamlar). İsim Ayarlar'dan alınır.
- "İlk adım" doluysa başlığın altında gösterilir, boşsa satır hiç görünmez.
- SONRA en fazla 3 satırdır. Daha fazlası için "Bugün" ekranına geçilir.

Boş durum:
```
Bugün için planlanmış bir şey yok.
[ Bir şey planla ]
```

---

## Quick Add (`Ctrl+Space`)

```
┌──────────────────────────────────────────┐
│ ＋ yarın 14:00 TÜBİTAK raporu 2 saat      │
│                                          │
│  📅 Yarın  🕑 14:00  ⏱ 2s  🔬 TÜBİTAK     │  ← canlı ayrıştırılan chip'ler
│                                          │
│                     Enter ile oluştur    │
└──────────────────────────────────────────┘
```

- Çerçevesiz, ekranın ortasında, 560px genişliğinde, gölgeli pencere. Odak kaybedince kapanır.
- Chip'e tıklanınca o değer düzeltilebilir veya silinebilir.
- Tarih veya süre yoksa görev Inbox'a gider ve altta "Inbox'a eklenecek" yazar.

---

## Bugün

- Bugün planlanan görevler, saat sırasına göre listelenir. "Bugünün 3'ü" işaretli görevler en üstte ayrı bir grupta.
- Sağda veya üstte kapasite çubuğu.
- Kapasite aşılırsa:
  ```
  ⚠ Planın kapasitenin 2s 15dk üzerinde.      [ Günü dengele ]
  ```
- "Günü dengele" bir öneri paneli açar:
  ```
  Önerilen değişiklikler
  ☑ GitHub README → Yarın         (düşük öncelik)
  ☑ Deneyap hazırlığı → Perşembe  (deadline uzak)
  ☐ TÜBİTAK raporu                (deadline yakın, korunuyor)

  [ Uygula ]  [ Vazgeç ]
  ```
  Varsayılan olarak hiçbir şey uygulanmaz.

---

## Inbox

```
Inbox · 4

○ React Native kütüphanesine bak
○ Deneyap duyurusunu hazırla
○ GitHub README değiştir
○ Şu makaleyi oku

[ Inbox'u temizle ]
```

Temizleme modu: görevler tek tek gösterilir, kısayollar ekranda görünür:
`B` Bugün · `H` Bu hafta · `S` Sonra · `A` Alana taşı · `Del` Sil

Boş durum: "Inbox temiz. Aklına bir şey gelince `Ctrl+Space`."

---

## Planlayıcı (zaman bloklama)

```
           Çarşamba 7 Ekim
09:00 ┬──────────────────────┐
      │ TÜBİTAK raporu       │   ← blok yüksekliği = tahmini süre
10:30 ┴──────────────────────┘
11:00 ┬──────────────────────┐
      │ Üniversite ödevi     │
12:00 ┴──────────────────────┘
```

- Solda planlanmamış görevler listesi bulunur, sürükle-bırak ile takvime konur (`@dnd-kit`).
- 15 dakikalık aralıklara oturur (snap). Bloğun alt kenarı sürüklenerek süre değiştirilir.
- Şu anki saat ince bir accent renkli çizgiyle gösterilir.
- Çakışan bloklar yan yana daraltılır ve amber renkli bir kenar alır.

---

## Focus (`Ctrl+Shift+F` veya `F`)

```
TÜBİTAK Sonuç Raporu
İlk adım: Sonuç raporu dosyasını aç

        01:23:42                ← tabular-nums, 64px

████████████████░░░░            ← tahmine göre ilerleme

[ Duraklat ]      [ Bitir ]
```

- Sol menü gizlenir. `Esc` ile çıkılır, sayaç arka planda devam eder ve tray'de görünür.
- Tahmin aşılınca ilerleme çubuğu amber renge döner. Hata gibi gösterilmez.
- Bitince:
  ```
  Tahmin   1s
  Gerçek   1s 23dk
  Fark     +23 dk

  [ Tamamlandı ]  [ Devam edeceğim ]
  ```

---

## Görev detayı / düzenleme

- Sağdan açılan panel olur, modal değil. Liste görünür kalır.
- Görünen alanlar: Başlık, Tarih, Tahmini süre (zorunlu alan hissi verilmez). Altında "Daha fazla": Alan, Öncelik, Etiketler, İlk adım, Notlar, Alt görevler.
- Erteleme sayısı ≥ 2 ise küçük ve muted bir satır: "2 kez ertelendi".

---

## Alanlar

- Her alan için: bu haftaki süre, açık görev sayısı ve son aktivite gösterilir. Grafik yok, tek satır özet.
- Alan ≠ Proje. Alan uzun vadeli bir kategoridir (Üniversite). Proje belirli bir sonuçtur (2209 raporu). V1'de proje yerine üst görev + alt görevler kullanılır.

---

## Analiz

```
BU HAFTA
Planlanan      23s
Gerçekleşen    19s 40dk
Tamamlanan     31 görev
Ertelenen      7

Planlanan vs Gerçek (alan bazında)
TÜBİTAK    ██████░░  tahmin 6s · gerçek 8s 10dk
Yazılım    ████████  tahmin 9s · gerçek 9s 05dk

Gelecek hafta için tek öneri
Büyük yazma işlerini daha küçük adımlara böl.
```

Kullanılacak grafik türleri sadece yatay çubuk ve haftalık ısı şeridi. Pasta grafik ve 3D grafik yok.

---

## [V2] Enerji · Bağlam · "Kaç dakikam var?" · Erteleme nedeni · Görev parçalama

V2'de bu özellikler eklendiğinde:
- Enerji seçimi ana ekranda küçük ve ikincil bir satır olur (😴 🙂 🔥). Asla ŞİMDİ kartının önüne geçmez.
- Bağlam filtresi sol üstte tek bir dropdown olur. Bağlam renkleri baskın kullanılmaz.
- "Kaç dakikam var?" komut paletinden veya ana ekrandaki küçük bir butondan açılır.
- Erteleme nedeni sorusu, görev 3. kez ertelendiğinde **bir kez** sorulur ve "Bir daha sorma" seçeneği bulunur.
- Görev parçalama: "Bu görev büyük görünüyor. Parçalayalım mı?" ve düzenlenebilir alt görev listesi.
