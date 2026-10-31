<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use App\Models\Concerns\ExcludesTrashedRecords;

class User extends Authenticatable
{
    /** @use HasFactory<\Illuminate\Database\Eloquent\Factories\Factory> */
    use ExcludesTrashedRecords, HasFactory, Notifiable;

    public $timestamps = false;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
        'status',
        'phone',
        'phone_number',
        'subscribed_promo',
        'expo_push_token',
        'fcm_token',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'subscribed_promo' => 'boolean',
        ];
    }

    /**
     * Determine whether this user can access management functions.
     */
    public function isAdmin(): bool
    {
        return self::isAdminRole($this->role);
    }

    public function isSuperAdmin(): bool
    {
        return strtolower(trim((string) $this->role)) === 'super_admin';
    }

    public static function isAdminRole(mixed $role): bool
    {
        return in_array(strtolower(trim((string) $role)), ['admin', 'super_admin'], true);
    }

    /**
     * Determine whether the account is active.
     */
    public function isActive(): bool
    {
        return $this->status === 'active';
    }

    public function adminNotifications()
    {
        return $this->hasMany(AdminNotification::class, 'user_id');
    }
}
