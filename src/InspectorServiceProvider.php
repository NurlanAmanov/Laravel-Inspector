<?php

namespace Nurlan\LaravelInspector;

use Illuminate\Contracts\Events\Dispatcher;
use Illuminate\Contracts\View\Factory as ViewFactory;
use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Routing\Router;
use Illuminate\Support\Facades\Blade;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;
use Illuminate\View\Compilers\BladeCompiler;
use Nurlan\LaravelInspector\Collectors\QueryCollector;
use Nurlan\LaravelInspector\Collectors\RouteCollector;
use Nurlan\LaravelInspector\Collectors\ViewDataCollector;
use Nurlan\LaravelInspector\Http\Middleware\InjectInspector;

class InspectorServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->mergeConfigFrom(__DIR__ . '/../config/inspector.php', 'inspector');

        $this->app->singleton(RouteCollector::class);
        $this->app->singleton(QueryCollector::class);
        $this->app->singleton(ViewDataCollector::class, fn ($app) => new ViewDataCollector(
            $app->make(ViewFactory::class)
        ));
    }

    public function boot(): void
    {
        $this->publishes([
            __DIR__ . '/../config/inspector.php' => $this->app->configPath('inspector.php'),
        ], 'inspector-config');

        if (! $this->inSupportedEnvironment()) {
            return;
        }

        $this->registerViewMarkers();
        $this->registerMiddleware();

        if (! config('inspector.enabled')) {
            return;
        }

        $this->app->make(ViewDataCollector::class)->listen($this->app->make(Dispatcher::class));

        if (config('inspector.queries.enabled')) {
            $this->app->make(Dispatcher::class)->listen(
                QueryExecuted::class,
                [QueryCollector::class, 'handle']
            );
        }
    }

    protected function inSupportedEnvironment(): bool
    {
        $environments = (array) config('inspector.only_environments', []);

        return $environments === [] || $this->app->environment($environments);
    }

    protected function registerMiddleware(): void
    {
        /** @var Router $router */
        $router = $this->app->make(Router::class);

        $router->pushMiddlewareToGroup('web', InjectInspector::class);
    }

    protected function registerViewMarkers(): void
    {
        if (! method_exists(BladeCompiler::class, 'prepareStringsForCompilationUsing')) {
            return;
        }

        Blade::prepareStringsForCompilationUsing(function (string $template): string {
            $path = Blade::getPath();

            if (! $path || ! str_ends_with($path, '.blade.php') || $this->isIgnoredView($path)) {
                return $template;
            }

            $relative = Inspector::relativePath($path);
            $class = '\\' . Inspector::class;

            $open = '<?php echo ' . $class . '::openView($__lvi_id ?? null, '
                . var_export($relative, true) . '); ?>';

            $close = '<?php echo ' . $class . '::closeView(); ?>';

            return $open . $template . $close;
        });
    }

    protected function isIgnoredView(string $path): bool
    {
        $relative = Inspector::relativePath($path);

        foreach ((array) config('inspector.ignore_views', []) as $pattern) {
            if (Str::is($pattern, $relative)) {
                return true;
            }
        }

        return false;
    }
}
