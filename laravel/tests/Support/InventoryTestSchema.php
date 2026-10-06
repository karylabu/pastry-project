<?php

namespace Tests\Support;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class InventoryTestSchema
{
    public static function create(): void
    {
        foreach ([
            'waste_log',
            'discard_requests',
            'ingredient_movements',
            'ingredient_batches',
            'production_batch_allocations',
            'production_transactions',
            'product_inventory_movements',
            'product_recipes',
            'product_sizes',
            'products',
            'ingredients',
            'users',
        ] as $table) {
            Schema::dropIfExists($table);
        }

        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('email')->unique();
            $table->timestamp('email_verified_at')->nullable();
            $table->string('password');
            $table->string('role')->default('customer');
            $table->string('status')->default('active');
            $table->rememberToken();
        });

        Schema::create('ingredients', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('unit');
            $table->decimal('unit_cost', 10, 2)->default(0);
            $table->decimal('stock', 10, 3)->default(0);
            $table->decimal('threshold', 10, 3)->default(0);
            $table->date('expiry')->nullable();
            $table->timestamps();
        });

        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('category')->nullable();
            $table->decimal('price', 10, 2)->default(0);
            $table->integer('stock')->default(0);
            $table->string('image')->nullable();
            $table->text('description')->nullable();
            $table->boolean('available')->default(true);
            $table->timestamps();
        });

        Schema::create('product_sizes', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('product_id');
            $table->string('size');
            $table->decimal('price', 10, 2)->default(0);
            $table->boolean('available')->default(true);
            $table->integer('stock_quantity')->default(0);
            $table->timestamps();
        });

        Schema::create('product_recipes', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('product_id');
            $table->unsignedBigInteger('product_size_id')->nullable();
            $table->unsignedBigInteger('ingredient_id');
            $table->decimal('qty', 10, 3);
            $table->boolean('active')->default(true);
            $table->timestamps();
        });

        Schema::create('ingredient_batches', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('ingredient_id');
            $table->string('batch_number');
            $table->decimal('quantity_received', 10, 3);
            $table->decimal('quantity_remaining', 10, 3);
            $table->date('purchase_date')->nullable();
            $table->date('expiry_date')->nullable();
            $table->string('supplier')->nullable();
            $table->decimal('unit_cost', 10, 2)->default(0);
            $table->text('notes')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();
            $table->unique(['ingredient_id', 'batch_number']);
        });

        Schema::create('ingredient_movements', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('ingredient_id');
            $table->unsignedBigInteger('batch_id')->nullable();
            $table->string('action');
            $table->decimal('qty', 10, 3);
            $table->text('note')->nullable();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('reference_type')->nullable();
            $table->unsignedBigInteger('reference_id')->nullable();
            $table->decimal('previous_stock', 10, 3)->nullable();
            $table->decimal('new_stock', 10, 3)->nullable();
            $table->timestamp('created_at')->nullable();
        });

        Schema::create('production_transactions', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('product_id');
            $table->unsignedBigInteger('product_size_id')->nullable();
            $table->integer('quantity');
            $table->date('expiry_date')->nullable();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('idempotency_key')->nullable()->unique();
            $table->timestamp('created_at')->nullable();
        });

        Schema::create('production_batch_allocations', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('production_transaction_id');
            $table->unsignedBigInteger('ingredient_id');
            $table->unsignedBigInteger('ingredient_batch_id');
            $table->decimal('quantity_consumed', 10, 3);
            $table->timestamp('created_at')->nullable();
        });

        Schema::create('product_inventory_movements', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('product_id');
            $table->unsignedBigInteger('product_variant_id')->nullable();
            $table->unsignedBigInteger('product_size_id')->nullable();
            $table->string('movement_type');
            $table->decimal('quantity', 10, 3);
            $table->decimal('previous_stock', 10, 3);
            $table->decimal('new_stock', 10, 3);
            $table->string('reason')->nullable();
            $table->string('reference_type')->nullable();
            $table->unsignedBigInteger('reference_id')->nullable();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->timestamp('created_at')->nullable();
        });

        Schema::create('discard_requests', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('ingredient_id');
            $table->unsignedBigInteger('ingredient_batch_id');
            $table->decimal('quantity', 10, 3);
            $table->string('reason');
            $table->string('status')->default('Pending');
            $table->text('notes')->nullable();
            $table->unsignedBigInteger('requested_by')->nullable();
            $table->timestamp('requested_at')->nullable();
            $table->unsignedBigInteger('approved_by')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->unsignedBigInteger('rejected_by')->nullable();
            $table->timestamp('rejected_at')->nullable();
            $table->timestamp('discarded_at')->nullable();
            $table->text('rejection_note')->nullable();
        });

        Schema::create('waste_log', function (Blueprint $table) {
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
            $table->unsignedBigInteger('requested_by')->nullable();
            $table->unsignedBigInteger('approved_by')->nullable();
            $table->dateTime('approved_at')->nullable();
            $table->dateTime('discarded_at')->nullable();
            $table->string('unit')->nullable();
            $table->unsignedBigInteger('discard_request_id')->nullable();
            $table->string('idempotency_key')->nullable();
            $table->timestamp('created_at')->nullable();
        });
    }
}
