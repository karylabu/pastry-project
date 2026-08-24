<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

use App\Models\User;

class AdminNotification extends Model
{
    use HasFactory;

    public $timestamps = false;

    protected $table = 'notifications';

    protected $fillable = [
        'user_id',
        'type',
        'title',
        'message',
        'data',
        'is_read',
        'read_at',
        'action_url',
    ];

    protected $casts = [
        'data' => 'array',
        'read_at' => 'datetime',
        'is_read' => 'boolean',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function scopeUnread(Builder $query): Builder
    {
        return $query->where(function (Builder $sub) {
            $sub->whereNull('read_at')
                ->orWhere('read_at', '0000-00-00 00:00:00')
                ->orWhere('is_read', false);
        });
    }

    public function scopeForUser(Builder $query, User|int $user): Builder
    {
        $userId = $user instanceof User ? $user->id : (int) $user;

        return $query->where(function (Builder $sub) use ($userId) {
            $sub->whereNull('user_id')
                ->orWhere('user_id', $userId);
        });
    }

    public function markAsRead(): bool
    {
        $this->is_read = true;
        $this->read_at = now();

        return $this->save();
    }

    public function isRead(): bool
    {
        return $this->read_at !== null;
    }

    public static function createSystem(array $attributes): self
    {
        return self::create(array_merge($attributes, ['user_id' => null]));
    }

    public static function notifyRoles(array $roles, array $attributes): void
    {
        $users = User::whereIn('role', $roles)
            ->where('status', 'active')
            ->get();

        foreach ($users as $user) {
            self::create(array_merge($attributes, ['user_id' => $user->id]));
        }
    }
}
