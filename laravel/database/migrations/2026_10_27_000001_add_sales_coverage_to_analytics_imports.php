<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('analytics_imports')) {
            return;
        }

        Schema::table('analytics_imports', function (Blueprint $table) {
            if (!Schema::hasColumn('analytics_imports', 'coverage_start_date')) {
                $table->date('coverage_start_date')->nullable();
            }
            if (!Schema::hasColumn('analytics_imports', 'coverage_end_date')) {
                $table->date('coverage_end_date')->nullable();
            }
        });

        if (!Schema::hasTable('analytics_sales_history')) {
            return;
        }

        $coverageRows = DB::table('analytics_sales_history')
            ->select('import_id')
            ->selectRaw('MIN(sale_date) AS coverage_start_date')
            ->selectRaw('MAX(sale_date) AS coverage_end_date')
            ->whereNotNull('import_id')
            ->groupBy('import_id')
            ->get();

        foreach ($coverageRows as $coverage) {
            DB::table('analytics_imports')
                ->where('id', $coverage->import_id)
                ->where('status', 'completed')
                ->whereNull('coverage_start_date')
                ->update([
                    'coverage_start_date' => $coverage->coverage_start_date,
                    'coverage_end_date' => $coverage->coverage_end_date,
                ]);
        }
    }

    public function down(): void
    {
        if (!Schema::hasTable('analytics_imports')) {
            return;
        }

        $columns = [];
        if (Schema::hasColumn('analytics_imports', 'coverage_start_date')) {
            $columns[] = 'coverage_start_date';
        }
        if (Schema::hasColumn('analytics_imports', 'coverage_end_date')) {
            $columns[] = 'coverage_end_date';
        }
        if ($columns) {
            Schema::table('analytics_imports', function (Blueprint $table) use ($columns) {
                $table->dropColumn($columns);
            });
        }
    }
};
