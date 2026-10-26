<?php

function emptyValidationMetrics(): array {
    return ['absolute' => [], 'squared' => [], 'percentage' => [], 'actual' => []];
}

function recordValidationError(array &$metrics, float $actual, float $predicted): void {
    $error = $actual - max(0, $predicted);
    $metrics['absolute'][] = abs($error);
    $metrics['squared'][] = $error * $error;
    $metrics['actual'][] = abs($actual);
    if ($actual != 0) {
        $metrics['percentage'][] = abs($error) / abs($actual) * 100;
    }
}

function summarizeValidationMetrics(array $metrics): array {
    $count = count($metrics['absolute']);
    $actualTotal = array_sum($metrics['actual']);

    return [
        'mae' => $count ? round(array_sum($metrics['absolute']) / $count, 2) : null,
        'rmse' => $count ? round(sqrt(array_sum($metrics['squared']) / $count), 2) : null,
        'mape' => count($metrics['percentage']) ? round(array_sum($metrics['percentage']) / count($metrics['percentage']), 2) : null,
        'wape' => $actualTotal > 0 ? round(array_sum($metrics['absolute']) / $actualTotal * 100, 2) : null,
        'records' => $count,
    ];
}

/**
 * Fit a straight line (least squares) through the most recent $window values.
 */
function fitTrend(array $values, int $window = 28): array {
    $values = array_values(array_slice($values, -$window));
    $n = count($values);
    if ($n === 0) return ['intercept' => 0, 'slope' => 0, 'n' => 0];
    $meanX = ($n - 1) / 2;
    $meanY = array_sum($values) / $n;
    $num = 0;
    $den = 0;
    foreach ($values as $x => $y) {
        $num += ($x - $meanX) * ($y - $meanY);
        $den += ($x - $meanX) ** 2;
    }
    $slope = $den > 0 ? $num / $den : 0;
    return ['intercept' => $meanY - $slope * $meanX, 'slope' => $slope, 'n' => $n];
}

/**
 * Forecast $h days after the end of the fitted window.
 */
function forecastAt(array $fit, int $h, float $damping = 0.5): float {
    if ($fit['n'] === 0) return 0;
    $endLevel = $fit['intercept'] + $fit['slope'] * ($fit['n'] - 1);
    return max(0, $endLevel + $fit['slope'] * $damping * $h);
}

function forecastSeriesForMethod(string $method, array $values, int $period): array {
    if ($method === 'linear' || count($values) < 7) {
        $fit = fitTrend($values);
        return array_map(
            static fn($day) => round(forecastAt($fit, $day + 1), 2),
            range(0, max(0, $period - 1))
        );
    }

    $recentValues = array_slice($values, -7);
    if ($method === 'moving_average_7') {
        $average = array_sum($recentValues) / count($recentValues);
        return array_fill(0, $period, round($average, 2));
    }

    if ($method === 'yesterday') {
        return array_fill(0, $period, round((float) end($values), 2));
    }

    if ($method === 'same_weekday_last_week') {
        $historyCount = count($values);
        $series = [];
        for ($day = 0; $day < $period; $day++) {
            $series[] = round(max(0, (float) $values[$historyCount - 7 + ($day % 7)]), 2);
        }
        return $series;
    }

    $fit = fitTrend($values);
    return array_map(
        static fn($day) => round(forecastAt($fit, $day + 1), 2),
        range(0, max(0, $period - 1))
    );
}

function selectForecastMethod(array $aggregateMetrics): string {
    $selectedMethod = 'linear';
    $lowestWape = null;

    foreach (['linear', 'moving_average_7', 'same_weekday_last_week', 'yesterday'] as $method) {
        $wape = $aggregateMetrics[$method]['wape'] ?? null;
        $records = (int) ($aggregateMetrics[$method]['records'] ?? 0);
        if ($records === 0 || !is_numeric($wape)) {
            continue;
        }
        if ($lowestWape === null || (float) $wape < $lowestWape) {
            $lowestWape = (float) $wape;
            $selectedMethod = $method;
        }
    }

    return $selectedMethod;
}
