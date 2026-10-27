<?php

namespace Nurlan\LaravelInspector\Collectors;

use Illuminate\Http\Request;
use Illuminate\Routing\Route;
use Nurlan\LaravelInspector\Inspector;
use ReflectionFunction;
use ReflectionMethod;
use Throwable;

/**
 * Route → Controller addımını toplayır: hansı route uyğun gəldi, hansı
 * controller metodu çağırıldı, o metod hansı faylın hansı sətrindədir.
 */
class RouteCollector
{
    public function collect(Request $request): void
    {
        $route = $request->route();

        Inspector::setRequest([
            'method' => $request->method(),
            'uri' => '/' . ltrim($request->path(), '/'),
            'full_url' => $request->fullUrl(),
            'route' => $route instanceof Route ? $this->route($route) : null,
            'controller' => $route instanceof Route ? $this->controller($route) : null,
            'middleware' => $route instanceof Route ? array_values($route->gatherMiddleware()) : [],
        ]);
    }

    protected function route(Route $route): array
    {
        return [
            'name' => $route->getName(),
            'uri' => '/' . ltrim($route->uri(), '/'),
            'action' => $route->getActionName(),
            'parameters' => array_map(
                fn ($value) => is_scalar($value) ? (string) $value : get_debug_type($value),
                $route->parameters()
            ),
        ];
    }

    /**
     * Controller metodunun real fayl/sətir mövqeyi — overlay-dən editor-da
     * birbaşa açmaq üçün.
     */
    protected function controller(Route $route): ?array
    {
        try {
            $action = $route->getAction('uses');

            if ($action instanceof \Closure) {
                $ref = new ReflectionFunction($action);

                return [
                    'kind' => 'closure',
                    'label' => 'Closure',
                    'file' => Inspector::relativePath($ref->getFileName() ?: ''),
                    'line' => $ref->getStartLine(),
                ];
            }

            if (! is_string($action) || ! str_contains($action, '@')) {
                return null;
            }

            [$class, $method] = explode('@', $action, 2);

            if (! class_exists($class) || ! method_exists($class, $method)) {
                return null;
            }

            $ref = new ReflectionMethod($class, $method);

            return [
                'kind' => 'controller',
                'label' => class_basename($class) . '::' . $method . '()',
                'class' => $class,
                'method' => $method,
                'file' => Inspector::relativePath($ref->getFileName() ?: ''),
                'line' => $ref->getStartLine(),
            ];
        } catch (Throwable) {
            return null;
        }
    }
}
