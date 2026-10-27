<?php

namespace Nurlan\LaravelInspector\Support;

use Nurlan\LaravelInspector\Inspector;

class Origin
{
    public static function chain(int $limit = 6): array
    {
        $frames = debug_backtrace(DEBUG_BACKTRACE_IGNORE_ARGS, 40);
        $base = str_replace('\\', '/', base_path());
        $out = [];

        foreach ($frames as $frame) {
            if (empty($frame['file'])) {
                continue;
            }

            $file = str_replace('\\', '/', $frame['file']);

            if (! str_starts_with($file, $base)) {
                continue;
            }

            if (str_contains($file, '/vendor/') || str_contains($file, '/laravel-inspector/')) {
                continue;
            }

            if (str_contains($file, '/storage/framework/views/')) {
                continue;
            }

            $class = $frame['class'] ?? null;

            $out[] = [
                'file' => Inspector::relativePath($frame['file']),
                'line' => (int) ($frame['line'] ?? 0),
                'class' => $class,
                'function' => $frame['function'] ?? '',
                'label' => $class
                    ? class_basename($class) . '::' . ($frame['function'] ?? '')
                    : ($frame['function'] ?? ''),
                'kind' => static::kind($class, $file),
            ];

            if (count($out) >= $limit) {
                break;
            }
        }

        return $out;
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
