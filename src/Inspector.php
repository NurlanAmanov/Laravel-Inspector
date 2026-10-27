<?php

namespace Nurlan\LaravelInspector;

/**
 * Bir request ərzində toplanan bütün məlumatın mərkəzi anbarı.
 *
 * Statik saxlanılır, çünki Blade-in kompilyasiya olunmuş çıxışından
 * (openView/closeView) birbaşa çağırılır — orada container əlçatan deyil.
 */
class Inspector
{
    /** Marker echo olunsun? Middleware request başında təyin edir. */
    protected static bool $marking = false;

    /** @var array<string, array> id => view qeydi */
    protected static array $views = [];

    /** @var string[] Render zamanı açıq olan view-ların stack-i */
    protected static array $stack = [];

    /** @var array Request / route / controller məlumatı */
    protected static array $request = [];

    /** @var array[] SQL sorğuları */
    protected static array $queries = [];

    protected static int $sequence = 0;

    public static function enable(): void
    {
        static::$marking = true;
    }

    public static function disable(): void
    {
        static::$marking = false;
    }

    public static function marking(): bool
    {
        return static::$marking;
    }

    public static function reset(): void
    {
        static::$views = [];
        static::$stack = [];
        static::$request = [];
        static::$queries = [];
        static::$sequence = 0;
    }

    /**
     * `creating: *` hadisəsində view qeyd olunur və id qaytarılır.
     * Bu id view-a `$__lvi_id` kimi paylanır ki, render zamanı
     * HTML marker-i həmin qeydlə əlaqələndirə bilsin.
     */
    public static function registerView(array $record): string
    {
        $id = 'v' . (++static::$sequence);

        static::$views[$id] = $record + [
            'id' => $id,
            'name' => null,
            'path' => null,
            'data' => [],
            'chain' => [],
            'parent' => null,
            'rendered' => false,
        ];

        static::$views[$id]['id'] = $id;

        return $id;
    }

    /**
     * Compile olunmuş Blade-in ilk sətri. HTML şərhi qaytarır.
     */
    public static function openView(?string $id, string $path): string
    {
        if (! static::$marking) {
            return '';
        }

        if ($id === null || ! isset(static::$views[$id])) {
            // `creating` hadisəsi tutulmayıb (məs. Blade::render() ilə
            // birbaşa string kompilyasiyası) — boş qeyd yaradırıq.
            $id = static::registerView([
                'name' => $path,
                'path' => $path,
                'untracked' => true,
            ]);
        }

        static::$views[$id]['rendered'] = true;
        static::$views[$id]['parent'] = end(static::$stack) ?: null;

        static::$stack[] = $id;

        return '<!--lvi:s:' . $id . '-->';
    }

    public static function closeView(): string
    {
        if (! static::$marking) {
            return '';
        }

        $id = array_pop(static::$stack);

        return $id ? '<!--lvi:e:' . $id . '-->' : '';
    }

    public static function setRequest(array $data): void
    {
        static::$request = $data;
    }

    public static function addQuery(array $query): void
    {
        $limit = (int) config('inspector.queries.limit', 200);

        if (count(static::$queries) >= $limit) {
            return;
        }

        static::$queries[] = $query;
    }

    /**
     * Overlay-ə ötürülən tam JSON payload.
     */
    public static function payload(): array
    {
        $views = array_values(array_filter(
            static::$views,
            fn ($v) => $v['rendered'] ?? false
        ));

        return [
            'request' => static::$request,
            'views' => $views,
            'queries' => static::$queries,
            'stats' => [
                'views' => count($views),
                'queries' => count(static::$queries),
                'query_time' => round(array_sum(array_column(static::$queries, 'time')), 2),
            ],
            'editor' => config('inspector.editor'),
            'base_path' => str_replace('\\', '/', base_path()),
        ];
    }

    /**
     * Mütləq yolu layihə kökünə nisbi formaya salır.
     */
    public static function relativePath(string $path): string
    {
        $path = str_replace('\\', '/', $path);
        $base = str_replace('\\', '/', base_path()) . '/';

        return str_starts_with($path, $base)
            ? substr($path, strlen($base))
            : $path;
    }
}
