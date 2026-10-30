<?php

namespace Tests\Feature;

use App\Models\Ingredient;
use App\Models\Product;
use App\Models\User;
use App\Services\AdminRecycleBinService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class AdminRecycleBinSoftDeleteTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        foreach (['products', 'ingredients', 'users'] as $tableName) {
            Schema::create($tableName, function ($table) use ($tableName) {
                $table->id();
                $table->string('name');
                if ($tableName === 'products') {
                    $table->string('image')->nullable();
                }
                $table->timestamp('deleted_at')->nullable();
            });
        }

        Schema::create('admin_recycle_bin', function ($table) {
            $table->id();
            $table->string('item_type', 40);
            $table->string('label', 255);
            $table->longText('payload');
            $table->timestamp('deleted_at');
            $table->timestamp('expires_at')->index();
            $table->timestamps();
        });

        DB::table('products')->insert(['id' => 1, 'name' => 'Cake', 'image' => null]);
        DB::table('ingredients')->insert(['id' => 2, 'name' => 'Flour']);
        DB::table('users')->insert(['id' => 3, 'name' => 'Customer']);
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('admin_recycle_bin');
        Schema::dropIfExists('users');
        Schema::dropIfExists('ingredients');
        Schema::dropIfExists('products');

        parent::tearDown();
    }

    public function test_products_ingredients_and_users_can_be_undone_from_the_recycle_bin(): void
    {
        $recycleBin = app(AdminRecycleBinService::class);
        $entryIds = [
            $recycleBin->trashProduct(1),
            $recycleBin->trashIngredient(2),
            $recycleBin->trashUser(3),
        ];

        $this->assertNull(Product::query()->find(1));
        $this->assertNull(Ingredient::query()->find(2));
        $this->assertNull(User::query()->find(3));
        $this->assertCount(3, $recycleBin->entries());

        foreach ($entryIds as $entryId) {
            $recycleBin->restore($entryId);
        }

        $this->assertNotNull(Product::query()->find(1));
        $this->assertNotNull(Ingredient::query()->find(2));
        $this->assertNotNull(User::query()->find(3));
        $this->assertCount(0, $recycleBin->entries());
    }

    public function test_permanently_deleting_recycle_bin_entries_removes_the_records(): void
    {
        $recycleBin = app(AdminRecycleBinService::class);
        $entryIds = [
            $recycleBin->trashProduct(1),
            $recycleBin->trashIngredient(2),
            $recycleBin->trashUser(3),
        ];

        foreach ($entryIds as $entryId) {
            $recycleBin->permanentlyDelete($entryId);
        }

        $this->assertDatabaseMissing('products', ['id' => 1]);
        $this->assertDatabaseMissing('ingredients', ['id' => 2]);
        $this->assertDatabaseMissing('users', ['id' => 3]);
        $this->assertCount(0, $recycleBin->entries());
    }
}
