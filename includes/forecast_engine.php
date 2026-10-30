<?php
/*
| Forecast engine used by admin/api/api_predictive_analytics.php.
|
| Why this file exists
| --------------------
| The same forecasting functions are used for BOTH the production forecast and the
| validation backtest, so the accuracy numbers shown in the dashboard describe exactly
| what the forecast does. (Before, validation used inline formulas that could drift
| away from the forecast.)
|
| Validation is a rolling-origin backtest: the model is "re-run" at many past dates and
| scored on the days that followed. A single 7-day holdout is far too noisy to pick a
| method with (see the notes at the bottom of this file).
|
| Everything is prefixed fe_ so it cannot clash with includes/predictive_forecasting.php,
| which is still used for coverage helpers (mergeForecastCoverageIntervals,
| buildCoveredDailySeries).
*/

if (!defined('FE_VALIDATION_METHODS')) {
    // 'zero' is a comparison-only baseline and is never selected for production.
    define('FE_VALIDATION_METHODS', ['linear', 'zero', 'yesterday', 'same_weekday_last_week', 'moving_average_7', 'moving_average_28']);
    define('FE_PREFERRED_METHOD', 'moving_average_28');
    define('FE_BACKTEST_MAX_FOLDS', 12);
    define('FE_BACKTEST_STEP_DAYS', 7);
    define('FE_BACKTEST_MIN_TRAIN_DAYS', 28);
    define('FE_LINEAR_WINDOW_DAYS', 28);
    define('FE_LINEAR_DAMPING', 0.9);
}

// ---------------------------------------------------------------------------
// Forecast methods
// ---------------------------------------------------------------------------

function fe_mean_of_last(array $values, int $days): float
{
    $window = array_slice($values, -$days);
    return count($window) ? array_sum($window) / count($window) : 0.0;
}

function fe_linear_forecast(array $values, int $horizon): array
{
    $window = array_values(array_slice($values, -FE_LINEAR_WINDOW_DAYS));
    $w = count($window);
    if ($w < 3) {
        return array_fill(0, $horizon, max(0.0, fe_mean_of_last($values, 7)));
    }

    $sumX = $w * ($w - 1) / 2;
    $sumXX = ($w - 1) * $w * (2 * $w - 1) / 6;
    $sumY = array_sum($window);
    $sumXY = 0.0;
    foreach ($window as $i => $y) {
        $sumXY += $i * $y;
    }
    $den = $w * $sumXX - $sumX * $sumX;
    $slope = $den != 0 ? ($w * $sumXY - $sumX * $sumY) / $den : 0.0;
    $intercept = ($sumY - $slope * $sumX) / $w;
    $level = $intercept + $slope * ($w - 1);

    $out = [];
    $cumulativeDamping = 0.0;
    for ($h = 1; $h <= $horizon; $h++) {
        $cumulativeDamping += pow(FE_LINEAR_DAMPING, $h);
        $out[] = max(0.0, $level + $slope * $cumulativeDamping);
    }
    return $out;
}

/**
 * @param float[] $values chronological daily units (continuous, zero-filled inside coverage)
 * @return float[] $horizon forecast values, never negative
 */
function fe_forecast(string $method, array $values, int $horizon): array
{
    $values = array_values(array_map('floatval', $values));
    $n = count($values);
    if ($horizon < 1) return [];
    if ($n === 0 || $method === 'zero') return array_fill(0, $horizon, 0.0);

    switch ($method) {
        case 'yesterday':
            return array_fill(0, $horizon, max(0.0, $values[$n - 1]));
        case 'moving_average_7':
            return array_fill(0, $horizon, max(0.0, fe_mean_of_last($values, 7)));
        case 'moving_average_28':
            return array_fill(0, $horizon, max(0.0, fe_mean_of_last($values, 28)));
        case 'same_weekday_last_week':
            if ($n < 7) {
                return array_fill(0, $horizon, max(0.0, $values[$n - 1]));
            }
            $out = [];
            for ($h = 0; $h < $horizon; $h++) {
                $out[] = max(0.0, $values[$n - 7 + ($h % 7)]);
            }
            return $out;
        case 'linear':
        default:
            return fe_linear_forecast($values, $horizon);
    }
}

// ---------------------------------------------------------------------------
// Error metrics
// ---------------------------------------------------------------------------

function fe_metrics_new(): array
{
    return ['n' => 0, 'sum_actual' => 0.0, 'sum_abs' => 0.0, 'sum_sq' => 0.0, 'sum_err' => 0.0, 'ape_n' => 0, 'sum_ape' => 0.0];
}

function fe_metrics_record(array &$m, float $actual, float $predicted): void
{
    $error = $predicted - $actual;           // positive = over-forecast
    $m['n']++;
    $m['sum_actual'] += $actual;
    $m['sum_abs'] += abs($error);
    $m['sum_sq'] += $error * $error;
    $m['sum_err'] += $error;
    if ($actual > 0) {                        // MAPE is undefined on zero-sales days
        $m['ape_n']++;
        $m['sum_ape'] += abs($error) / $actual;
    }
}

/**
 * MAE   average absolute miss per day (units)
 * RMSE  like MAE but punishes large misses more (units)
 * MAPE  average % miss, only on days that had sales (noisy for slow products)
 * WAPE  total absolute error / total actual sales (%), robust and the one used to pick the method
 * Bias  signed total error / total actual (%); + means the method over-forecasts
 */
function fe_metrics_summarize(array $m): array
{
    if ($m['n'] <= 0) {
        return ['mae' => null, 'rmse' => null, 'mape' => null, 'wape' => null, 'bias' => null, 'records' => 0];
    }
    return [
        'mae' => round($m['sum_abs'] / $m['n'], 2),
        'rmse' => round(sqrt($m['sum_sq'] / $m['n']), 2),
        'mape' => $m['ape_n'] > 0 ? round(100 * $m['sum_ape'] / $m['ape_n'], 2) : null,
        'wape' => $m['sum_actual'] > 0 ? round(100 * $m['sum_abs'] / $m['sum_actual'], 2) : null,
        'bias' => $m['sum_actual'] > 0 ? round(100 * $m['sum_err'] / $m['sum_actual'], 2) : null,
        'records' => (int) $m['n'],
    ];
}

/**
 * Keeps the production forecast on the configured method; backtest metrics remain for comparison.
 */
function fe_select_method(array $aggregateMetrics): string
{
    return FE_PREFERRED_METHOD;
}

// ---------------------------------------------------------------------------
// Rolling-origin backtest
// ---------------------------------------------------------------------------

/**
 * @param array<string, array<string,float>> $seriesByProduct product key => [Y-m-d => units] (continuous coverage)
 * @param int $horizon days predicted at each origin (the dashboard's selected period)
 * @return array{aggregate: array, product: array, folds: int, evaluated: int, insufficient: int, inactive: int, horizon: int}
 */
function fe_run_backtest(array $seriesByProduct, int $horizon): array
{
    $empty = static function () use ($horizon): array {
        $summaries = [];
        foreach (FE_VALIDATION_METHODS as $method) {
            $summaries[$method] = fe_metrics_summarize(fe_metrics_new());
        }
        return $summaries;
    };
    $result = [
        'aggregate' => [], 'product' => [], 'folds' => 0, 'evaluated' => 0,
        'insufficient' => count($seriesByProduct), 'inactive' => 0, 'horizon' => $horizon,
    ];

    $dateSet = [];
    foreach ($seriesByProduct as $daily) {
        foreach ($daily as $date => $_) $dateSet[$date] = true;
    }
    $dates = array_keys($dateSet);
    sort($dates);
    $total = count($dates);
    if ($total === 0) {
        $result['aggregate'] = $empty();
        $result['product'] = $empty();
        return $result;
    }
    $dateIndex = array_flip($dates);

    $minTrain = min(FE_BACKTEST_MIN_TRAIN_DAYS, max(7, (int) floor(($total - $horizon) / 2)));
    $origins = [];
    for ($o = $total - $horizon; $o >= $minTrain && count($origins) < FE_BACKTEST_MAX_FOLDS; $o -= FE_BACKTEST_STEP_DAYS) {
        $origins[] = $o;
    }
    if (!$origins) {
        $result['aggregate'] = $empty();
        $result['product'] = $empty();
        return $result;
    }

    // Align every product to the shared date axis.
    $aligned = [];
    $firstIndex = [];
    foreach ($seriesByProduct as $key => $daily) {
        $row = array_fill(0, $total, 0.0);
        $first = null;
        foreach ($daily as $date => $qty) {
            $i = $dateIndex[$date];
            $row[$i] = (float) $qty;
            if ($first === null || $i < $first) $first = $i;
        }
        $aligned[$key] = $row;
        $firstIndex[$key] = $first ?? $total;
    }

    $productMetrics = [];
    $aggregateMetrics = [];
    foreach (FE_VALIDATION_METHODS as $method) {
        $productMetrics[$method] = fe_metrics_new();
        $aggregateMetrics[$method] = fe_metrics_new();
    }
    $evaluated = [];
    $sawEnoughHistory = [];

    foreach ($origins as $origin) {
        $shopActual = array_fill(0, $horizon, 0.0);
        $shopPredicted = [];
        foreach (FE_VALIDATION_METHODS as $method) {
            $shopPredicted[$method] = array_fill(0, $horizon, 0.0);
        }
        $foldHasData = false;

        foreach ($aligned as $key => $row) {
            $train = array_slice($row, $firstIndex[$key], max(0, $origin - $firstIndex[$key]));
            if (count($train) < 2) continue;                 // product did not exist long enough at this origin
            $sawEnoughHistory[$key] = true;

            $actual = array_slice($row, $origin, $horizon);
            $isActive = array_sum(array_slice($train, -28)) > 0 || array_sum($actual) > 0;
            if (!$isActive) continue;

            $evaluated[$key] = true;
            $foldHasData = true;
            foreach (FE_VALIDATION_METHODS as $method) {
                $predicted = fe_forecast($method, $train, $horizon);
                for ($i = 0; $i < $horizon; $i++) {
                    fe_metrics_record($productMetrics[$method], $actual[$i], $predicted[$i]);
                    $shopPredicted[$method][$i] += $predicted[$i];
                }
            }
            for ($i = 0; $i < $horizon; $i++) {
                $shopActual[$i] += $actual[$i];
            }
        }

        if (!$foldHasData) continue;
        $result['folds']++;
        foreach (FE_VALIDATION_METHODS as $method) {
            for ($i = 0; $i < $horizon; $i++) {
                fe_metrics_record($aggregateMetrics[$method], $shopActual[$i], $shopPredicted[$method][$i]);
            }
        }
    }

    foreach (FE_VALIDATION_METHODS as $method) {
        $result['aggregate'][$method] = fe_metrics_summarize($aggregateMetrics[$method]);
        $result['product'][$method] = fe_metrics_summarize($productMetrics[$method]);
    }
    $result['evaluated'] = count($evaluated);
    $result['inactive'] = count(array_diff_key($sawEnoughHistory, $evaluated));
    $result['insufficient'] = max(0, count($seriesByProduct) - count($sawEnoughHistory));
    return $result;
}

/*
| NOTES ON WHAT THE BACKTEST SHOWS FOR sales_2020-2022
|
| * Daily shop sales are ~16.5 units with a standard deviation of ~3. There is no weekday,
|   monthly or yearly pattern and no day-to-day correlation (autocorrelation ~ 0).
| * For data like that the best forecast is a long average. "Yesterday" and "same weekday
|   last week" copy one noisy day and are ~35% worse; a damped trend chases noise.
| * Even a perfect model cannot get shop-level WAPE much below ~15% on this data, because
|   the day-to-day randomness itself is that large.
| * Individual products sell ~1-2 units a day, so their daily WAPE is ~85% for every method.
|   That is a property of the data, not a bug; judge per-product forecasts by the weekly/period
|   total, not by single days.
*/
