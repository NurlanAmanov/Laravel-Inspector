<?php

namespace Nurlan\LaravelInspector\Support;

use Illuminate\Contracts\Pagination\Paginator;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;

class ValueInspector
{
    public static function summarizeAll(array $data, array $sharedKeys = []): array
    {
        $hidden = (array) config('inspector.hidden_keys', []);
        $out = [];

        foreach ($data as $key => $value) {
            if ($key === '__lvi_id' || $key === '__env' || $key === 'app') {
                continue;
            }

            if (in_array(strtolower($key), array_map('strtolower', $hidden), true)) {
                $out[] = [
                    'name' => $key,
                    'type' => 'hidden',
                    'summary' => '••• gizlədilib',
                    'shared' => in_array($key, $sharedKeys, true),
                ];

                continue;
            }

            $out[] = static::summarize($value) + [
                'name' => $key,
                'shared' => in_array($key, $sharedKeys, true),
            ];
        }

        return $out;
    }

    public static function summarize(mixed $value, int $depth = 0): array
    {
        $maxDepth = (int) config('inspector.value.max_depth', 3);

        return match (true) {
            is_null($value) => ['type' => 'null', 'summary' => 'null'],
            is_bool($value) => ['type' => 'bool', 'summary' => $value ? 'true' : 'false'],
            is_int($value) => ['type' => 'int', 'summary' => (string) $value],
            is_float($value) => ['type' => 'float', 'summary' => (string) $value],
            is_string($value) => static::string($value),
            $value instanceof Model => static::model($value),
            $value instanceof Paginator => static::paginator($value),
            $value instanceof EloquentCollection => static::eloquentCollection($value),
            $value instanceof Collection => static::collection($value, $depth, $maxDepth),
            is_array($value) => static::array($value, $depth, $maxDepth),
            is_object($value) => static::object($value),
            default => ['type' => gettype($value), 'summary' => gettype($value)],
        };
    }

    protected static function string(string $value): array
    {
        $max = (int) config('inspector.value.max_string', 140);
        $len = mb_strlen($value);

        return [
            'type' => 'string',
            'summary' => '"' . ($len > $max ? mb_substr($value, 0, $max) . '…' : $value) . '"',
            'meta' => $len . ' simvol',
        ];
    }

    protected static function model(Model $model): array
    {
        return [
            'type' => 'model',
            'class' => get_class($model),
            'summary' => class_basename($model) . '#' . ($model->getKey() ?? 'new'),
            'meta' => 'Eloquent model',
            'source' => 'Eloquent: ' . get_class($model),
            'table' => $model->getTable(),
            'relations' => array_keys($model->getRelations()),
            'attributes' => array_slice(array_keys($model->attributesToArray()), 0, 30),
        ];
    }

    protected static function eloquentCollection(EloquentCollection $collection): array
    {
        $first = $collection->first();

        return [
            'type' => 'collection',
            'class' => get_class($collection),
            'model' => $first ? get_class($first) : null,
            'count' => $collection->count(),
            'summary' => ($first ? class_basename($first) : 'Model') . '[] × ' . $collection->count(),
            'meta' => 'Eloquent Collection',
            'source' => $first ? 'Eloquent: ' . get_class($first) : 'Eloquent: boş kolleksiya',
            'table' => $first instanceof Model ? $first->getTable() : null,
            'relations' => $first instanceof Model ? array_keys($first->getRelations()) : [],
            'attributes' => $first instanceof Model
                ? array_slice(array_keys($first->attributesToArray()), 0, 30)
                : [],
        ];
    }

    protected static function paginator(Paginator $paginator): array
    {
        $first = $paginator->getCollection()->first();
        $total = method_exists($paginator, 'total') ? $paginator->total() : null;

        return [
            'type' => 'paginator',
            'class' => get_class($paginator),
            'model' => $first ? get_class($first) : null,
            'count' => $paginator->count(),
            'summary' => sprintf(
                '%s səhifə %d · %d/%s sətir',
                $first ? class_basename($first) : 'Item',
                $paginator->currentPage(),
                $paginator->count(),
                $total === null ? '?' : $total
            ),
            'meta' => 'Paginator',
            'source' => $first ? 'Eloquent: ' . get_class($first) : 'Paginator',
            'attributes' => $first instanceof Model
                ? array_slice(array_keys($first->attributesToArray()), 0, 30)
                : [],
        ];
    }

    protected static function collection(Collection $collection, int $depth, int $maxDepth): array
    {
        return [
            'type' => 'collection',
            'class' => get_class($collection),
            'count' => $collection->count(),
            'summary' => 'Collection × ' . $collection->count(),
            'meta' => 'Illuminate Collection',
            'children' => $depth < $maxDepth
                ? static::children($collection->all(), $depth)
                : [],
        ];
    }

    protected static function array(array $value, int $depth, int $maxDepth): array
    {
        return [
            'type' => 'array',
            'count' => count($value),
            'summary' => 'array × ' . count($value),
            'meta' => implode(', ', array_slice(array_map('strval', array_keys($value)), 0, 8)),
            'children' => $depth < $maxDepth ? static::children($value, $depth) : [],
        ];
    }

    protected static function object(object $value): array
    {
        return [
            'type' => 'object',
            'class' => get_class($value),
            'summary' => class_basename($value),
            'meta' => get_class($value),
        ];
    }

    protected static function children(array $items, int $depth): array
    {
        $max = (int) config('inspector.value.max_items', 20);
        $out = [];

        foreach (array_slice($items, 0, $max, true) as $key => $item) {
            $out[] = static::summarize($item, $depth + 1) + ['name' => (string) $key];
        }

        if (count($items) > $max) {
            $out[] = [
                'name' => '…',
                'type' => 'more',
                'summary' => '+' . (count($items) - $max) . ' daha',
            ];
        }

        return $out;
    }
}
