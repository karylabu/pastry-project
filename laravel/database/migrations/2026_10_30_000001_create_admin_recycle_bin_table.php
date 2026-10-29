<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('admin_recycle_bin', function (Blueprint $table) {
            $table->id();
            $table->string('item_type', 40);
            $table->string('label', 255);
            $table->longText('payload');
            $table->timestamp('deleted_at');
            $table->timestamp('expires_at')->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('admin_recycle_bin');
    }
};
