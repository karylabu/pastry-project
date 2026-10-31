<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use RuntimeException;
use Tests\TestCase;

class RemoveMistakenProductionActivityEntryTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::create('admin_activity_logs', function ($table): void {
            $table->id();
            $table->string('actor_name');
            $table->string('actor_email');
            $table->string('actor_role');
            $table->string('action');
            $table->string('category');
            $table->string('subject_id')->nullable();
            $table->string('method');
            $table->string('route');
            $table->string('ip_address');
            $table->unsignedSmallInteger('response_status');
            $table->json('details');
        });
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('admin_activity_logs');
        parent::tearDown();
    }

    public function test_it_removes_only_the_exact_misclassified_production_entry(): void
    {
        $details = json_encode([
            'product_id' => 20,
            'product_size_id' => 74,
            'quantity' => 2,
            'expiry_date' => '2026-11-30',
            'idempotency_key' => '224b609e-212e-4aab-b5a3-3855377acb50',
        ]);
        DB::table('admin_activity_logs')->insert([
            [
                'id' => 1,
                'actor_name' => 'Shop Owner',
                'actor_email' => 'admin@pastry.com',
                'actor_role' => 'admin',
                'action' => 'Created product',
                'category' => 'Products',
                'subject_id' => '20',
                'method' => 'POST',
                'route' => 'api/staff/production',
                'ip_address' => '2001:4455:80eb:4d00:1a8c:8445:b677:2acc',
                'response_status' => 200,
                'details' => $details,
            ],
            [
                'id' => 2,
                'actor_name' => 'Shop Owner',
                'actor_email' => 'admin@pastry.com',
                'actor_role' => 'admin',
                'action' => 'Created product',
                'category' => 'Products',
                'subject_id' => '20',
                'method' => 'POST',
                'route' => 'api/staff/production',
                'ip_address' => '2001:4455:80eb:4d00:1a8c:8445:b677:2acc',
                'response_status' => 200,
                'details' => str_replace('224b609e-212e-4aab-b5a3-3855377acb50', 'another-operation-key', $details),
            ],
            [
                'id' => 3,
                'actor_name' => 'Shop Owner',
                'actor_email' => 'admin@pastry.com',
                'actor_role' => 'admin',
                'action' => 'Stocked in Blueberry Cheesecake',
                'category' => 'Products',
                'subject_id' => '20',
                'method' => 'POST',
                'route' => 'api/staff/production',
                'ip_address' => '2001:4455:80eb:4d00:1a8c:8445:b677:2acc',
                'response_status' => 200,
                'details' => $details,
            ],
        ]);

        $migration = require dirname(__DIR__, 2) . '/database/migrations/2026_10_31_000003_remove_mistaken_production_activity_entry.php';
        $migration->up();

        $this->assertDatabaseMissing('admin_activity_logs', ['id' => 1]);
        $this->assertDatabaseHas('admin_activity_logs', ['id' => 2]);
        $this->assertDatabaseHas('admin_activity_logs', ['id' => 3]);
    }

    public function test_it_refuses_to_delete_when_the_fingerprint_is_not_unique(): void
    {
        $migration = require dirname(__DIR__, 2) . '/database/migrations/2026_10_31_000003_remove_mistaken_production_activity_entry.php';

        try {
            $migration->up();
            $this->fail('The migration should refuse to delete without exactly one match.');
        } catch (RuntimeException $exception) {
            $this->assertStringContainsString('found 0', $exception->getMessage());
        }
    }
}
