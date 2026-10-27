<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Inspector aktivdir?
    |--------------------------------------------------------------------------
    | Default olaraq yalnız APP_DEBUG=true olduqda işləyir. Prod-da heç vaxt
    | açıq qalmamalıdır — toplanan data controller/model adlarını açır.
    */
    'enabled' => env('INSPECTOR_ENABLED', env('APP_DEBUG', false)),

    /*
    | Yalnız local/testing mühitində işləsin (enabled=true olsa belə).
    */
    'only_environments' => ['local', 'testing', 'development'],

    /*
    |--------------------------------------------------------------------------
    | Görünüş markerləri
    |--------------------------------------------------------------------------
    | Bu nümunələrə uyğun Blade faylları işarələnmir (HTML şərhi əlavə olunmur).
    | Mail şablonları, notification view-ları və s. üçün faydalıdır.
    | Nümunələr view yolunun base_path-a nisbi formasına tətbiq olunur.
    */
    'ignore_views' => [
        '*/mail/*',
        '*/notifications/*',
        '*/vendor/*',
        '*.blade.txt',
    ],

    /*
    | Bu URI-lərdə overlay inject olunmur.
    */
    'ignore_paths' => [
        'telescope*',
        'horizon*',
        '_debugbar*',
        'livewire/*',
        '__clockwork*',
    ],

    /*
    |--------------------------------------------------------------------------
    | SQL sorğuları
    |--------------------------------------------------------------------------
    */
    'queries' => [
        'enabled' => true,
        'limit' => 200,
        'slow_ms' => 50,
    ],

    /*
    |--------------------------------------------------------------------------
    | Dəyər xülasəsi limitləri
    |--------------------------------------------------------------------------
    */
    'value' => [
        'max_string' => 140,
        'max_items' => 20,
        'max_depth' => 3,
    ],

    /*
    | Bu açarlar heç vaxt göstərilmir.
    */
    'hidden_keys' => [
        'password', 'password_confirmation', 'token', 'api_token',
        'secret', 'authorization', 'cookie', '_token',
    ],

    /*
    |--------------------------------------------------------------------------
    | Editor
    |--------------------------------------------------------------------------
    | Fayl linklərinin açılma formatı: vscode, phpstorm, sublime, yoxdursa null.
    */
    'editor' => env('INSPECTOR_EDITOR', 'vscode'),

];
