# shadcn/ui Başvuru Dosyası

Kaynak: https://ui.shadcn.com/docs (Ekim 2026, CLI v4). Bu dosya bir özettir. Prop'tan emin değilsen tahmin etme, şunu çalıştır:

```bash
npx shadcn@latest docs <component>   # güncel API ve örnekler
npx shadcn@latest info               # kurulu component'ler, CSS değişkenleri, sürüm
```

---

## 1. Kurulum (Electron + electron-vite)

Proje `npm` kullanır.

```bash
# 1) Tailwind v4 (renderer için)
npm i tailwindcss @tailwindcss/vite
npm i -D @types/node

# 2) shadcn — bu proje RADIX ile kuruldu (kurulum tamam, tekrar init etme)
npx shadcn@latest init --base radix
# Sorulursa: style = new-york, baseColor = neutral, cssVariables = yes

# 3) Font
npm i @fontsource-variable/inter
```

### Alias (`@/*` → renderer)
electron-vite'da renderer kaynak kökü `src/renderer/src` olduğu için alias'ın **üç yerde** aynı olması gerekir. Aksi hâlde `shadcn add` dosyaları yanlış yere yazar.

`tsconfig.json` (kök, shadcn CLI bunu okur) ve `tsconfig.web.json`:
```json
{ "compilerOptions": { "baseUrl": ".", "paths": { "@/*": ["./src/renderer/src/*"] } } }
```

`electron.vite.config.ts`:
```ts
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: { /* ... */ },
  preload: { /* ... */ },
  renderer: {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { '@': path.resolve(__dirname, 'src/renderer/src') } }
  }
})
```

### `components.json` (init oluşturur; değerleri bununla karşılaştır)
```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/renderer/src/styles/globals.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks",
    "utils": "@/lib/utils"
  }
}
```

- `rsc: false`: Electron'da Server Components yok.
- `tailwind.config` boş: Tailwind v4 config dosyası kullanmaz.
- `init` sonrası `globals.css` içindeki renk değerlerini SKILL.md'deki tema değerleriyle **değiştir** (değişken adları aynı kalır).

### V1 için toplu ekleme
```bash
npx shadcn@latest add button item empty kbd command dialog sheet popover \
  dropdown-menu context-menu tooltip checkbox input textarea field label \
  select calendar progress badge separator scroll-area sidebar skeleton \
  spinner sonner tabs toggle-group alert alert-dialog resizable
```
Eklemeden önce `--dry-run` ile, mevcut bir dosyayı güncellerken `--diff` ile kontrol et.

---

## 2. Radix kuralları

Bu proje **Radix** primitive'lerini kullanır (birleşik `radix-ui` paketi). shadcn'in yeni belgeleri varsayılan olarak Base UI örneği gösterir. Bunları kopyalarken Radix'e çevir:

| Radix (BU PROJE) | Base UI (belgelerdeki örnekler, kullanma) |
|---|---|
| `<Button asChild><a href="…">…</a></Button>` | `<Button render={<a href="…" />}>…</Button>` |
| `<SidebarMenuButton asChild><Link/></SidebarMenuButton>` | `<SidebarMenuButton render={<Link to="/today" />}>Bugün</SidebarMenuButton>` |

Link görünümlü buton için `buttonVariants({ variant: 'ghost' })` helper'ı kullanılır.

---

## 3. Ekran → component eşlemesi

| Ekran / parça | shadcn component'leri |
|---|---|
| Sol menü | `Sidebar` (`collapsible="icon"`) |
| Komut paleti (`Ctrl+K`) | `CommandDialog` + `CommandShortcut` |
| Görev satırı | `Item` + `Checkbox` + `Badge` (en fazla 2 tane) |
| ŞİMDİ kartı | `Item variant="outline"` veya sade bir `div`. `Card` sadece burada kullanılabilir |
| Kapasite çubuğu | `Progress` |
| Görev detayı | `Sheet side="right"` |
| Görev formu | `Field` + `Input` / `Textarea` / `Select` + `Calendar` (`Popover` içinde) |
| Quick Add | Ayrı bir `BrowserWindow` içinde `Input`. Ayrıştırılan değerler `Badge variant="secondary"` |
| Günü dengele önerileri | `Dialog` + `Checkbox` listesi |
| Silme onayı | `AlertDialog` |
| Kapasite uyarısı | `Alert` (amber `--warning` ile) |
| Boş durumlar | `Empty` |
| Kısayol gösterimi | `Kbd` / `KbdGroup` |
| Sağ tık menüsü | `ContextMenu` |
| Planlayıcı (liste + takvim) | `ResizablePanelGroup` + `ScrollArea` |
| Bildirim / geri al | `toast` |
| Yükleniyor | `Skeleton` (300ms sonra), butonda `Spinner` |
| Gün / Hafta geçişi | `ToggleGroup` veya `Tabs` |

**Kullanılmayacaklar (V1):** `Carousel`, `Navigation Menu`, `Menubar`, `Breadcrumb`, `Pagination`, `Avatar`, `Hover Card`, `Data Table`. `Chart` sadece Analiz ekranında, sade yatay çubuk olarak kullanılır.

---

## 4. Component API özetleri

### Button
- `variant`: `default` · `secondary` · `outline` · `ghost` · `destructive` · `link`
- `size`: `default` · `xs` · `sm` · `lg` · `icon` · `icon-xs` · `icon-sm` · `icon-lg`
- İkon: `data-icon="inline-start" | "inline-end"`. Yükleniyor durumu için içine `<Spinner data-icon="inline-start" />`.
- **Kural:** Ekranda tek bir `variant="default"` buton olur (birincil aksiyon). Diğerleri `ghost` veya `outline`.

```tsx
<Button size="lg" onClick={startFocus}>
  <Play data-icon="inline-start" /> Başla
</Button>
```

### Item (görev satırı)
- `Item` → `variant`: `default` · `outline` · `muted`; `size`: `default` · `sm` · `xs`; `asChild`
- Alt parçalar: `ItemGroup`, `ItemSeparator`, `ItemMedia` (`variant`: `default` · `icon` · `image`), `ItemContent`, `ItemTitle`, `ItemDescription`, `ItemActions`, `ItemHeader`, `ItemFooter`

```tsx
<ItemGroup>
  <Item size="sm" data-selected={selected}>
    <ItemMedia><Checkbox checked={done} onCheckedChange={toggle} /></ItemMedia>
    <ItemContent>
      <ItemTitle>TÜBİTAK Sonuç Raporu</ItemTitle>
      <ItemDescription>1s 20dk · Araştırma</ItemDescription>
    </ItemContent>
    <ItemActions>
      <Badge variant="outline" className="text-priority-high">Yüksek</Badge>
    </ItemActions>
  </Item>
  <ItemSeparator />
</ItemGroup>
```

### Sidebar
- `SidebarProvider`: `defaultOpen` · `open` · `onOpenChange`
- `Sidebar`: `side` (`left` | `right`) · `variant` (`sidebar` | `floating` | `inset`) · `collapsible` (`offcanvas` | `icon` | `none`)
- Alt parçalar: `SidebarHeader`, `SidebarContent`, `SidebarGroup`, `SidebarGroupLabel`, `SidebarMenu`, `SidebarMenuItem`, `SidebarMenuButton` (`isActive`, `tooltip`, `asChild`), `SidebarFooter`, `SidebarTrigger`, `SidebarRail`
- `useSidebar()` → `state`, `open`, `setOpen`, `toggleSidebar()`, `isMobile`
- Varsayılan kısayol `Ctrl+B`. Genişlik `--sidebar-width` (bu projede `14rem`).
- Bu proje: `variant="inset"`, `collapsible="icon"`. Pencere 1100px'in altına düşünce `setOpen(false)`.

```tsx
<SidebarProvider defaultOpen style={{ '--sidebar-width': '14rem' } as React.CSSProperties}>
  <Sidebar variant="inset" collapsible="icon">
    <SidebarContent>
      <SidebarGroup>
        <SidebarMenu>
          {nav.map((n) => (
            <SidebarMenuItem key={n.to}>
              <SidebarMenuButton isActive={path === n.to} tooltip={n.label} asChild>
                <Link to={n.to}><n.icon /> <span>{n.label}</span></Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroup>
    </SidebarContent>
    <SidebarFooter>{/* Ara · Ayarlar */}</SidebarFooter>
  </Sidebar>
  <SidebarInset>{children}</SidebarInset>
</SidebarProvider>
```

### Command (komut paleti, `cmdk` tabanlı)
Parçalar: `Command`, `CommandDialog`, `CommandInput`, `CommandList`, `CommandEmpty`, `CommandGroup` (`heading`), `CommandItem` (`onSelect`), `CommandSeparator`, `CommandShortcut`

```tsx
<CommandDialog open={open} onOpenChange={setOpen}>
  <CommandInput placeholder="Bir komut ya da görev ara…" />
  <CommandList>
    <CommandEmpty>Sonuç yok.</CommandEmpty>
    <CommandGroup heading="Aksiyonlar">
      <CommandItem onSelect={openQuickAdd}>
        Yeni görev <CommandShortcut>Ctrl+Space</CommandShortcut>
      </CommandItem>
      <CommandItem onSelect={startFocus}>
        Focus başlat <CommandShortcut>F</CommandShortcut>
      </CommandItem>
    </CommandGroup>
    <CommandSeparator />
    <CommandGroup heading="Git">{/* ekranlar */}</CommandGroup>
  </CommandList>
</CommandDialog>
```

### Empty (boş durum)
Parçalar: `Empty`, `EmptyHeader`, `EmptyMedia` (`variant`: `default` | `icon`), `EmptyTitle`, `EmptyDescription`, `EmptyContent`

```tsx
<Empty>
  <EmptyHeader>
    <EmptyMedia variant="icon"><Sun /></EmptyMedia>
    <EmptyTitle>Bugün için planlanmış bir şey yok.</EmptyTitle>
    <EmptyDescription>Inbox'tan bir görev seç ya da yenisini ekle.</EmptyDescription>
  </EmptyHeader>
  <EmptyContent>
    <Button onClick={openQuickAdd}>Bir şey planla</Button>
  </EmptyContent>
</Empty>
```

### Kbd
```tsx
<KbdGroup><Kbd>Ctrl</Kbd><Kbd>K</Kbd></KbdGroup>
```
Tooltip'lerde ve boş durumlarda kısayolları göstermek için kullanılır.

### Toast (Radix projesinde: Sonner)
Radix tabanlı shadcn projelerinde bildirim için `sonner` component'i kullanılır. Eklemeden önce `npx shadcn@latest docs sonner` ile güncel API'yi doğrula.

```bash
npx shadcn@latest add sonner
```

`<Toaster />` uygulamanın kök component'ine bir kez eklenir (`import { Toaster } from '@/components/ui/sonner'`).

```tsx
import { toast } from 'sonner'

toast.success('Görev tamamlandı')

toast('Görev yarına taşındı', {
  action: { label: 'Geri al', onClick: () => undoMove() }
})

toast.promise(exportJson(), {
  loading: 'Dışa aktarılıyor…',
  success: 'Yedek kaydedildi',
  error: 'Dışa aktarılamadı'
})
```
- Kullanıcının yaptığı her "taşıma" ve "silme" işleminde **Geri al** aksiyonlu toast gösterilir.
- Hata toast'larında teknik mesaj yazılmaz, ton kuralı (SKILL.md §2) geçerlidir.

### Diğerleri (kısa)
| Component | Not |
|---|---|
| `Progress` | `value={(planned / capacity) * 100}`. %100'ü geçince indicator'a `bg-warning` verilir |
| `Sheet` | `side="right"`, genişlik `sm:max-w-md`. Görev detayı için |
| `Dialog` / `AlertDialog` | `AlertDialog` sadece geri alınamaz işlemler için (kalıcı silme, import ile üzerine yazma) |
| `Field` | Form alanı + label + açıklama + hata mesajı tek yapıda |
| `Calendar` | Tarih seçici. `Popover` içinde açılır, haftanın ilk günü pazartesi, `tr` locale |
| `Badge` | `variant`: `default` · `secondary` · `outline` · `destructive`. Görev satırında en fazla 2 tane |
| `Tooltip` | Sadece ikon butonlarda ve kısayolu göstermek için |
| `ScrollArea` | Uzun listelerde ve Planlayıcı zaman çizelgesinde |
| `Resizable` | Planlayıcı: solda görev listesi, sağda takvim |
| `Skeleton` | 300ms'den uzun yüklemelerde |

---

## 5. Görünümü özelleştirme

shadcn'in varsayılan görünümü "hazır SaaS dashboard" gibi durur. Bu yüzden şunlar yapılır:

1. Renk değerleri SKILL.md'deki tema ile değiştirilir (kurulumdan hemen sonra).
2. `Card` her yerde kullanılmaz. Listeler `ItemGroup` + `ItemSeparator` ile yapılır, gölge yok.
3. Varsayılan `font-sans` Inter olarak ayarlanır. Sayaç ve sürelerde `tabular-nums` kullanılır.
4. Butonlar çoğunlukla `ghost` olur. Ekranda tek bir `default` buton bulunur.
5. Bölüm başlıkları (ŞİMDİ, SONRA, BUGÜN) için ayrı bir `SectionLabel` component'i: 11px, 600, büyük harf, `text-muted-foreground`.

---

## 6. İsteğe bağlı: shadcn'in resmi agent skill'i

shadcn kendi agent skill'ini yayınlıyor (component API'leri ve CLI kullanımı için):

```bash
npx skills add shadcn/ui
```

Kurulursa API bilgisi için o skill kullanılır. Ama **görsel kararlar** (renk, ton, yoğunluk, hangi component'in nerede kullanılacağı) için her zaman bu projenin skill'i (`planner-ui-ux`) geçerlidir.
