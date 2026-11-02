<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('content_pages', function (Blueprint $table): void {
            $table->id();
            $table->string('slug', 80)->unique();
            $table->string('title', 150);
            $table->longText('content')->nullable();
            $table->boolean('is_published')->default(true);
            $table->timestamps();
            $table->softDeletes();
        });

        $now = now();
        DB::table('content_pages')->insert([
            ['slug' => 'about-us', 'title' => 'About Us', 'content' => '', 'is_published' => true, 'created_at' => $now, 'updated_at' => $now],
            ['slug' => 'terms', 'title' => 'Terms & Conditions', 'content' => '', 'is_published' => true, 'created_at' => $now, 'updated_at' => $now],
            ['slug' => 'privacy-policy', 'title' => 'Privacy Policy', 'content' => '', 'is_published' => true, 'created_at' => $now, 'updated_at' => $now],
            ['slug' => 'cookie-policy', 'title' => 'Cookie Policy', 'content' => '', 'is_published' => true, 'created_at' => $now, 'updated_at' => $now],
            ['slug' => 'return-policy', 'title' => 'Return Policy', 'content' => '', 'is_published' => true, 'created_at' => $now, 'updated_at' => $now],
            ['slug' => 'contact-information', 'title' => 'Contact Information & Business Details', 'content' => '', 'is_published' => true, 'created_at' => $now, 'updated_at' => $now],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('content_pages');
    }
};
