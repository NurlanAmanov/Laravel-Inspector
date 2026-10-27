# Laravel Inspector

Blade/MVC Laravel layihələri üçün **developer inspector**. Səhifənin üzərində açılan overlay-dir (Vue DevTools-un komponent inspektoru kimi, amma backend üçün): hansı Blade görünüşünün hansı elementi çap etdiyini, ona hansı dəyişənlərin ötürüldüyünü və o dəyişənlərin hansı Controller → Service → Model axınından gəldiyini göstərir.

> Yalnız `local` mühit + `APP_DEBUG=true` üçündür. Prod-da ServiceProvider heç bir hadisə dinləmir və Blade kompilyasiyasına toxunmur.

---

## Nə göstərir

| Tab | Məzmun |
| --- | --- |
| **Görünüşlər** | Render olunan bütün Blade faylları ağac şəklində. Hər biri üçün: ona ötürülən dəyişənlər (tipi, Eloquent modeli, sətir sayı, cədvəl adı, yüklənmiş relation-lar) və həmin view-u çağıran funksiya zənciri. |
| **Axın** | `Route → Controller → Service/Action → View` — hər addım üçün fayl:sətir, editor-da açılan link. |
| **SQL** | Request ərzindəki sorğular, icra vaxtı və hər sorğunun tətbiq daxilindəki çağırış yeri. |

**Inspect rejimi** (`Alt+I`, və ya sadəcə `Alt` basıb kursoru gəzdirmək): səhifədəki elementin üzərinə gələndə onu çərçivəyə alır və hansı Blade faylından gəldiyini, orada hansı dəyişənlərin olduğunu tooltip-də göstərir. Elementə klik — panel həmin view-un üzərinə atlayır.

---

## Quraşdırma

### A) Hazır paket kimi (istənilən layihəyə)

Paket Packagist-ə yüklənibsə:

```bash
composer require nurlan/laravel-inspector --dev
php artisan view:clear
```

### B) Git repozitoriyadan (Packagist-siz)

Layihənin `composer.json`-una:

```json
{
    "repositories": [
        {
            "type": "vcs",
            "url": "https://github.com/<istifadeci>/laravel-inspector"
        }
    ]
}
```

```bash
composer require nurlan/laravel-inspector:dev-main --dev
php artisan view:clear
```

### C) Lokal qovluqdan (indiki vəziyyət — inkişaf üçün)

Bu paket hələ lokaldır. İstənilən layihənin `composer.json`-una path repozitoriya əlavə et:

```json
{
    "repositories": [
        {
            "type": "path",
            "url": "../../Pluginlaravel",
            "options": { "symlink": true }
        }
    ]
}
```

`url` layihədən paketə nisbi (və ya mütləq) yoldur. Məsələn Laragon-da:
`"url": "D:/laragon/www/Projects/Pluginlaravel"`.

Sonra:

```bash
composer require nurlan/laravel-inspector:@dev --dev
php artisan view:clear
```

`symlink: true` sayəsində paketdə etdiyin dəyişiklik dərhal layihədə görünür — hər dəfə `composer update` lazım deyil.

**Mühüm:** quraşdırmadan (və paketi söndürüb-yandırmaqdan) sonra bir dəfə `php artisan view:clear` çağır — Blade markerləri kompilyasiya mərhələsində əlavə olunur.

ServiceProvider və `web` middleware qrupuna inject auto-discovery ilə özü qeyd olunur, əlavə konfiqurasiya lazım deyil.

### Konfiqurasiya (istəyə bağlı)

```bash
php artisan vendor:publish --tag=inspector-config
```

`.env`:

```dotenv
INSPECTOR_ENABLED=true
INSPECTOR_EDITOR=vscode      # vscode | phpstorm | sublime
```

---

## Necə işləyir

1. **`creating:` hadisəsi** — `view()` çağırıldığı ANDA işə düşür (render zamanı deyil). Həmin anda PHP stack-də Controller və aradakı Service sinifləri hələ də dayanır, buna görə `Origin::chain()` real axını çıxara bilir. View-a ötürülən bütün data burada xülasə olunur (`ValueInspector`).
2. **Blade markerləri** — `Blade::prepareStringsForCompilationUsing()` ilə hər `.blade.php` faylının çıxışı `<!--lvi:s:ID-->` … `<!--lvi:e:ID-->` şərhləri arasına alınır. `ID` həmin view-un addım 1-dəki qeydinə işarə edir (view-a `$__lvi_id` kimi paylanır).
3. **Middleware** — cavab HTML-dirsə, `</body>`-dən əvvəl JSON payload + CSS + JS inject olunur.
4. **Overlay** — `TreeWalker` ilə şərhləri oxuyub `DOM elementi → view` xəritəsi qurur. Hover zamanı element bu xəritədən tapılır.

Markerlər runtime-da `Inspector::marking()` ilə yoxlanır — yəni cache-lənmiş compiled view inspector söndürüləndə də tamamilə zərərsizdir, heç nə çap olunmur.

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

## Hələ yoxdur (növbəti addımlar)

- `@foreach` döngüsünün hansı dəyişən üzərində gəzdiyini ayrıca göstərmək (Blade direktivini sarımaq lazımdır).
- Blade içindəki `<vue-component :prop="...">` teqlərini tapıb props → backend dəyişəni əlaqəsini göstərmək.
- API/JSON cavablara debug meta əlavə etmək (ayrı SPA üçün).
- N+1 sorğu aşkarlanması (eyni SQL şablonunun təkrarı).
- Inertia `::render()` props-larının ayrıca tab-ı.
