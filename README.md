# Laravel Inspector

A **developer inspector** for Blade/MVC Laravel projects. It is an overlay on top of the page (like the Vue DevTools component inspector, but for the backend): it shows which Blade view rendered each element, which variables were passed to that view, and which Controller → Service → Model flow those variables came from.

**Version:** 1.0.1

## Compatibility

| | Supported |
| --- | --- |
| **Laravel** | 10.x · 11.x · 12.x · 13.x |
| **PHP** | 8.1, 8.2, 8.3, 8.4 |
| **Environment** | only `local`, `testing`, `development` + `APP_DEBUG=true` |
| **Stack** | Blade / MVC (classic `view()` + `@include` + `@extends`) |

Blade markers use the `Blade::prepareStringsForCompilationUsing()` hook (Laravel 9.26+). On older versions the package does not crash — only the DOM ↔ view mapping (selecting elements by hovering) does not work; everything else still does.

The bottom of the panel always shows the current versions: `Inspector v1.0.1 · Laravel 13.31.0 · PHP 8.3.16`.

> In production the ServiceProvider does not listen to any events and does not touch Blade compilation.

---

## What it shows

| Tab | Content |
| --- | --- |
| **Element** | The element you clicked: its tag/id/class and text, the controller that produced it, the request flow, the view hierarchy it lives in, and the variables passed to that view. |
| **Views** | All rendered Blade files as a tree (following the `@extends`/`@include` hierarchy). For each view, variables are grouped into 4 sets: **passed from the controller**, **controller data** (inherited from the parent view), **parent view scope** (loop/local leftovers), and **shared/global**. For each variable: type, Eloquent model, row count, table name and loaded relations. |
| **Flow** | `Route → Controller → Service/Action → View` — for each step the file:line and a link that opens it in your editor. |
| **SQL** | Queries executed during the request, their run time, slow queries highlighted, and the application call site of each query. |

**Inspect mode**: click the **Seç** (Select) button on the badge, or press `Alt+I`, or simply hold `Alt` and move the cursor. While it is active, hovering an element outlines it and the tooltip shows the Blade file it came from. Clicking an element opens the **Element** tab for it and turns inspect mode off. Press `Esc` to leave inspect mode.

---

## Installation

```bash
composer require nurlan/laravel-inspector --dev
php artisan view:clear
```

Nothing else is needed — the ServiceProvider and the injection into the `web` middleware group are registered automatically via package discovery.

### Updating

**Released version (Packagist or GitHub tag):**

```bash
composer update nurlan/laravel-inspector
php artisan view:clear
```

If Composer keeps an old copy, clear its cache first: `composer clear-cache`, then run the update again.

**Local development (package in a sibling folder, symlinked):** once set up (see the local folder variant below), changes to the package are picked up immediately. After each change, only clear the view cache:

```bash
php artisan view:clear
```

Then reload the page with a hard refresh (`Ctrl+F5`). If `vendor/nurlan/laravel-inspector` is a copy instead of a symlink (this can happen on Windows), run `composer update nurlan/laravel-inspector` after each change.

> Constraints like `"nurlan/laravel-inspector": "^1.0"` only see tagged releases, so commits pushed to `main` are not picked up until a new tag is published (for example `git tag v1.0.2 && git push origin v1.0.2`).

<details>
<summary>Variants without Packagist (fork, private repo, local development)</summary>

**Directly from GitHub.** Add this to your project's `composer.json`:

```json
{
    "repositories": [
        { "type": "vcs", "url": "https://github.com/NurlanAmanov/Laravel-Inspector.git" }
    ]
}
```

```bash
composer require nurlan/laravel-inspector:dev-main --dev
```

**From a local folder (only when you are working on the package itself).** The path from the project to the package must be **relative** — an absolute path will not work on another computer:

```json
{
    "repositories": [
        {
            "type": "path",
            "url": "../Pluginlaravel",
            "options": { "symlink": true }
        }
    ]
}
```

```bash
composer require nurlan/laravel-inspector:*@dev --dev
```

`@dev` is required here: the path repository takes the version from the branch name (`dev-main`), which does not match `minimum-stability: stable`. With `symlink: true`, changes you make in the package appear in the project immediately.

</details>

### Common errors

| Error | Cause and fix |
| --- | --- |
| `Could not find a matching version of package nurlan/laravel-inspector` | Wrong package name, or you are installing through a `repositories` block and the version does not match `minimum-stability`. Use `:dev-main` for VCS and `:*@dev` for a path repository. |
| `https://api.github.com/repos/<user>/... 404` | The example address is still in `repositories`. Replace it with the real GitHub address. |
| The overlay does not appear | `APP_ENV=local` and `APP_DEBUG=true` must be set; the response must be HTML and contain a `</body>` tag. |
| Hover does not work, the panel is empty | Run `php artisan view:clear` — the markers are added at compile time. |

**Important:** after installing, and after disabling/re-enabling the package, run `php artisan view:clear` once.

### Configuration (optional)

```bash
php artisan vendor:publish --tag=inspector-config
```

```dotenv
INSPECTOR_ENABLED=true
INSPECTOR_EDITOR=vscode      # vscode | phpstorm | sublime
```

---

## How it works

1. **`creating:` event** — fires at the moment `view()` is called (not at render time). At that moment the Controller and the Service classes in between are still on the PHP stack, so `Origin::chain()` can capture the real flow.
2. **Parent view detection** — read from the `/**PATH ... ENDPATH**/` note at the end of the compiled view file. This method was chosen over a marker stack because with `@extends` the layout is rendered after the child view's markers.
3. **Blade markers** — with `Blade::prepareStringsForCompilationUsing()`, the output of every `.blade.php` file is wrapped in `<!--lvi:s:ID-->` … `<!--lvi:e:ID-->`. `ID` is passed to the view as `$__lvi_id`.
4. **Middleware** — if the response is HTML, the JSON payload + CSS + JS are injected before `</body>`. The CSS and JS are isolated in a Shadow DOM, so the site's own styles do not affect the overlay and the overlay does not affect the site.
5. **Overlay** — reads the comments with a `TreeWalker` and builds a map of DOM element → view.

Markers are checked at runtime with `Inspector::marking()` — a cached compiled view is completely harmless when the inspector is disabled.

---

## Structure

```
src/
  Inspector.php                      central store for the request + marker emitter
  InspectorServiceProvider.php       Blade hook, middleware, event listeners
  Collectors/
    ViewDataCollector.php            view + variables + origin chain
    RouteCollector.php               route → controller (file:line)
    QueryCollector.php               SQL + call site
  Support/
    ValueInspector.php               turns a value into a short, JSON-friendly summary
    Origin.php                       extracts the application's own frames from the backtrace
  Http/Middleware/InjectInspector.php
resources/dist/
  inspector.css
  inspector.js                       overlay (dependency-free vanilla JS, in Shadow DOM)
config/inspector.php
```

---

## Known limitations

- On a page using `@extends`, the `@section` content falls into the layout's range in the DOM, so hovering that block shows the layout file (the hierarchy in the tree is still correct).
- Blade's `@include`/`@extends` pass `get_defined_vars()` during compilation, so a child view receives the parent's entire render scope. The package shows these in a separate group, but it cannot tell at the PHP level which variables were passed explicitly with `@include(..., [...])`.

## Next steps

- Show which variable a `@foreach` loop iterates over.
- Find `<vue-component :prop="...">` tags in Blade and link props → backend variables.
- Debug meta for API/JSON responses (for separate SPAs).
- N+1 query detection.
- A separate tab for Inertia `::render()` props.
