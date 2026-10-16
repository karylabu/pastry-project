<?php

namespace App\Support;

class SalesItemSize
{
    public static function fromProductName(string $productName): ?string
    {
        if (preg_match('/\b(\d{1,2})\s*[x×]\s*(\d{1,2})\b/i', $productName, $matches) !== 1) {
            return null;
        }

        return $matches[1] . 'x' . $matches[2];
    }
}
