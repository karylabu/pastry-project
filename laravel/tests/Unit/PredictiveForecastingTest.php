<?php

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../../includes/predictive_forecasting.php';

class PredictiveForecastingTest extends TestCase
{
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
