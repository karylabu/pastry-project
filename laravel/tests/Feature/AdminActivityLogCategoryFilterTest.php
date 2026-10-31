<?php

namespace Tests\Feature;

use App\Http\Middleware\AuditAdminActivity;
use App\Http\Middleware\TrustProxies;
use App\Models\User;
use App\Services\AdminActivityAuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class AdminActivityLogCategoryFilterTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::create('users', function ($table): void {
            $table->id();
            $table->string('name');
            $table->string('email');
            $table->string('password');
            $table->string('role');
        });
        Schema::create('user_sessions', function ($table): void {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->string('token');
            $table->timestamp('expires_at')->nullable();
        });
        Schema::create('admin_activity_logs', function ($table): void {
            $table->id();
            $table->unsignedBigInteger('actor_id')->nullable();
            $table->string('actor_name');
            $table->string('actor_email');
            $table->string('actor_role');
            $table->string('action');
            $table->string('category');
            $table->string('subject_type')->nullable();
            $table->string('subject_id')->nullable();
            $table->string('method');
            $table->text('route');
            $table->string('ip_address')->nullable();
            $table->text('user_agent')->nullable();
            $table->unsignedSmallInteger('response_status');
            $table->json('details')->nullable();
            $table->timestamps();
        });
        Schema::create('products', function ($table): void {
            $table->id();
            $table->string('name');
            $table->decimal('price', 8, 2)->default(0);
            $table->integer('stock')->default(0);
        });
        Schema::create('product_sizes', function ($table): void {
            $table->id();
            $table->unsignedBigInteger('product_id');
            $table->string('size');
            $table->integer('stock_quantity')->default(0);
        });
        Schema::create('ingredients', function ($table): void {
            $table->id();
            $table->string('name');
            $table->string('unit');
            $table->integer('stock')->default(0);
            $table->decimal('unit_cost', 8, 2)->default(0);
            $table->integer('threshold')->default(0);
            $table->date('expiry')->nullable();
            $table->softDeletes();
        });
        Schema::create('ingredient_batches', function ($table): void {
            $table->id();
            $table->unsignedBigInteger('ingredient_id');
            $table->decimal('quantity_remaining', 10, 3)->default(0);
        });
        Schema::create('discard_requests', function ($table): void {
            $table->id();
            $table->unsignedBigInteger('ingredient_id');
            $table->unsignedBigInteger('ingredient_batch_id')->nullable();
            $table->decimal('quantity', 10, 3);
            $table->string('reason');
            $table->text('notes')->nullable();
            $table->string('status');
            $table->unsignedBigInteger('requested_by')->nullable();
            $table->unsignedBigInteger('approved_by')->nullable();
            $table->unsignedBigInteger('rejected_by')->nullable();
            $table->text('rejection_note')->nullable();
        });
        Schema::create('waste_log', function ($table): void {
            $table->id();
            $table->dateTime('datetime');
            $table->string('item');
            $table->decimal('qty', 10, 3);
            $table->decimal('unit_cost', 10, 2)->default(0);
            $table->string('item_type')->default('Raw Material');
            $table->string('reason');
            $table->unsignedBigInteger('ingredient_id')->nullable();
            $table->unsignedBigInteger('product_id')->nullable();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('reference_type')->nullable();
            $table->unsignedBigInteger('reference_id')->nullable();
            $table->unsignedBigInteger('ingredient_batch_id')->nullable();
            $table->unsignedBigInteger('discard_request_id')->nullable();
            $table->string('unit')->nullable();
        });
        Schema::create('product_recipes', function ($table): void {
            $table->id();
            $table->unsignedBigInteger('product_id');
            $table->unsignedBigInteger('product_size_id');
            $table->unsignedBigInteger('ingredient_id');
            $table->decimal('qty', 10, 3);
            $table->string('unit');
            $table->boolean('active')->default(true);
        });
        Schema::create('orders', function ($table): void {
            $table->id();
            $table->string('order_number');
            $table->string('status');
            $table->string('payment_status')->nullable();
            $table->decimal('total', 10, 2)->default(0);
            $table->string('method')->nullable();
            $table->string('customer')->nullable();
            $table->string('email')->nullable();
            $table->date('delivery_date')->nullable();
        });
        Schema::create('customized_cake_orders', function ($table): void {
            $table->id();
            $table->unsignedBigInteger('order_id');
            $table->string('cake_type');
            $table->string('status');
            $table->text('notes')->nullable();
        });
        Schema::create('custom_cake_request_settings', function ($table): void {
            $table->id();
            $table->boolean('enabled');
        });
        Schema::create('shop_settings', function ($table): void {
            $table->unsignedTinyInteger('id')->primary();
            $table->json('settings');
        });
        Schema::create('admin_notification_preferences', function ($table): void {
            $table->unsignedBigInteger('user_id')->primary();
            $table->boolean('order_alerts')->default(true);
            $table->boolean('low_stock_alerts')->default(true);
            $table->boolean('message_alerts')->default(true);
            $table->boolean('promotion_alerts')->default(true);
        });
        Schema::create('admin_recycle_bin', function ($table): void {
            $table->id();
            $table->string('item_type');
            $table->string('label');
            $table->text('payload');
            $table->timestamp('deleted_at');
            $table->timestamp('expires_at');
        });
        Schema::create('cake_flavors', function ($table): void {
            $table->id();
            $table->string('name');
            $table->boolean('active')->default(true);
        });
        Schema::create('cake_sizes', function ($table): void {
            $table->id();
            $table->string('code');
            $table->string('label');
            $table->decimal('multiplier', 10, 3)->default(1);
            $table->boolean('active')->default(true);
        });
        Schema::create('cake_recipes', function ($table): void {
            $table->id();
            $table->unsignedBigInteger('flavor_id');
            $table->unsignedBigInteger('base_size_id');
            $table->boolean('active')->default(true);
        });
        Schema::create('cake_recipe_ingredients', function ($table): void {
            $table->id();
            $table->unsignedBigInteger('recipe_id');
            $table->unsignedBigInteger('ingredient_id');
            $table->decimal('quantity', 10, 3);
            $table->string('unit');
        });

        DB::table('users')->insert([
            'id' => 1,
            'name' => 'Shop Owner',
            'email' => 'owner@example.com',
            'password' => 'unused',
            'role' => 'super_admin',
        ]);
        DB::table('user_sessions')->insert([
            'user_id' => 1,
            'token' => 'owner-token',
            'expires_at' => now()->addHour(),
        ]);
        DB::table('products')->insert(['id' => 1, 'name' => 'Blueberry', 'price' => 10, 'stock' => 7]);
        DB::table('product_sizes')->insert(['id' => 2, 'product_id' => 1, 'size' => 'Big', 'stock_quantity' => 7]);
        DB::table('ingredients')->insert(['id' => 1, 'name' => 'Flour', 'unit' => 'kg', 'stock' => 10, 'unit_cost' => 5, 'threshold' => 2]);
        DB::table('ingredient_batches')->insert(['id' => 1, 'ingredient_id' => 1, 'quantity_remaining' => 10]);
        DB::table('product_recipes')->insert(['id' => 1, 'product_id' => 1, 'product_size_id' => 2, 'ingredient_id' => 1, 'qty' => 1, 'unit' => 'kg']);
        DB::table('orders')->insert(['id' => 1, 'order_number' => 'ORD-100', 'status' => 'Pending', 'payment_status' => 'unpaid', 'total' => 25]);
        DB::table('customized_cake_orders')->insert(['id' => 1, 'order_id' => 1, 'cake_type' => 'single', 'status' => 'pending']);
        DB::table('custom_cake_request_settings')->insert(['id' => 1, 'enabled' => true]);
        DB::table('shop_settings')->insert(['id' => 1, 'settings' => json_encode(['shopName' => 'Pastry Shop', 'minimumOrder' => '0'])]);
        DB::table('admin_notification_preferences')->insert(['user_id' => 1]);
        DB::table('cake_flavors')->insert(['id' => 1, 'name' => 'Chocolate', 'active' => true]);
        DB::table('cake_sizes')->insert(['id' => 1, 'code' => '6x3', 'label' => '6 x 3 inch', 'multiplier' => 1, 'active' => true]);

        $now = now();
        foreach ([
            ['Products', 'api/staff/products'],
            ['Ingredients', 'api/staff/ingredients'],
            ['Recipe', 'api/staff/products/1/recipe'],
            ['Orders', 'api/staff/orders/1/status'],
            ['Custom Cake', 'api/staff/customized-cakes/request-status'],
            ['Inventory', 'api/staff/ingredients/1/adjust-stock'],
            ['Products', 'api/staff/customized-cakes/recipes'],
            ['Custom cakes', 'api/staff/customized-cakes/request-status'],
            ['Users', 'api/admin-management/users'],
            ['Promotions', 'api/admin/promotions'],
        ] as [$category, $route]) {
            DB::table('admin_activity_logs')->insert([
                'actor_name' => 'Admin',
                'actor_email' => 'admin@example.com',
                'actor_role' => 'admin',
                'action' => 'Test activity',
                'category' => $category,
                'method' => 'POST',
                'route' => $route,
                'response_status' => 200,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        foreach ([
            ['System', 'api/login'],
            ['Products', 'api/staff/ingredients/sync-recipes'],
        ] as [$category, $route]) {
            DB::table('admin_activity_logs')->insert([
                'actor_name' => 'Shop Owner',
                'actor_email' => 'owner@example.com',
                'actor_role' => 'super_admin',
                'action' => $route === 'api/login' ? 'Created Login' : 'Synchronized product',
                'category' => $category,
                'method' => 'POST',
                'route' => $route,
                'response_status' => 200,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('admin_activity_logs');
        Schema::dropIfExists('admin_recycle_bin');
        Schema::dropIfExists('admin_notification_preferences');
        Schema::dropIfExists('shop_settings');
        Schema::dropIfExists('cake_recipe_ingredients');
        Schema::dropIfExists('cake_recipes');
        Schema::dropIfExists('cake_sizes');
        Schema::dropIfExists('cake_flavors');
        Schema::dropIfExists('custom_cake_request_settings');
        Schema::dropIfExists('customized_cake_orders');
        Schema::dropIfExists('orders');
        Schema::dropIfExists('product_recipes');
        Schema::dropIfExists('product_sizes');
        Schema::dropIfExists('products');
        Schema::dropIfExists('ingredient_batches');
        Schema::dropIfExists('waste_log');
        Schema::dropIfExists('discard_requests');
        Schema::dropIfExists('ingredients');
        Schema::dropIfExists('user_sessions');
        Schema::dropIfExists('users');

        parent::tearDown();
    }

    public function test_super_admin_can_filter_activity_by_all_seven_categories(): void
    {
        $expectedTotals = [
            'Products' => 1,
            'Ingredients' => 2,
            'Recipe' => 2,
            'Orders' => 1,
            'Custom Cake' => 2,
            'Promotions' => 1,
            'Users' => 1,
        ];

        foreach ($expectedTotals as $category => $total) {
            $this->withHeader('X-Auth-Token', 'owner-token')
                ->getJson('http://localhost/api/admin-management/activity-logs?category=' . urlencode($category))
                ->assertOk()
                ->assertJsonPath('pagination.total', $total);
        }
    }

    public function test_login_and_recipe_sync_entries_are_hidden_from_the_audit_trail(): void
    {
        $this->withHeader('X-Auth-Token', 'owner-token')
            ->getJson('http://localhost/api/admin-management/activity-logs')
            ->assertOk()
            ->assertJsonPath('pagination.total', 10)
            ->assertJsonMissing(['action' => 'Created Login'])
            ->assertJsonMissing(['action' => 'Synchronized product']);
    }

    public function test_activity_logs_support_safe_sorting_and_requested_page_size(): void
    {
        DB::table('admin_activity_logs')->insert([
            [
                'actor_name' => 'Admin',
                'actor_email' => 'admin@example.com',
                'actor_role' => 'admin',
                'action' => 'Zulu operation',
                'category' => 'Products',
                'method' => 'POST',
                'route' => 'api/staff/products',
                'response_status' => 200,
                'created_at' => '2027-01-02 10:00:00',
                'updated_at' => '2027-01-02 10:00:00',
            ],
            [
                'actor_name' => 'Admin',
                'actor_email' => 'admin@example.com',
                'actor_role' => 'admin',
                'action' => 'Alpha operation',
                'category' => 'Products',
                'method' => 'POST',
                'route' => 'api/staff/products',
                'response_status' => 200,
                'created_at' => '2027-01-01 10:00:00',
                'updated_at' => '2027-01-01 10:00:00',
            ],
        ]);

        $this->withHeader('X-Auth-Token', 'owner-token')
            ->getJson('http://localhost/api/admin-management/activity-logs?sort_by=action&sort_direction=asc&per_page=10')
            ->assertOk()
            ->assertJsonPath('pagination.per_page', 10)
            ->assertJsonPath('data.0.action', 'Alpha operation');

        $this->withHeader('X-Auth-Token', 'owner-token')
            ->getJson('http://localhost/api/admin-management/activity-logs?sort_by=timestamp&sort_direction=desc&per_page=1')
            ->assertOk()
            ->assertJsonPath('pagination.per_page', 1)
            ->assertJsonPath('data.0.action', 'Zulu operation');
    }

    public function test_production_activity_names_the_product_and_stock_change(): void
    {
        $request = Request::create('http://localhost/api/staff/production', 'POST', [
            'product_id' => 1,
            'product_size_id' => 2,
            'quantity' => 5,
            'expiry_date' => '2026-11-30',
        ]);
        $request->headers->set('X-Auth-Token', 'owner-token');
        $request->setRouteResolver(static fn () => new class {
            public function uri(): string { return 'api/staff/production'; }
            public function parameters(): array { return []; }
        });
        $response = app(AuditAdminActivity::class)->handle($request, static function () {
            DB::table('products')->where('id', 1)->update(['stock' => 12]);
            DB::table('product_sizes')->where('id', 2)->update(['stock_quantity' => 12]);

            return new JsonResponse(['status' => 'success', 'size_stock' => 12]);
        });

        $log = DB::table('admin_activity_logs')->where('action', 'Added 5 Blueberry (Big) to stock')->first();
        $this->assertNotNull($log);
        $this->assertSame([
            'Product' => 'Blueberry',
            'Quantity added' => 5,
            'Size' => 'Big',
            'Expiry date' => '2026-11-30',
            'Previous stock' => 7,
            'New stock' => 12,
        ], json_decode($log->details, true));
        $this->assertSame('super_admin', $log->actor_role);
        $this->assertSame(1, (int) $log->actor_id);
        $this->assertSame('Shop Owner', $log->actor_name);
        $this->assertSame(200, (int) $log->response_status);
        $this->assertSame('127.0.0.1', $log->ip_address);
        $this->assertSame(200, $response->getStatusCode());
    }

    public function test_product_update_records_the_changed_values(): void
    {
        $request = Request::create('http://localhost/api/staff/products/1', 'POST', [
            'name' => 'Blueberry Supreme',
            'price' => 12,
        ]);
        $request->setRouteResolver(static fn () => new class {
            public function uri(): string { return 'api/staff/products/{product}'; }
            public function parameters(): array { return ['product' => 1]; }
        });
        $audit = app(AdminActivityAuditService::class);
        $before = $audit->captureBefore($request);
        DB::table('products')->where('id', 1)->update(['name' => 'Blueberry Supreme', 'price' => 12]);
        $audit->record(
            $request,
            new JsonResponse(['success' => true]),
            User::findOrFail(1),
            $before
        );

        $log = DB::table('admin_activity_logs')->where('action', 'Updated Blueberry Supreme')->first();
        $this->assertNotNull($log);
        $details = json_decode($log->details, true);
        $this->assertSame(['Before' => 'Blueberry', 'After' => 'Blueberry Supreme'], $details['Changes']['product']['name']);
        $this->assertSame(10.0, (float) $details['Changes']['product']['price']['Before']);
        $this->assertSame(12.0, (float) $details['Changes']['product']['price']['After']);
    }

    public function test_product_creation_is_audited_with_its_record_name(): void
    {
        $request = Request::create('http://localhost/api/staff/products', 'POST', [
            'name' => 'Blueberry Muffin',
            'price' => 8,
        ]);
        $request->setRouteResolver(static fn () => new class {
            public function uri(): string { return 'api/staff/products'; }
            public function parameters(): array { return []; }
        });
        $audit = app(AdminActivityAuditService::class);
        $before = $audit->captureBefore($request);
        DB::table('products')->insert(['id' => 3, 'name' => 'Blueberry Muffin', 'price' => 8, 'stock' => 0]);
        $audit->record(
            $request,
            new JsonResponse(['success' => true, 'data' => ['id' => 3]], 201),
            User::findOrFail(1),
            $before
        );

        $log = DB::table('admin_activity_logs')->where('action', 'Added Blueberry Muffin')->first();
        $this->assertNotNull($log);
        $this->assertSame('3', $log->subject_id);
    }

    public function test_product_stock_in_and_out_record_quantity_and_stock_totals(): void
    {
        $audit = app(AdminActivityAuditService::class);
        $actor = User::findOrFail(1);
        foreach ([
            ['stock_in', 4, 7, 11],
            ['stock_out', 3, 11, 8],
        ] as [$action, $quantity, $previous, $current]) {
            $request = Request::create('http://localhost/api/admin/stock/mutate', 'POST', [
                'product_size_id' => 2,
                'action_type' => $action,
                'quantity' => $quantity,
            ]);
            $request->setRouteResolver(static fn () => new class {
                public function uri(): string { return 'api/admin/stock/mutate'; }
                public function parameters(): array { return []; }
            });
            $before = $audit->captureBefore($request);
            DB::table('product_sizes')->where('id', 2)->update(['stock_quantity' => $current]);
            $audit->record(
                $request,
                new JsonResponse(['success' => true, 'new_stock' => $current]),
                $actor,
                $before
            );
            $actionLabel = $action === 'stock_in' ? 'Stocked in' : 'Stocked out';
            $log = DB::table('admin_activity_logs')->where('action', $actionLabel . ' Blueberry')->first();
            $this->assertNotNull($log);
            $details = json_decode($log->details, true);
            $this->assertSame($quantity, $details[$action === 'stock_in' ? 'Quantity added' : 'Quantity removed']);
            $this->assertSame($previous, $details['Previous stock']);
            $this->assertSame($current, $details['New stock']);
            $this->assertSame('Big', $details['Size']);
        }
    }

    public function test_ingredient_stock_changes_are_recorded_with_readable_totals(): void
    {
        $request = Request::create('http://localhost/api/staff/ingredients/1/adjust-stock', 'POST', [
            'action' => 'stock_in',
            'qty' => 2.5,
            'note' => 'Supplier delivery',
        ]);
        $request->setRouteResolver(static fn () => new class {
            public function uri(): string { return 'api/staff/ingredients/{ingredient}/adjust-stock'; }
            public function parameters(): array { return ['ingredient' => 1]; }
        });
        $audit = app(AdminActivityAuditService::class);
        $before = $audit->captureBefore($request);
        DB::table('ingredient_batches')->where('id', 1)->update(['quantity_remaining' => 12.5]);
        $audit->record(
            $request,
            new JsonResponse(['success' => true, 'ingredient' => ['stock' => 12.5]]),
            User::findOrFail(1),
            $before
        );

        $log = DB::table('admin_activity_logs')->where('action', 'Stocked in Flour')->first();
        $this->assertNotNull($log);
        $details = json_decode($log->details, true);
        $this->assertSame(2.5, $details['Quantity added']);
        $this->assertSame(10, $details['Previous stock']);
        $this->assertSame(12.5, $details['New stock']);
        $this->assertSame('Supplier delivery', $details['Reason']);
    }

    public function test_product_recipe_changes_are_recorded(): void
    {
        $request = Request::create('http://localhost/api/staff/products/1/recipe', 'PUT', [
            'product_size_id' => 2,
        ]);
        $request->setRouteResolver(static fn () => new class {
            public function uri(): string { return 'api/staff/products/{product}/recipe'; }
            public function parameters(): array { return ['product' => 1]; }
        });
        $audit = app(AdminActivityAuditService::class);
        $before = $audit->captureBefore($request);
        DB::table('product_recipes')->where('id', 1)->update(['qty' => 1.5]);
        $audit->record(
            $request,
            new JsonResponse(['success' => true]),
            User::findOrFail(1),
            $before
        );

        $log = DB::table('admin_activity_logs')->where('action', 'Updated recipe for Blueberry')->first();
        $this->assertNotNull($log);
        $this->assertArrayHasKey('recipe_lines', json_decode($log->details, true)['Changes']);
    }

    public function test_custom_cake_recipe_creation_records_its_ingredients(): void
    {
        $request = Request::create('http://localhost/api/staff/customized-cakes/recipes', 'PUT', [
            'flavor_id' => 1,
            'ingredients' => [['ingredient_id' => 1, 'quantity' => 2.5, 'unit' => 'kg']],
        ]);
        $request->setRouteResolver(static fn () => new class {
            public function uri(): string { return 'api/staff/customized-cakes/recipes'; }
            public function parameters(): array { return []; }
        });
        $audit = app(AdminActivityAuditService::class);
        $before = $audit->captureBefore($request);
        DB::table('cake_recipes')->insert(['id' => 1, 'flavor_id' => 1, 'base_size_id' => 1, 'active' => true]);
        DB::table('cake_recipe_ingredients')->insert([
            'id' => 1,
            'recipe_id' => 1,
            'ingredient_id' => 1,
            'quantity' => 2.5,
            'unit' => 'kg',
        ]);
        $audit->record(
            $request,
            new JsonResponse(['success' => true]),
            User::findOrFail(1),
            $before
        );

        $log = DB::table('admin_activity_logs')->where('action', 'Created recipe for Chocolate')->first();
        $this->assertNotNull($log);
        $this->assertNotEmpty(json_decode($log->details, true)['Changes']['cake_recipe_lines']['After']);
    }

    public function test_ingredient_information_changes_are_recorded(): void
    {
        $request = Request::create('http://localhost/api/staff/ingredients/1', 'PUT', [
            'name' => 'Bread Flour',
            'unit' => 'bag',
            'threshold' => 3,
            'unit_cost' => 8,
        ]);
        $request->setRouteResolver(static fn () => new class {
            public function uri(): string { return 'api/staff/ingredients/{ingredient}'; }
            public function parameters(): array { return ['ingredient' => 1]; }
        });
        $audit = app(AdminActivityAuditService::class);
        $before = $audit->captureBefore($request);
        DB::table('ingredients')->where('id', 1)->update([
            'name' => 'Bread Flour',
            'unit' => 'bag',
            'threshold' => 3,
            'unit_cost' => 8,
        ]);
        $audit->record(
            $request,
            new JsonResponse(['success' => true]),
            User::findOrFail(1),
            $before
        );

        $log = DB::table('admin_activity_logs')->where('action', 'Updated Bread Flour')->first();
        $this->assertNotNull($log);
        $changes = json_decode($log->details, true)['Changes']['ingredient'];
        $this->assertSame(['Before' => 'Flour', 'After' => 'Bread Flour'], $changes['name']);
    }

    public function test_discard_request_and_decision_are_audited_with_ingredient_names(): void
    {
        DB::table('discard_requests')->insert([
            'id' => 3,
            'ingredient_id' => 1,
            'ingredient_batch_id' => 1,
            'quantity' => 2,
            'reason' => 'Expired',
            'status' => 'Pending',
        ]);
        $request = Request::create('http://localhost/api/staff/inventory/discards/3/approve', 'POST');
        $request->setRouteResolver(static fn () => new class {
            public function uri(): string { return 'api/staff/inventory/discards/{discard}/approve'; }
            public function parameters(): array { return ['discard' => 3]; }
        });
        $audit = app(AdminActivityAuditService::class);
        $before = $audit->captureBefore($request);
        DB::table('discard_requests')->where('id', 3)->update(['status' => 'Approved', 'approved_by' => 1]);
        $audit->record(
            $request,
            new JsonResponse(['success' => true, 'request' => ['id' => 3]]),
            User::findOrFail(1),
            $before
        );

        $log = DB::table('admin_activity_logs')->where('action', 'Approved discard request for Flour')->first();
        $this->assertNotNull($log);
        $this->assertSame('3', $log->subject_id);
        $details = json_decode($log->details, true);
        $this->assertSame(
            ['Before' => 'Pending', 'After' => 'Approved'],
            data_get($details, 'Changes.discard_request.status')
        );

        DB::table('discard_requests')->insert([
            'id' => 4,
            'ingredient_id' => 1,
            'ingredient_batch_id' => 1,
            'quantity' => 1,
            'reason' => 'Damaged',
            'status' => 'Pending',
        ]);
        $rejectRequest = Request::create('http://localhost/api/staff/inventory/discards/4/reject', 'POST');
        $rejectRequest->setRouteResolver(static fn () => new class {
            public function uri(): string { return 'api/staff/inventory/discards/{discard}/reject'; }
            public function parameters(): array { return ['discard' => 4]; }
        });
        $rejectBefore = $audit->captureBefore($rejectRequest);
        DB::table('discard_requests')->where('id', 4)->update([
            'status' => 'Rejected',
            'rejected_by' => 1,
            'rejection_note' => 'Keep the batch',
        ]);
        $audit->record(
            $rejectRequest,
            new JsonResponse(['success' => true, 'request' => ['id' => 4]]),
            User::findOrFail(1),
            $rejectBefore
        );
        $this->assertNotNull(DB::table('admin_activity_logs')->where('action', 'Rejected discard request for Flour')->first());
    }

    public function test_submitting_a_discard_request_is_audited(): void
    {
        $request = Request::create('http://localhost/api/staff/inventory/discards', 'POST', [
            'ingredient_id' => 1,
            'ingredient_batch_id' => 1,
            'quantity' => 3,
            'reason' => 'Expired',
        ]);
        $request->setRouteResolver(static fn () => new class {
            public function uri(): string { return 'api/staff/inventory/discards'; }
            public function parameters(): array { return []; }
        });
        $audit = app(AdminActivityAuditService::class);
        $before = $audit->captureBefore($request);
        DB::table('discard_requests')->insert([
            'id' => 9,
            'ingredient_id' => 1,
            'ingredient_batch_id' => 1,
            'quantity' => 3,
            'reason' => 'Expired',
            'status' => 'Pending',
        ]);
        $audit->record(
            $request,
            new JsonResponse(['success' => true, 'request_id' => 9, 'request' => ['id' => 9]], 201),
            User::findOrFail(1),
            $before
        );

        $log = DB::table('admin_activity_logs')->where('action', 'Submitted discard request for Flour')->first();
        $this->assertNotNull($log);
        $this->assertSame('9', $log->subject_id);
    }

    public function test_waste_record_is_audited_and_already_recorded_waste_is_not_duplicated(): void
    {
        $request = Request::create('http://localhost/api/staff/inventory/waste', 'POST', ['ingredient_id' => 1]);
        $request->setRouteResolver(static fn () => new class {
            public function uri(): string { return 'api/staff/inventory/waste'; }
            public function parameters(): array { return []; }
        });
        $audit = app(AdminActivityAuditService::class);
        $before = $audit->captureBefore($request);
        DB::table('waste_log')->insert([
            'id' => 5,
            'datetime' => now(),
            'item' => 'Blueberry Cake',
            'qty' => 2,
            'unit_cost' => 5,
            'reason' => 'Spoiled',
        ]);
        $response = new JsonResponse(['success' => true, 'entry' => ['id' => 5]]);
        $audit->record($request, $response, User::findOrFail(1), $before);

        $log = DB::table('admin_activity_logs')->where('action', 'Recorded waste: Blueberry Cake')->first();
        $this->assertNotNull($log);
        $this->assertSame('5', $log->subject_id);
        $this->assertSame('Blueberry Cake', json_decode($log->details, true)['Record']);

        $duplicateRequest = Request::create('http://localhost/api/staff/orders/1/waste', 'POST');
        $duplicateRequest->setRouteResolver(static fn () => new class {
            public function uri(): string { return 'api/staff/orders/{orderId}/waste'; }
            public function parameters(): array { return ['orderId' => 1]; }
        });
        $duplicateBefore = $audit->captureBefore($duplicateRequest);
        $audit->record(
            $duplicateRequest,
            new JsonResponse(['success' => true, 'already_recorded' => true, 'entry' => ['id' => 5]]),
            User::findOrFail(1),
            $duplicateBefore
        );
        $this->assertSame(1, DB::table('admin_activity_logs')->where('action', 'Recorded waste: Blueberry Cake')->count());
    }

    public function test_order_status_and_linked_custom_cake_changes_are_recorded(): void
    {
        $request = Request::create('http://localhost/api/staff/orders/1/status', 'PUT', ['status' => 'Preparing']);
        $request->setRouteResolver(static fn () => new class {
            public function uri(): string { return 'api/staff/orders/{id}/status'; }
            public function parameters(): array { return ['id' => 1]; }
        });
        $audit = app(AdminActivityAuditService::class);
        $before = $audit->captureBefore($request);
        DB::table('orders')->where('id', 1)->update(['status' => 'Preparing']);
        DB::table('customized_cake_orders')->where('id', 1)->update(['status' => 'consumed']);
        $audit->record(
            $request,
            new JsonResponse(['success' => true]),
            User::findOrFail(1),
            $before
        );

        $log = DB::table('admin_activity_logs')->where('action', 'Approved custom cake request for ORD-100')->first();
        $this->assertNotNull($log);
        $changes = json_decode($log->details, true)['Changes'];
        $this->assertSame(['Before' => 'Pending', 'After' => 'Preparing'], $changes['order']['status']);
        $this->assertSame(['Before' => 'pending', 'After' => 'consumed'], $changes['customized_cake_order']['status']);
    }

    public function test_custom_cake_request_setting_change_is_recorded(): void
    {
        $request = Request::create('http://localhost/api/staff/customized-cakes/request-status', 'PATCH', [
            'enabled' => false,
        ]);
        $request->setRouteResolver(static fn () => new class {
            public function uri(): string { return 'api/staff/customized-cakes/request-status'; }
            public function parameters(): array { return []; }
        });
        $audit = app(AdminActivityAuditService::class);
        $before = $audit->captureBefore($request);
        DB::table('custom_cake_request_settings')->where('id', 1)->update(['enabled' => false]);
        $audit->record(
            $request,
            new JsonResponse(['success' => true, 'enabled' => false]),
            User::findOrFail(1),
            $before
        );

        $log = DB::table('admin_activity_logs')->where('action', 'Updated custom cake request settings')->first();
        $this->assertNotNull($log);
        $change = json_decode($log->details, true)['Changes']['request_settings']['enabled'];
        $this->assertTrue((bool) $change['Before']);
        $this->assertFalse((bool) $change['After']);
    }

    public function test_shop_settings_and_admin_preferences_changes_are_recorded(): void
    {
        $request = Request::create('http://localhost/api/admin/settings', 'PUT');
        $request->setRouteResolver(static fn () => new class {
            public function uri(): string { return 'api/admin/settings'; }
            public function parameters(): array { return []; }
        });
        $audit = app(AdminActivityAuditService::class);
        $actor = User::findOrFail(1);
        $before = $audit->captureBefore($request, $actor);
        DB::table('shop_settings')->where('id', 1)->update([
            'settings' => json_encode(['shopName' => 'Blueberry Bakery', 'minimumOrder' => '0']),
        ]);
        DB::table('admin_notification_preferences')->where('user_id', 1)->update(['order_alerts' => false]);
        $audit->record(
            $request,
            new JsonResponse(['success' => true]),
            $actor,
            $before
        );

        $log = DB::table('admin_activity_logs')->where('action', 'Updated Shop settings')->first();
        $this->assertNotNull($log);
        $changes = json_decode($log->details, true)['Changes'];
        $this->assertSame(['Before' => 'Pastry Shop', 'After' => 'Blueberry Bakery'], $changes['settings']['shopName']);
        $this->assertSame(['Before' => true, 'After' => false], $changes['notification_preferences']['orderAlerts']);
    }

    public function test_account_role_changes_are_recorded_without_passwords(): void
    {
        DB::table('users')->insert([
            'id' => 2,
            'name' => 'Admin Account',
            'email' => 'admin@example.com',
            'password' => 'do-not-log-this',
            'role' => 'admin',
        ]);
        $request = Request::create('http://localhost/api/admin-management/users/2', 'PUT', [
            'role' => 'staff',
            'password' => 'new-secret',
        ]);
        $request->setRouteResolver(static fn () => new class {
            public function uri(): string { return 'api/admin-management/users/{user}'; }
            public function parameters(): array { return ['user' => 2]; }
        });
        $audit = app(AdminActivityAuditService::class);
        $before = $audit->captureBefore($request);
        DB::table('users')->where('id', 2)->update(['role' => 'staff']);
        $audit->record(
            $request,
            new JsonResponse(['success' => true]),
            User::findOrFail(1),
            $before
        );

        $log = DB::table('admin_activity_logs')->where('action', 'Updated account Admin Account')->first();
        $this->assertNotNull($log);
        $details = json_decode($log->details, true);
        $this->assertSame(['Before' => 'admin', 'After' => 'staff'], $details['Changes']['user']['role']);
        $this->assertStringNotContainsString('new-secret', json_encode($details));
        $this->assertStringNotContainsString('do-not-log-this', json_encode($details));
    }

    public function test_failed_mutation_does_not_write_a_success_audit_entry(): void
    {
        $request = Request::create('http://localhost/api/staff/production', 'POST', [
            'product_id' => 1,
            'product_size_id' => 2,
            'quantity' => 5,
            'expiry_date' => '2026-11-30',
        ]);
        $request->setRouteResolver(static fn () => new class {
            public function uri(): string { return 'api/staff/production'; }
            public function parameters(): array { return []; }
        });
        $request->headers->set('X-Auth-Token', 'owner-token');
        app(AuditAdminActivity::class)->handle($request, static fn () => new JsonResponse([
            'status' => 'error',
            'message' => 'Insufficient ingredients.',
        ], 409));

        $this->assertSame(12, DB::table('admin_activity_logs')->count());
    }

    public function test_client_ip_uses_only_explicitly_trusted_proxy_addresses(): void
    {
        config(['trustedproxy.proxies' => '10.0.0.1']);
        $trustedRequest = Request::create('http://localhost/test', 'GET', [], [], [], [
            'REMOTE_ADDR' => '10.0.0.1',
            'HTTP_X_FORWARDED_FOR' => '198.51.100.12',
        ]);
        $trustedIp = app(TrustProxies::class)->handle(
            $trustedRequest,
            static fn (Request $request) => $request->ip()
        );
        $this->assertSame('198.51.100.12', $trustedIp);

        config(['trustedproxy.proxies' => '*']);
        $untrustedRequest = Request::create('http://localhost/test', 'GET', [], [], [], [
            'REMOTE_ADDR' => '10.0.0.1',
            'HTTP_X_FORWARDED_FOR' => '203.0.113.24',
        ]);
        $untrustedIp = app(TrustProxies::class)->handle(
            $untrustedRequest,
            static fn (Request $request) => $request->ip()
        );
        $this->assertSame('10.0.0.1', $untrustedIp);
    }

    public function test_account_filter_includes_staff_and_manager_only(): void
    {
        foreach (['staff', 'manager', 'admin'] as $index => $role) {
            DB::table('admin_activity_logs')->insert([
                'actor_name' => ucfirst($role),
                'actor_email' => $role . '@example.com',
                'actor_role' => $role,
                'action' => 'Test ' . $role,
                'category' => 'Users',
                'method' => 'PUT',
                'route' => 'api/admin-management/users/2',
                'response_status' => 200,
                'created_at' => now()->addSeconds($index),
                'updated_at' => now()->addSeconds($index),
            ]);
        }

        $this->withHeader('X-Auth-Token', 'owner-token')
            ->getJson('http://localhost/api/admin-management/activity-logs?actor_role=staff')
            ->assertOk()
            ->assertJsonPath('pagination.total', 2)
            ->assertJsonFragment(['actor_role' => 'staff'])
            ->assertJsonFragment(['actor_role' => 'manager'])
            ->assertJsonMissing(['actor_role' => 'admin']);
    }

    public function test_search_matches_a_record_name_stored_in_details(): void
    {
        DB::table('admin_activity_logs')->insert([
            'actor_name' => 'Admin',
            'actor_email' => 'admin@example.com',
            'actor_role' => 'admin',
            'action' => 'Stocked in product',
            'category' => 'Products',
            'method' => 'POST',
            'route' => 'api/admin/stock/mutate',
            'response_status' => 200,
            'details' => json_encode(['Product' => 'Blueberry Supreme']),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->withHeader('X-Auth-Token', 'owner-token')
            ->getJson('http://localhost/api/admin-management/activity-logs?search=Blueberry%20Supreme')
            ->assertOk()
            ->assertJsonPath('pagination.total', 1)
            ->assertJsonFragment(['action' => 'Stocked in product']);
    }

    public function test_activity_api_returns_details_as_structured_json(): void
    {
        DB::table('admin_activity_logs')->insert([
            'actor_name' => 'Admin',
            'actor_email' => 'admin@example.com',
            'actor_role' => 'admin',
            'action' => 'Stocked in Blueberry',
            'category' => 'Products',
            'method' => 'POST',
            'route' => 'api/admin/stock/mutate',
            'response_status' => 200,
            'details' => json_encode(['Product' => 'Blueberry', 'New stock' => 50]),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->withHeader('X-Auth-Token', 'owner-token')
            ->getJson('http://localhost/api/admin-management/activity-logs')
            ->assertOk()
            ->assertJsonPath('data.0.details.Product', 'Blueberry')
            ->assertJsonPath('data.0.details.New stock', 50);
    }
}
