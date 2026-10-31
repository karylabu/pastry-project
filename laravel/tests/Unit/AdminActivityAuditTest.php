<?php

namespace Tests\Unit;

use App\Services\AdminActivityAuditService;
use Illuminate\Http\Request;
use PHPUnit\Framework\TestCase;

class AdminActivityAuditTest extends TestCase
{
    /**
     * @dataProvider excludedActivities
     */
    public function test_it_excludes_login_and_recipe_sync_activity(string $uri): void
    {
        $request = Request::create('/' . $uri, 'POST');
        $service = new AdminActivityAuditService();

        $this->assertTrue($service->shouldExclude($request));
    }

    /**
     * @dataProvider includedActivities
     */
    public function test_it_keeps_other_mutations_in_the_audit_trail(string $uri): void
    {
        $request = Request::create('/' . $uri, 'POST');
        $service = new AdminActivityAuditService();

        $this->assertFalse($service->shouldExclude($request));
    }

    public static function excludedActivities(): array
    {
        return [
            'API login' => ['api/login'],
            'staff login' => ['staff/login'],
            'recipe sync' => ['api/staff/ingredients/sync-recipes'],
        ];
    }

    public static function includedActivities(): array
    {
        return [
            'product stock' => ['api/admin/stock/mutate'],
            'ingredient update' => ['api/staff/ingredients/42'],
            'order status' => ['api/staff/orders/42/status'],
        ];
    }
}
