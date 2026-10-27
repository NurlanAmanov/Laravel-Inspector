<?php

return [

    'enabled' => env('INSPECTOR_ENABLED', env('APP_DEBUG', false)),

    'only_environments' => ['local', 'testing', 'development'],

    'ignore_views' => [
        '*/mail/*',
        '*/notifications/*',
        '*/vendor/*',
        '*.blade.txt',
    ],

    'ignore_paths' => [
        'telescope*',
        'horizon*',
        '_debugbar*',
        'livewire/*',
        '__clockwork*',
    ],

    'queries' => [
        'enabled' => true,
        'limit' => 200,
        'slow_ms' => 50,
    ],

    'value' => [
        'max_string' => 140,
        'max_items' => 20,
        'max_depth' => 3,
    ],

    'hidden_keys' => [
        'password', 'password_confirmation', 'token', 'api_token',
        'secret', 'authorization', 'cookie', '_token',
    ],

    'editor' => env('INSPECTOR_EDITOR', 'vscode'),

];
