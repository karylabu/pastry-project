<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Contracts\Encryption\DecryptException;
use Symfony\Component\HttpFoundation\Response;

class PromotionUnsubscribeController extends Controller
{
    public function show(Request $request): Response
    {
        if (! $request->hasValidSignature()) {
            return $this->page('Link unavailable', 'This unsubscribe link is invalid or has expired.', 403);
        }

        $user = $this->resolveCustomer($request->query('token'));

        if (! $user) {
            return $this->page('Link unavailable', 'This unsubscribe link is invalid or has expired.', 404);
        }

        if (! $user->subscribed_promo) {
            return $this->page('Already unsubscribed', 'You will not receive promotional emails.', 200);
        }

        $actionUrl = e($request->fullUrl());

        return $this->page(
            'Unsubscribe from promotions',
            'Confirm that you no longer want to receive promotional emails.',
            200,
            '<form method="POST" action="' . $actionUrl . '"><button type="submit" name="unsubscribe" value="1">Confirm unsubscribe</button></form>',
        );
    }

    public function unsubscribe(Request $request): Response
    {
        if (! $request->hasValidSignature()) {
            return $this->page('Link unavailable', 'This unsubscribe link is invalid or has expired.', 403);
        }

        $user = $this->resolveCustomer($request->query('token'));

        if (! $user) {
            return $this->page('Link unavailable', 'This unsubscribe link is invalid or has expired.', 404);
        }

        if ($user->subscribed_promo) {
            $user->subscribed_promo = false;
            $user->save();
        }

        return $this->page('Unsubscribed', 'You will no longer receive promotional emails.', 200);
    }

    private function resolveCustomer(?string $encryptedId): ?User
    {
        if (! $encryptedId) {
            return null;
        }

        try {
            $userId = Crypt::decryptString($encryptedId);
        } catch (DecryptException) {
            return null;
        }

        $user = User::find($userId);

        return $user && $user->role === 'customer' ? $user : null;
    }

    private function page(string $title, string $message, int $status, string $form = ''): Response
    {
        $html = '<!doctype html><html lang="en"><head><meta charset="utf-8">'
            . '<meta name="viewport" content="width=device-width, initial-scale=1">'
            . '<meta name="robots" content="noindex,nofollow">'
            . '<title>' . e($title) . '</title>'
            . '<style>body{font-family:Arial,sans-serif;background:#f5f5f7;color:#222;margin:0;padding:32px}'
            . 'main{max-width:520px;margin:10vh auto;background:#fff;padding:32px;border-radius:12px}'
            . 'button{padding:12px 18px;background:#5c4715;color:#fff;border:0;border-radius:6px;cursor:pointer}</style>'
            . '</head><body><main><h1>' . e($title) . '</h1><p>' . e($message) . '</p>'
            . $form . '</main></body></html>';

        return response($html, $status)->header('Content-Type', 'text/html; charset=UTF-8');
    }
}
