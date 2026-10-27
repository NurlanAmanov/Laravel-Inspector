<?php

namespace Nurlan\LaravelInspector\Collectors;

use Illuminate\Contracts\Events\Dispatcher;
use Illuminate\Contracts\View\Factory as ViewFactory;
use Illuminate\View\View;
use Nurlan\LaravelInspector\Inspector;
use Nurlan\LaravelInspector\Support\Origin;
use Nurlan\LaravelInspector\Support\ValueInspector;

class ViewDataCollector
{
    public function __construct(
        protected ViewFactory $views,
    ) {
    }

    public function listen(Dispatcher $events): void
    {
        $events->listen('creating: *', function ($event, $payload) {
            $view = $payload[0] ?? null;

            if (! $view instanceof View) {
                return;
            }

            $this->record($view);
        });
    }

    protected function record(View $view): void
    {
        $path = $view->getPath();

        if (! is_string($path) || ! str_ends_with($path, '.blade.php')) {
            return;
        }

        $data = $view->getData();
        $shared = $this->sharedKeys();
        $parentPath = Origin::callerView();
        $parent = $parentPath === null ? null : Inspector::findViewByPath($parentPath);
        $parentRecord = $parent === null ? null : Inspector::viewRecord($parent);

        $controllerKeys = $parentRecord['controller_keys']
            ?? $this->meaningfulKeys($data, $shared);

        $id = Inspector::registerView([
            'name' => $view->name(),
            'path' => Inspector::relativePath($path),
            'data' => ValueInspector::summarizeAll(
                $data,
                $shared,
                $parent === null ? [] : $controllerKeys,
                $parent !== null
            ),
            'controller_keys' => $controllerKeys,
            'chain' => Origin::chain(),
            'created_in' => $parent,
        ]);

        $view->with('__lvi_id', $id);
    }

    protected function meaningfulKeys(array $data, array $shared): array
    {
        return array_values(array_filter(
            array_keys($data),
            fn ($key) => ! ValueInspector::isInternal($key) && ! in_array($key, $shared, true)
        ));
    }

    protected function sharedKeys(): array
    {
        return method_exists($this->views, 'getShared')
            ? array_keys($this->views->getShared())
            : [];
    }
}
