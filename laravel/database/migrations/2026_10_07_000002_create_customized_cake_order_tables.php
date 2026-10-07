<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('customized_cake_orders')) {
            Schema::create('customized_cake_orders', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('order_id')->nullable()->index();
                $table->string('cake_type')->default('single');
                $table->string('status')->default('pending');
                $table->text('notes')->nullable();
                $table->longText('inspo_images')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('customized_cake_tiers')) {
            Schema::create('customized_cake_tiers', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('customized_cake_order_id');
                $table->unsignedInteger('tier_number');
                $table->unsignedBigInteger('flavor_id');
                $table->unsignedBigInteger('size_id');
                $table->timestamps();

                $table->foreign('customized_cake_order_id', 'custom_cake_tiers_order_fk')
                    ->references('id')
                    ->on('customized_cake_orders')
                    ->cascadeOnDelete();
                $table->foreign('flavor_id')
                    ->references('id')
                    ->on('cake_flavors')
                    ->cascadeOnDelete();
                $table->foreign('size_id')
                    ->references('id')
                    ->on('cake_sizes')
                    ->cascadeOnDelete();
                $table->index(
                    ['customized_cake_order_id', 'tier_number'],
                    'customized_cake_tiers_customized_cake_order_id_tier_number_index'
                );
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('customized_cake_tiers');
        Schema::dropIfExists('customized_cake_orders');
    }
};
