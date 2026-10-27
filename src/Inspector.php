<?php

namespace Nurlan\LaravelInspector;

class Inspector
{
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
            'chain' => [],
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

    public static function relativePath(string $path): string
    {
        $path = str_replace('\\', '/', $path);
        $base = str_replace('\\', '/', base_path()) . '/';

        return str_starts_with($path, $base)
            ? substr($path, strlen($base))
            : $path;
    }
}
