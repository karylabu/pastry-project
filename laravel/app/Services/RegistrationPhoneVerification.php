<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class RegistrationPhoneVerification
{
    public function normalizePhone(string $phone): string
    {
        $digits = preg_replace('/\D+/', '', $phone) ?? '';

        if (strlen($digits) === 12 && str_starts_with($digits, '63')) {
            return '0' . substr($digits, 2);
        }

        return $digits;
    }

    public function isPhoneRegistered(string $phone): bool
    {
        $normalizedPhone = $this->normalizePhone($phone);
        $columns = array_filter(['phone', 'phone_number'], fn ($column) => Schema::hasColumn('users', $column));

        foreach ($columns as $column) {
            $users = DB::table('users')->whereNotNull($column);
            if (Schema::hasColumn('users', 'deleted_at')) {
                $users->whereNull('deleted_at');
            }

            $registeredPhones = $users->pluck($column);
            if ($registeredPhones->contains(fn ($savedPhone) => $this->normalizePhone((string) $savedPhone) === $normalizedPhone)) {
                return true;
            }
        }

        return false;
    }

}
