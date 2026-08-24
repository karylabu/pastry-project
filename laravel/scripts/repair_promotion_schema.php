<?php

use Illuminate\Support\Facades\DB;

require __DIR__ . '/../vendor/autoload.php';
$app = require __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

try {
    DB::statement('ALTER TABLE promotions MODIFY id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT');
    echo "promotions.id altered\n";
} catch (Throwable $e) {
    echo "promotions alter error: " . $e->getMessage() . "\n";
}

try {
    DB::statement('ALTER TABLE promotion_email_logs ADD CONSTRAINT promotion_email_logs_promotion_id_foreign FOREIGN KEY (promotion_id) REFERENCES promotions(id) ON DELETE CASCADE');
    echo "foreign key added\n";
} catch (Throwable $e) {
    echo "FK add error: " . $e->getMessage() . "\n";
}

try {
    if (!DB::table('migrations')->where('migration', '2026_07_19_000002_create_promotions_table')->exists()) {
        DB::table('migrations')->insert(['migration' => '2026_07_19_000002_create_promotions_table', 'batch' => 2]);
        echo "inserted 000002\n";
    } else {
        echo "000002 exists\n";
    }
    if (!DB::table('migrations')->where('migration', '2026_07_19_000003_create_promotion_email_logs_table')->exists()) {
        DB::table('migrations')->insert(['migration' => '2026_07_19_000003_create_promotion_email_logs_table', 'batch' => 2]);
        echo "inserted 000003\n";
    } else {
        echo "000003 exists\n";
    }
} catch (Throwable $e) {
    echo "migration table update error: " . $e->getMessage() . "\n";
}
