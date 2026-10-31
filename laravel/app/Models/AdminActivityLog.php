<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AdminActivityLog extends Model
{
    protected $fillable = [
        'actor_id',
        'actor_name',
        'actor_email',
        'actor_role',
        'action',
        'category',
        'subject_type',
        'subject_id',
        'method',
        'route',
        'ip_address',
        'user_agent',
        'response_status',
        'details',
    ];

    protected $casts = [
        'details' => 'array',
        'response_status' => 'integer',
    ];
}
