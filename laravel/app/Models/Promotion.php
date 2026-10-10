<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Builder;

class Promotion extends Model
{
    use HasFactory;

    protected $fillable = [
        'title',
        'description',
        'image_url',
        'coupon_code',
        'discount_percent',
        'starts_at',
        'ends_at',
        'status',
        'sent_count',
        'failed_count',
    ];

    protected $casts = [
        'starts_at' => 'datetime',
        'ends_at' => 'datetime',
        'discount_percent' => 'decimal:2',
    ];

    public function scopeAcceptingCoupons(Builder $query): Builder
    {
        return $query
            ->whereIn('status', ['sent', 'sent_with_failures'])
            ->whereNotNull('coupon_code')
            ->where('discount_percent', '>', 0)
            ->where('starts_at', '<=', now())
            ->where('ends_at', '>=', now());
    }
}
