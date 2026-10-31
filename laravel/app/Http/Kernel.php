<?php

namespace App\Http;

use Illuminate\Foundation\Http\Kernel as HttpKernel;

class Kernel extends HttpKernel
{
    protected $middleware = [];

    protected $middlewareGroups = [
        'web' => [
            \App\Http\Middleware\Cors::class,
            \Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse::class,
            \Illuminate\Session\Middleware\StartSession::class,
            \Illuminate\View\Middleware\ShareErrorsFromSession::class,
            \App\Http\Middleware\TrustProxies::class,
            \App\Http\Middleware\AuditAdminActivity::class,
        ],
        'api' => [
            \App\Http\Middleware\Cors::class,
            \Illuminate\Session\Middleware\StartSession::class,
            \Illuminate\Routing\Middleware\SubstituteBindings::class,
            \App\Http\Middleware\TrustProxies::class,
            \App\Http\Middleware\AuditAdminActivity::class,
        ],
    ];

    protected $middlewareAliases = [];
}