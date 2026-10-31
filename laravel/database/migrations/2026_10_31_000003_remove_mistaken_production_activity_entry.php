<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const IDEMPOTENCY_KEY = '224b609e-212e-4aab-b5a3-3855377acb50';

    public function up(): void
    {
        if (!Schema::hasTable('admin_activity_logs')) {
            throw new \RuntimeException('Cannot remove the identified activity because the audit log table is missing.');
        }

        $matchingLogs = DB::table('admin_activity_logs')
            ->where('action', 'Created product')
            ->where('category', 'Products')
            ->where('actor_name', 'Shop Owner')
            ->where('actor_email', 'admin@pastry.com')
            ->where('actor_role', 'admin')
            ->where('subject_id', '20')
            ->where('method', 'POST')
            ->where('route', 'like', '%staff/production%')
            ->where('ip_address', '2001:4455:80eb:4d00:1a8c:8445:b677:2acc')
            ->where('response_status', 200)
            ->whereRaw('CAST(details AS CHAR) LIKE ?', ['%' . self::IDEMPOTENCY_KEY . '%']);
        $matchingCount = $matchingLogs->count();

        if ($matchingCount !== 1) {
            throw new \RuntimeException("Expected exactly one identified activity log to remove; found {$matchingCount}.");
        }

        $matchingLogs->delete();
    }

    public function down(): void
    {
        throw new \RuntimeException('The targeted audit log deletion cannot be reversed.');
    }
};
