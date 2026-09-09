<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cake_flavors', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->string('slug')->unique();
            $table->boolean('active')->default(true);
            $table->timestamps();
        });

        Schema::create('cake_sizes', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();
            $table->string('label');
            $table->decimal('multiplier', 10, 3)->default(1.000);
            $table->boolean('active')->default(true);
            $table->timestamps();
        });

        Schema::create('cake_recipes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('flavor_id')->constrained('cake_flavors')->cascadeOnDelete();
            $table->foreignId('base_size_id')->constrained('cake_sizes')->cascadeOnDelete();
            $table->boolean('active')->default(true);
            $table->timestamps();

            $table->unique(['flavor_id', 'base_size_id']);
        });

        Schema::create('cake_recipe_ingredients', function (Blueprint $table) {
            $table->id();
            $table->foreignId('recipe_id')->constrained('cake_recipes')->cascadeOnDelete();
            $table->integer('ingredient_id');
            $table->foreign('ingredient_id')->references('id')->on('ingredients')->cascadeOnDelete();
            $table->decimal('quantity', 12, 3)->default(0);
            $table->string('unit', 50)->default('g');
            $table->timestamps();

            $table->unique(['recipe_id', 'ingredient_id']);
        });

        Schema::create('customized_cake_orders', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('order_id')->nullable();
            $table->string('cake_type')->default('single');
            $table->string('status')->default('pending');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index('order_id');
        });

        Schema::create('customized_cake_tiers', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('customized_cake_order_id');
            $table->foreign('customized_cake_order_id', 'custom_cake_tiers_order_fk')->references('id')->on('customized_cake_orders')->cascadeOnDelete();
            $table->unsignedInteger('tier_number');
            $table->foreignId('flavor_id')->constrained('cake_flavors')->cascadeOnDelete();
            $table->foreignId('size_id')->constrained('cake_sizes')->cascadeOnDelete();
            $table->timestamps();

            $table->index(['customized_cake_order_id', 'tier_number']);
        });

        Schema::create('customized_cake_inventory_consumptions', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('customized_cake_order_id');
            $table->foreign('customized_cake_order_id', 'custom_cake_consumptions_order_fk')->references('id')->on('customized_cake_orders')->cascadeOnDelete();
            $table->unsignedBigInteger('order_id')->nullable();
            $table->enum('status', ['pending', 'consumed', 'failed'])->default('pending');
            $table->json('summary')->nullable();
            $table->timestamps();

            $table->unique('customized_cake_order_id', 'custom_cake_consumptions_order_unique');
        });

        $baseSizes = [
            ['code' => '4x2', 'label' => '4×2"', 'multiplier' => 0.30],
            ['code' => '6x3', 'label' => '6×3"', 'multiplier' => 1.00],
            ['code' => '6x5', 'label' => '6×5"', 'multiplier' => 1.67],
            ['code' => '8x5', 'label' => '8×5"', 'multiplier' => 2.96],
            ['code' => '10x5', 'label' => '10×5"', 'multiplier' => 4.63],
        ];

        foreach ($baseSizes as $size) {
            DB::table('cake_sizes')->updateOrInsert(['code' => $size['code']], [
                'label' => $size['label'],
                'multiplier' => $size['multiplier'],
                'active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        $flavors = [
            ['name' => 'Moist Chocolate', 'slug' => 'moist-chocolate'],
            ['name' => 'Carrot', 'slug' => 'carrot'],
            ['name' => 'Red Velvet', 'slug' => 'red-velvet'],
        ];

        foreach ($flavors as $flavor) {
            DB::table('cake_flavors')->updateOrInsert(['slug' => $flavor['slug']], [
                'name' => $flavor['name'],
                'active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('customized_cake_inventory_consumptions');
        Schema::dropIfExists('customized_cake_tiers');
        Schema::dropIfExists('customized_cake_orders');
        Schema::dropIfExists('cake_recipe_ingredients');
        Schema::dropIfExists('cake_recipes');
        Schema::dropIfExists('cake_sizes');
        Schema::dropIfExists('cake_flavors');
    }
};
