<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_variants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->enum('variant_size', ['slice', 'small', 'big']);
            $table->integer('stock_quantity')->default(0);
            $table->integer('threshold')->default(0);
            $table->decimal('price', 10, 2)->default(0.00);
            $table->timestamps();

            $table->unique(['product_id', 'variant_size']);
            $table->index(['product_id', 'variant_size']);
            $table->index('stock_quantity');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_variants');
    }
};
