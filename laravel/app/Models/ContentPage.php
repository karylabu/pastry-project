<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class ContentPage extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'slug',
        'title',
        'content',
        'is_published',
    ];

    protected $casts = [
        'is_published' => 'boolean',
    ];
}
