<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AnalyticsImport extends Model
{
    use HasFactory;

    protected $table = 'analytics_imports';

    public $timestamps = false;

    protected $fillable = [
        'source_name',
        'file_name',
        'uploaded_by',
        'uploaded_at',
        'status',
        'rows_received',
        'rows_processed',
        'stored_path',
        'queue_job_id',
    ];

    protected $casts = [
        'uploaded_at' => 'datetime',
        'rows_received' => 'int',
        'rows_processed' => 'int',
        'queue_job_id' => 'int',
    ];
}
