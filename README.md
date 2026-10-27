# Laravel Inspector

Blade/MVC Laravel layihələri üçün **developer inspector**. Səhifənin üzərində açılan overlay-dir (Vue DevTools-un komponent inspektoru kimi, amma backend üçün): hansı Blade görünüşünün hansı elementi çap etdiyini, ona hansı dəyişənlərin ötürüldüyünü və o dəyişənlərin hansı Controller → Service → Model axınından gəldiyini göstərir.

**Versiya:** 1.0.0

## Uyğunluq

| | Dəstəklənir |
| --- | --- |
| **Laravel** | 10.x · 11.x · 12.x · 13.x |
| **PHP** | 8.1, 8.2, 8.3, 8.4 |
| **Mühit** | yalnız `local`, `testing`, `development` + `APP_DEBUG=true` |
| **Stack** | Blade / MVC (klassik `view()` + `@include` + `@extends`) |

Blade marker-ləri `Blade::prepareStringsForCompilationUsing()` hook-undan istifadə edir (Laravel 9.26+). Daha köhnə versiyada paket çökmür — sadəcə DOM ↔ view xəritəsi (hover ilə element seçmə) işləməz, qalan hər şey işləyir.

Panelin aşağısında hər zaman cari versiyalar göstərilir: `Inspector v1.0.0 · Laravel 13.31.0 · PHP 8.3.16`.

> Prod-da ServiceProvider heç bir hadisə dinləmir və Blade kompilyasiyasına toxunmur.

---

## Nə göstərir

| Tab | Məzmun |
| --- | --- |
| **Görünüşlər** | Render olunan bütün Blade faylları ağac şəklində (`@extends`/`@include` iyerarxiyası ilə). Hər biri üçün dəyişənlər 4 qrupa bölünür: **Controller-dən ötürülən**, **Controller datası** (parent view-dan miras), **Parent view scope-u** (loop/local qalıqları), **Paylaşılan/qlobal**. Hər dəyişən üçün tip, Eloquent modeli, sətir sayı, cədvəl adı və yüklənmiş relation-lar. |
| **Axın** | `Route → Controller → Service/Action → View` — hər addım üçün fayl:sətir və editor-da açan link. |
| **SQL** | Request ərzindəki sorğular, icra vaxtı, ləng sorğuların işarələnməsi və hər sorğunun tətbiq daxilindəki çağırış yeri. |

**Inspect rejimi** (`Alt+I`, və ya sadəcə `Alt` basıb kursoru gəzdirmək): səhifədəki elementin üzərinə gələndə onu çərçivəyə alır və hansı Blade faylından gəldiyini tooltip-də göstərir. Elementə klik — panel həmin view-un üzərinə atlayır.

---

## Quraşdırma

### A) Lokal qovluqdan (paket sənin kompüterindədir)

Layihənin `composer.json`-una path repozitoriya əlavə et:

```json
{
    "repositories": [
        {
            "type": "path",
            "url": "D:/laragon/www/Projects/Pluginlaravel",
            "options": { "symlink": true }
        }
    ]
}
```

```bash
composer require nurlan/laravel-inspector --dev
php artisan view:clear
```

`symlink: true` sayəsində paketdə etdiyin dəyişiklik dərhal layihədə görünür.

### B) Git repozitoriyadan (komanda / başqa kompüterlər)

Paketi GitHub-a yüklədikdən sonra, **real ünvanı** yazaraq:

```json
{
    "repositories": [
        { "type": "vcs", "url": "https://github.com/ISTIFADECI-ADI/laravel-inspector" }
    ]
}
```

```bash
composer require nurlan/laravel-inspector --dev
php artisan view:clear
```

### C) Packagist-dən (hər kəs üçün)

Paket [packagist.org](https://packagist.org)-da qeydiyyatdan keçdikdən sonra heç bir `repositories` bloku lazım deyil:

```bash
composer require nurlan/laravel-inspector --dev
php artisan view:clear
```

### Tez-tez rastlanan xətalar

| Xəta | Səbəb və həlli |
| --- | --- |
| `Could not find a matching version of package nurlan/laravel-inspector` | Composer paketi Packagist-də axtarır, amma orada yoxdur. `repositories` bloku əlavə et (A və ya B variantı). |
| `https://api.github.com/repos/<istifadeci>/laravel-inspector ... 404` | `repositories`-də nümunə ünvan (`<istifadeci>`) qalıb. Real GitHub ünvanı yaz, yoxsa path repozitoriyasına keç. |
| Overlay görünmür | `APP_ENV=local` və `APP_DEBUG=true` olmalıdır; cavab HTML olmalı və `</body>` teqi olmalıdır. |
| Hover işləmir, panel boşdur | `php artisan view:clear` çağır — marker-lər kompilyasiya mərhələsində əlavə olunur. |

**Mühüm:** quraşdırmadan və paketi söndürüb-yandırmaqdan sonra bir dəfə `php artisan view:clear`.

ServiceProvider və `web` middleware qrupuna inject auto-discovery ilə özü qeyd olunur, əlavə konfiqurasiya lazım deyil.

### Konfiqurasiya (istəyə bağlı)

```bash
php artisan vendor:publish --tag=inspector-config
```

```dotenv
INSPECTOR_ENABLED=true
INSPECTOR_EDITOR=vscode      # vscode | phpstorm | sublime
```

---

## Necə işləyir

1. **`creating:` hadisəsi** — `view()` çağırıldığı ANDA işə düşür (render zamanı deyil). Həmin anda PHP stack-də Controller və aradakı Service sinifləri hələ də dayanır, buna görə `Origin::chain()` real axını çıxara bilir.
2. **Parent view təyini** — kompilyasiya olunmuş view faylının sonundaki `/**PATH ... ENDPATH**/` qeydindən oxunur. Marker stack-i yerinə bu üsul seçildi, çünki `@extends` ilə layout child view-un marker-lərindən sonra render olunur.
3. **Blade marker-ləri** — `Blade::prepareStringsForCompilationUsing()` ilə hər `.blade.php` faylının çıxışı `<!--lvi:s:ID-->` … `<!--lvi:e:ID-->` arasına alınır. `ID` view-a `$__lvi_id` kimi paylanır.
4. **Middleware** — cavab HTML-dirsə, `</body>`-dən əvvəl JSON payload + CSS + JS inject olunur.
5. **Overlay** — `TreeWalker` ilə şərhləri oxuyub DOM elementi → view xəritəsi qurur.

Marker-lər runtime-da `Inspector::marking()` ilə yoxlanır — cache-lənmiş compiled view inspector söndürüləndə tamamilə zərərsizdir.

---

## Struktur

```
src/
  Inspector.php                      request ərzindəki mərkəzi anbar + marker emitter
  InspectorServiceProvider.php       Blade hook, middleware, event listener-lər
  Collectors/
    ViewDataCollector.php            view + dəyişənlər + mənbə zənciri
    RouteCollector.php               route → controller (fayl:sətir)
    QueryCollector.php               SQL + çağırış yeri
  Support/
    ValueInspector.php               dəyəri qısa, JSON-a yararlı xülasəyə çevirir
    Origin.php                       backtrace-dən tətbiqin öz kadrlarını çıxarır
  Http/Middleware/InjectInspector.php
resources/dist/
  inspector.css
  inspector.js                       overlay (asılılıqsız vanilla JS)
config/inspector.php
```

---

## Məlum məhdudiyyətlər

- `@extends` istifadə edən səhifədə `@section` məzmunu DOM-da layout-un diapazonuna düşür, ona görə hover həmin blokda layout faylını göstərir (panel ağacında iyerarxiya düzgündür).
- Blade `@include`/`@extends` kompilyasiyada `get_defined_vars()` ötürür, yəni child view parent-in bütün render scope-unu alır. Paket bunları ayrı qrupda göstərir, amma hansının məhz `@include(..., [...])` ilə verildiyini PHP səviyyəsində ayırd etmək mümkün deyil.

## Növbəti addımlar

- `@foreach` döngüsünün hansı dəyişən üzərində gəzdiyini ayrıca göstərmək.
- Blade içindəki `<vue-component :prop="...">` teqlərini tapıb props → backend dəyişəni əlaqəsi.
- API/JSON cavablara debug meta (ayrı SPA üçün).
- N+1 sorğu aşkarlanması.
- Inertia `::render()` props-ları üçün ayrı tab.
