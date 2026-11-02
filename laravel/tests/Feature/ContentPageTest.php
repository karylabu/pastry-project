<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ContentPageTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::create('content_pages', function ($table): void {
            $table->id();
            $table->string('slug', 80)->unique();
            $table->string('title', 150);
            $table->longText('content')->nullable();
            $table->boolean('is_published')->default(true);
            $table->timestamps();
            $table->softDeletes();
        });
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('content_pages');

        parent::tearDown();
    }

    public function test_admin_can_create_update_delete_and_restore_a_customer_page(): void
    {
        $admin = (new User())->forceFill([
            'id' => 1,
            'name' => 'Shop Admin',
            'email' => 'admin@example.com',
            'role' => 'admin',
            'status' => 'active',
        ]);

        $this->actingAs($admin)
            ->postJson('/api/admin/content-pages', [
                'slug' => 'about-us',
                'title' => 'About Our Bakery',
                'content' => "Freshly baked every day.\nVisit us in Tanauan.",
                'is_published' => true,
            ])
            ->assertCreated()
            ->assertJsonPath('data.title', 'About Our Bakery');

        $this->getJson('/api/content-pages/about-us')
            ->assertOk()
            ->assertJsonPath('data.content', "Freshly baked every day.\nVisit us in Tanauan.");

        $this->actingAs($admin)
            ->putJson('/api/admin/content-pages/about-us', [
                'title' => 'Our Story',
                'content' => 'Updated story.',
                'is_published' => true,
            ])
            ->assertOk()
            ->assertJsonPath('data.title', 'Our Story');

        $this->actingAs($admin)
            ->deleteJson('/api/admin/content-pages/about-us')
            ->assertOk();

        $this->getJson('/api/content-pages/about-us')->assertStatus(410);

        $this->actingAs($admin)
            ->postJson('/api/admin/content-pages', [
                'slug' => 'about-us',
                'title' => 'Our Story',
                'content' => 'Restored story.',
                'is_published' => true,
            ])
            ->assertCreated();

        $this->getJson('/api/content-pages/about-us')
            ->assertOk()
            ->assertJsonPath('data.content', 'Restored story.');
    }

    public function test_content_management_requires_an_admin_role(): void
    {
        $staff = (new User())->forceFill([
            'id' => 2,
            'name' => 'Staff Member',
            'email' => 'staff@example.com',
            'role' => 'staff',
            'status' => 'active',
        ]);

        $this->getJson('/api/admin/content-pages')->assertUnauthorized();
        $this->actingAs($staff)->getJson('/api/admin/content-pages')->assertForbidden();
    }
}
