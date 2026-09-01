<?php

namespace App\Http\Requests;

class RejectDiscardRequest extends ApproveDiscardRequest
{
    public function rules(): array
    {
        return [
            'rejection_note' => ['nullable', 'string', 'max:1024'],
        ];
    }
}
