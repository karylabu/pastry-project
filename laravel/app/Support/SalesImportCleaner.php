<?php

namespace App\Support;

use Carbon\Carbon;
use DateTimeImmutable;
use Throwable;

class SalesImportCleaner
{
    public static function normalizeProductName(string $name): string
    {
        $name = preg_replace('/[\x00-\x1F\x7F]+/u', ' ', $name);

        return trim(preg_replace('/\s+/u', ' ', is_string($name) ? $name : ''));
    }

    public static function parseSaleDate(string $value): ?string
    {
        $value = trim($value);
        foreach (['Y-m-d', 'Y/m/d'] as $format) {
            $date = DateTimeImmutable::createFromFormat('!' . $format, $value);
            $errors = DateTimeImmutable::getLastErrors();
            if ($date && ($errors === false || ($errors['warning_count'] === 0 && $errors['error_count'] === 0))
                && $date->format($format) === $value) {
                return $date->format('Y-m-d');
            }
        }

        if (preg_match('/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/', $value, $matches)) {
            $first = (int) $matches[1];
            $second = (int) $matches[2];
            if ($first <= 12 && $second <= 12 && $first !== $second) {
                return null;
            }

            $separator = $matches[0][strlen((string) $matches[1])];
            $dateFormat = $first > 12
                ? 'd' . $separator . 'm' . $separator . 'Y'
                : 'm' . $separator . 'd' . $separator . 'Y';
            $date = DateTimeImmutable::createFromFormat('!' . $dateFormat, $value);
            $errors = DateTimeImmutable::getLastErrors();
            if ($date && ($errors === false || ($errors['warning_count'] === 0 && $errors['error_count'] === 0))) {
                return $date->format('Y-m-d');
            }
        }

        if (preg_match('/^\d{4}-\d{2}-\d{2}T/', $value)) {
            try {
                return Carbon::parse($value)->toDateString();
            } catch (Throwable) {
                return null;
            }
        }

        return null;
    }

    public static function extractReportDate(string $text): ?string
    {
        $labeledDates = [];
        $allDates = [];
        preg_match_all('/(?<!\d)(?:\d{4}[\/.-]\d{1,2}[\/.-]\d{1,2}|\d{1,2}[\/.-]\d{1,2}[\/.-]\d{4})(?!\d)/', $text, $matches);
        foreach ($matches[0] as $candidate) {
            $date = self::parseSaleDate($candidate);
            if ($date !== null) {
                $allDates[$date] = true;
            }
        }

        foreach (preg_split('/\r\n|\r|\n/', $text) as $line) {
            if (!preg_match('/\b(?:date|sales date|transaction date|report date|period)\b/i', $line)) {
                continue;
            }
            preg_match_all('/(?<!\d)(?:\d{4}[\/.-]\d{1,2}[\/.-]\d{1,2}|\d{1,2}[\/.-]\d{1,2}[\/.-]\d{4})(?!\d)/', $line, $lineMatches);
            foreach ($lineMatches[0] as $candidate) {
                $date = self::parseSaleDate($candidate);
                if ($date !== null) {
                    $labeledDates[$date] = true;
                }
            }
        }

        $dates = $labeledDates ?: $allDates;

        return count($dates) === 1 ? (string) array_key_first($dates) : null;
    }
}
