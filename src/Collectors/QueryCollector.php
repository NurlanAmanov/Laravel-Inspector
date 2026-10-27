<?php

namespace Nurlan\LaravelInspector\Collectors;

use Illuminate\Database\Events\QueryExecuted;
use Nurlan\LaravelInspector\Inspector;
use Nurlan\LaravelInspector\Support\Origin;

/**
 * SQL sorğuları + hər sorğunun tətbiq daxilindəki çağırış nöqtəsi.
 * "Bu data hansı Eloquent sorğusundan gəldi?" sualının cavabı.
 */
class QueryCollector
{
    public function handle(QueryExecuted $event): void
    {
        if (! Inspector::marking()) {
            return;
        }

        $chain = Origin::chain(3);

        Inspector::addQuery([
            'sql' => $event->sql,
            'bindings' => array_map(
                fn ($b) => is_scalar($b) || $b === null ? $b : get_debug_type($b),
                $event->bindings
            ),
            'time' => $event->time,
            'connection' => $event->connectionName,
            'slow' => $event->time >= (float) config('inspector.queries.slow_ms', 50),
            'caller' => $chain[0] ?? null,
            'chain' => $chain,
        ]);
    }
}
