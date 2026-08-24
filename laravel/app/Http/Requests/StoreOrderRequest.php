<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'items' => 'required|array',
            'items.*.name' => 'required|string',
            'items.*.qty' => 'required|integer|min:1',
            'items.*.price' => 'required|numeric',
            'subtotal' => 'required|numeric',
            'delivery_fee' => 'required|numeric',
            'total' => 'required|numeric',
            'method' => 'required|string|in:Delivery,Deliver,Pickup',
            'payment' => 'required|string',
            'address' => 'required_if:method,Delivery,Deliver|string|nullable',
            'phone' => 'required|string',
            'lat' => 'nullable|numeric',
            'lng' => 'nullable|numeric',
            'order_type' => 'nullable|string',
            'is_customized' => 'nullable|boolean',
        ];
    }
}
