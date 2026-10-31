<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Middleware\TrustProxies as Middleware;
use Illuminate\Http\Request;

class TrustProxies extends Middleware
{
    protected $headers = Request::HEADER_X_FORWARDED_FOR;

    public function handle(Request $request, Closure $next)
    {
        $trustedProxies = config('trustedproxy.proxies');
        if ($trustedProxies === '*' || $trustedProxies === '**') {
            $trustedProxies = [];
        }
        if (is_string($trustedProxies)) {
            $trustedProxies = array_filter(array_map('trim', explode(',', $trustedProxies)));
        }
        if (is_array($trustedProxies)) {
            $trustedProxies = array_values(array_filter(
                $trustedProxies,
                static fn ($proxy) => is_string($proxy) && trim($proxy) !== '' && !in_array(trim($proxy), ['*', '**'], true)
            ));
        }

        $request::setTrustedProxies([], $this->headers);
        if (is_array($trustedProxies) && $trustedProxies !== []) {
            $request->setTrustedProxies($trustedProxies, $this->headers);
        }

        return $next($request);
    }
}
