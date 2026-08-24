<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PromotionEmailLog extends Model
{
    use HasFactory;

    public $timestamps = false;

    protected $table = 'promotion_email_logs';

    protected $fillable = [
        'promotion_id',
        'email',
        'status',
        'error_message',
        'attempted_at',
    ];

    protected $casts = [
        'attempted_at' => 'datetime',
    ];
}
