<?php

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../../includes/predictive_forecasting.php';

class PredictiveForecastingTest extends TestCase
{
    public function test_merges_overlapping_and_adjacent_coverage_without_bridging_unknown_gaps(): void
    {
        $this->assertSame([
            ['start' => '2025-01-01', 'end' => '2025-01-04'],
            ['start' => '2025-01-10', 'end' => '2025-01-12'],
        ], mergeForecastCoverageIntervals([
            ['start' => '2025-01-03', 'end' => '2025-01-04'],
            ['start' => '2025-01-01', 'end' => '2025-01-02'],
            ['start' => '2025-01-10', 'end' => '2025-01-12'],
            ['start' => 'not-a-date', 'end' => '2025-01-20'],
        ]));
    }

    public function test_fills_missing_days_with_zero_only_within_covered_range(): void
    {
        $series = buildCoveredDailySeries(
            ['2025-01-02' => 3, '2025-01-04' => 2],
            '2025-01-01',
            '2025-01-05',
            '2025-01-02'
        );

        $this->assertSame([
            '2025-01-02' => 3.0,
            '2025-01-03' => 0.0,
            '2025-01-04' => 2.0,
            '2025-01-05' => 0.0,
        ], $series);
        $this->assertArrayNotHasKey('2025-01-01', $series);
        $this->assertArrayNotHasKey('2025-01-06', $series);
    }

    public function test_does_not_create_zero_sales_days_for_invalid_coverage(): void
    {
        $this->assertSame([], buildCoveredDailySeries(
            ['2025-01-02' => 3],
            '2025-01-03',
            '2025-01-01'
        ));
    }

    public function test_selects_lowest_shop_total_wape_and_excludes_zero_forecast(): void
    {
        $metrics = [
            'linear' => ['wape' => 97.46, 'records' => 7],
            'zero' => ['wape' => 100.0, 'records' => 7],
            'moving_average_7' => ['wape' => 82.3, 'records' => 7],
            'same_weekday_last_week' => ['wape' => 78.6, 'records' => 7],
            'yesterday' => ['wape' => 91.0, 'records' => 7],
        ];

        $this->assertSame('same_weekday_last_week', selectForecastMethod($metrics));
    }

    public function test_falls_back_to_linear_when_no_holdout_metrics_are_available(): void
    {
        $this->assertSame('linear', selectForecastMethod([
            'linear' => ['wape' => null, 'records' => 0],
            'zero' => ['wape' => 100.0, 'records' => 7],
        ]));
    }

    public function test_selected_methods_generate_their_expected_daily_series(): void
    {
        $history = [1, 2, 3, 4, 5, 6, 7];

        $this->assertSame([1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 1.0, 2.0], forecastSeriesForMethod('same_weekday_last_week', $history, 9));
        $this->assertSame(array_fill(0, 3, 4.0), forecastSeriesForMethod('moving_average_7', $history, 3));
        $this->assertSame(array_fill(0, 3, 7.0), forecastSeriesForMethod('yesterday', $history, 3));
    }
}
