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
            $table->string('name');
            $table->string('slug')->unique();
            $table->boolean('active')->default(true);
            $table->timestamps();
        });

        Schema::create('cake_sizes', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();
            $table->string('label');
            $table->decimal('multiplier', 10, 3)->default(1);
            $table->boolean('active')->default(true);
            $table->timestamps();
        });

        Schema::create('cake_recipes', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('flavor_id');
            $table->unsignedBigInteger('base_size_id');
            $table->boolean('active')->default(true);
            $table->timestamps();
        });

        Schema::create('cake_recipe_ingredients', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('recipe_id');
            $table->unsignedBigInteger('ingredient_id');
            $table->decimal('quantity', 10, 3)->default(0);
            $table->string('unit')->default('g');
            $table->timestamps();
        });

        $now = now();
        foreach ([
            ['name' => 'Moist Chocolate', 'slug' => 'moist-chocolate'],
            ['name' => 'Carrot', 'slug' => 'carrot'],
            ['name' => 'Red Velvet', 'slug' => 'red-velvet'],
        ] as $flavor) {
            DB::table('cake_flavors')->insertOrIgnore($flavor + [
                'active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        foreach ([
            ['code' => '4x2', 'label' => '4 x 2 inch', 'multiplier' => 0.30],
            ['code' => '6x3', 'label' => '6 x 3 inch', 'multiplier' => 1.00],
            ['code' => '6x5', 'label' => '6 x 5 inch', 'multiplier' => 1.67],
            ['code' => '8x5', 'label' => '8 x 5 inch', 'multiplier' => 2.96],
            ['code' => '10x5', 'label' => '10 x 5 inch', 'multiplier' => 4.63],
        ] as $size) {
            DB::table('cake_sizes')->insertOrIgnore($size + [
                'active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('cake_recipe_ingredients');
        Schema::dropIfExists('cake_recipes');
        Schema::dropIfExists('cake_sizes');
        Schema::dropIfExists('cake_flavors');
    }
};
