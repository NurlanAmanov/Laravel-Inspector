<?php

namespace Nurlan\LaravelInspector;

class Inspector
{
    public const VERSION = '1.0.1';

    protected static bool $marking = false;

    protected static array $views = [];

    protected static array $stack = [];

    protected static array $request = [];

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

    public static function registerView(array $record): string
    {
        $id = 'v' . (++static::$sequence);

        static::$views[$id] = $record + [
            'id' => $id,
            'name' => null,
            'path' => null,
            'data' => [],
            'controller_keys' => [],
            'chain' => [],
            'created_in' => null,
            'parent' => null,
            'rendered' => false,
        ];

        static::$views[$id]['id'] = $id;

        return $id;
    }

    public static function openView(?string $id, string $path): string
    {
        if (! static::$marking) {
            return '';
        }

        if ($id === null || ! isset(static::$views[$id])) {
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

    public static function currentView(): ?string
    {
        return end(static::$stack) ?: null;
    }

    public static function findViewByPath(string $path): ?string
    {
        foreach (array_reverse(static::$views, true) as $id => $view) {
            if (($view['path'] ?? null) === $path) {
                return $id;
            }
        }

        return null;
    }

    public static function viewRecord(string $id): ?array
    {
        return static::$views[$id] ?? null;
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

    public static function payload(): array
    {
        $views = array_values(array_map(
            function ($view) {
                unset($view['controller_keys']);

                return $view;
            },
            array_filter(static::$views, fn ($v) => $v['rendered'] ?? false)
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
            'versions' => [
                'inspector' => static::VERSION,
                'laravel' => app()->version(),
                'php' => PHP_VERSION,
                'supports' => 'Laravel 10 – 13 · PHP 8.1+',
            ],
        ];
    }

    public static function relativePath(string $path): string
    {
        $path = str_replace('\\', '/', $path);
        $base = str_replace('\\', '/', base_path()) . '/';

        return str_starts_with($path, $base)
            ? substr($path, strlen($base))
            : $path;
    }
}
