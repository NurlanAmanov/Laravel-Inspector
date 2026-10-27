<?php

namespace Nurlan\LaravelInspector\Support;

use Nurlan\LaravelInspector\Inspector;

class Origin
{
    public static function chain(int $limit = 6): array
    {
        $frames = debug_backtrace(DEBUG_BACKTRACE_IGNORE_ARGS, 60);
        $base = str_replace('\\', '/', base_path());
        $count = count($frames);
        $out = [];

        for ($i = 0; $i < $count; $i++) {
            $file = str_replace('\\', '/', $frames[$i]['file'] ?? '');

            if ($file === '' || ! str_starts_with($file, $base)) {
                continue;
            }

            if (str_contains($file, '/vendor/') || str_contains($file, '/storage/framework/views/')) {
                continue;
            }

            $caller = $frames[$i + 1] ?? null;
            $class = $caller['class'] ?? null;
            $function = $caller['function'] ?? ($frames[$i]['function'] ?? '');
            $inRoutes = str_contains($file, '/routes/');

            if ($class !== null && static::isFramework($class)) {
                if (! $inRoutes) {
                    continue;
                }

                $class = null;
                $function = 'Closure';
            }

            $out[] = [
                'file' => Inspector::relativePath($frames[$i]['file']),
                'line' => (int) ($frames[$i]['line'] ?? 0),
                'class' => $class,
                'function' => $function,
                'label' => $class
                    ? class_basename($class) . '::' . $function . '()'
                    : ($function !== '' ? $function . '()' : basename($file)),
                'kind' => static::kind($class, $file),
            ];

            if (count($out) >= $limit) {
                break;
            }
        }

        return $out;
    }

    public static function isFramework(string $class): bool
    {
        foreach (['Illuminate\\', 'Symfony\\', 'Laravel\\', 'Livewire\\', 'Filament\\'] as $prefix) {
            if (str_starts_with($class, $prefix)) {
                return true;
            }
        }

        return false;
    }

    public static function kind(?string $class, string $file): string
    {
        $needle = $class ?: $file;

        return match (true) {
            str_contains($needle, 'Controller') => 'controller',
            str_contains($needle, 'Middleware') => 'middleware',
            str_contains($needle, 'Services') || str_contains($needle, 'Service') => 'service',
            str_contains($needle, 'Repositories') || str_contains($needle, 'Repository') => 'repository',
            str_contains($needle, 'Actions') || str_contains($needle, 'Action') => 'action',
            str_contains($needle, 'Models') => 'model',
            str_contains($needle, 'Jobs') => 'job',
            str_contains($needle, 'Livewire') => 'livewire',
            str_contains($file, '/routes/') => 'route',
            str_contains($file, '/resources/views/') => 'view',
            default => 'app',
        };
    }
}
