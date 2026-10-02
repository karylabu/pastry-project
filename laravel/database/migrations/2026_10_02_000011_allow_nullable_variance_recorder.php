<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private function recorderConstraint(): ?string
    {
        $constraint = DB::selectOne(
            "SELECT CONSTRAINT_NAME
             FROM information_schema.KEY_COLUMN_USAGE
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'variance'
               AND COLUMN_NAME = 'recorded_by'
               AND REFERENCED_TABLE_NAME = 'users'
             LIMIT 1"
        );

        return $constraint->CONSTRAINT_NAME ?? null;
    }

    public function up(): void
    {
        if (DB::connection()->getDriverName() !== 'mysql'
            || !Schema::hasTable('variance')
            || !Schema::hasColumn('variance', 'recorded_by')) {
            return;
        }

        $constraint = $this->recorderConstraint();
        if ($constraint) {
            DB::statement('ALTER TABLE `variance` DROP FOREIGN KEY `' . str_replace('`', '``', $constraint) . '`');
        }

        DB::statement('ALTER TABLE `variance` MODIFY `recorded_by` INT(11) NULL');

        if ($constraint) {
            DB::statement(
                'ALTER TABLE `variance` ADD CONSTRAINT `' . str_replace('`', '``', $constraint)
                . '` FOREIGN KEY (`recorded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL'
            );
        }
    }

    public function down(): void
    {
        if (DB::connection()->getDriverName() !== 'mysql'
            || !Schema::hasTable('variance')
            || !Schema::hasColumn('variance', 'recorded_by')) {
            return;
        }

        if (DB::table('variance')->whereNull('recorded_by')->exists()) {
            throw new RuntimeException('Cannot require variance.recorded_by while anonymized audit rows exist.');
        }

        $constraint = $this->recorderConstraint();
        if ($constraint) {
            DB::statement('ALTER TABLE `variance` DROP FOREIGN KEY `' . str_replace('`', '``', $constraint) . '`');
        }

        DB::statement('ALTER TABLE `variance` MODIFY `recorded_by` INT(11) NOT NULL');

        if ($constraint) {
            DB::statement(
                'ALTER TABLE `variance` ADD CONSTRAINT `' . str_replace('`', '``', $constraint)
                . '` FOREIGN KEY (`recorded_by`) REFERENCES `users` (`id`)'
            );
        }
    }
};