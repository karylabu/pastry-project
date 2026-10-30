<?php

namespace App\Models\Concerns;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Schema;

trait ExcludesTrashedRecords
{
    protected static function bootExcludesTrashedRecords(): void
    {
        static::addGlobalScope('not_trashed', static function (Builder $query): void {
            $model = $query->getModel();
            if (Schema::hasColumn($model->getTable(), 'deleted_at')) {
                $query->whereNull($model->qualifyColumn('deleted_at'));
            }
        });
    }
}
