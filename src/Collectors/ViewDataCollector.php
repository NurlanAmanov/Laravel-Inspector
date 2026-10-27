<?php

namespace Nurlan\LaravelInspector\Collectors;

use Illuminate\Contracts\Events\Dispatcher;
use Illuminate\Contracts\View\Factory as ViewFactory;
use Illuminate\View\View;
use Nurlan\LaravelInspector\Inspector;
use Nurlan\LaravelInspector\Support\Origin;
use Nurlan\LaravelInspector\Support\ValueInspector;

/**
 * Hər render olunan view üçün: adı, faylı, ona ötürülən dəyişənlər və
 * həmin view-un hansı Controller/Service zəncirindən çağırıldığı.
 *
 * `creating:` hadisəsi `view()` çağırıldığı ANDA işə düşür (render zamanı
 * deyil) — buna görə stack-də Controller hələ də dayanır.
 */
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

        $id = Inspector::registerView([
            'name' => $view->name(),
            'path' => Inspector::relativePath($path),
            'data' => ValueInspector::summarizeAll($view->getData(), $this->sharedKeys()),
            'chain' => Origin::chain(),
        ]);

        // Render zamanı HTML marker-i bu qeydlə əlaqələndirmək üçün.
        $view->with('__lvi_id', $id);
    }

    /**
     * @return string[]
     */
    protected function sharedKeys(): array
    {
        return method_exists($this->views, 'getShared')
            ? array_keys($this->views->getShared())
            : [];
    }
}
