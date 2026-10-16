<?php

namespace App\Support;

class SalesItemSize
{
    public static function fromProductName(string $productName): ?string
    {
        if (preg_match('/\btopper\b/i', $productName) === 1) {
            return null;
        }
        if (preg_match('/\bbento\b/i', $productName) === 1) {
            return 'Bento';
        }
        if (preg_match('/\b(?:two|2)\s*[- ]?\s*tier\b/i', $productName) === 1) {
            return 'Two Tier';
        }
        if (preg_match('/\b(\d{1,2})\s*[x×]\s*(\d{1,2})\b/i', $productName, $matches) !== 1) {
            return 'Other';
        }

        return $matches[1] . 'x' . $matches[2];
    }
}
