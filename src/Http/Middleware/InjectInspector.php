<?php

namespace Nurlan\LaravelInspector\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Nurlan\LaravelInspector\Collectors\RouteCollector;
use Nurlan\LaravelInspector\Inspector;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Request başında toplamağı aktiv edir, sonunda HTML cavaba overlay-i
 * (payload + css + js) `</body>`-dən əvvəl yerləşdirir.
 */
class InjectInspector
{
    public function __construct(
        protected RouteCollector $routes,
    ) {
    }

    public function handle(Request $request, Closure $next)
    {
        if (! $this->shouldRun($request)) {
            return $next($request);
        }

        Inspector::reset();
        Inspector::enable();

        $response = $next($request);

        $this->routes->collect($request);

        if ($this->isInjectable($response)) {
            $this->inject($response);
        }

        Inspector::disable();

        return $response;
    }

    protected function shouldRun(Request $request): bool
    {
        if (! config('inspector.enabled')) {
            return false;
        }

        $environments = (array) config('inspector.only_environments', []);

        if ($environments !== [] && ! app()->environment($environments)) {
            return false;
        }

        if ($request->ajax() || $request->wantsJson()) {
            return false;
        }

        foreach ((array) config('inspector.ignore_paths', []) as $pattern) {
            if ($request->is($pattern)) {
                return false;
            }
        }

        return true;
    }

    protected function isInjectable(mixed $response): bool
    {
        if (! $response instanceof Response) {
            return false;
        }

        if ($response instanceof StreamedResponse || $response instanceof BinaryFileResponse) {
            return false;
        }

        $type = (string) $response->headers->get('Content-Type', 'text/html');

        if (! str_contains($type, 'html')) {
            return false;
        }

        return str_contains((string) $response->getContent(), '</body>');
    }

    protected function inject(Response $response): void
    {
        $content = (string) $response->getContent();
        $position = strripos($content, '</body>');

        if ($position === false) {
            return;
        }

        $response->setContent(
            substr($content, 0, $position)
            . $this->overlay()
            . substr($content, $position)
        );
    }

    protected function overlay(): string
    {
        $assets = dirname(__DIR__, 3) . '/resources/dist';

        $payload = json_encode(
            Inspector::payload(),
            JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT
            | JSON_UNESCAPED_UNICODE | JSON_PARTIAL_OUTPUT_ON_ERROR
        );

        $css = @file_get_contents($assets . '/inspector.css') ?: '';
        $js = @file_get_contents($assets . '/inspector.js') ?: '';

        return '<!--lvi:overlay-->'
            . '<style id="lvi-style">' . $css . '</style>'
            . '<script type="application/json" id="lvi-payload">' . $payload . '</script>'
            . '<script id="lvi-script">' . $js . '</script>';
    }
}
