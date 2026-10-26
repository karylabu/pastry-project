<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\UploadedFile;

class StoreOrderRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        $payload = json_decode((string) $this->input('order_payload'), true);
        if (is_array($payload)) {
            $this->merge($payload);
        }

        $deliveryDate = $this->input('delivery_date');
        if (is_string($deliveryDate) && trim($deliveryDate) === '') {
            $this->merge(['delivery_date' => null]);
        }
    }

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $allowedImageExtension = static function (string $attribute, mixed $value, \Closure $fail): void {
            if ($value instanceof UploadedFile
                && !in_array(strtolower($value->getClientOriginalExtension()), ['jpg', 'jpeg', 'png', 'webp'], true)) {
                $fail('The discount ID image file extension is not supported.');
            }
        };

        return [
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|integer|exists:products,id',
            'items.*.product_size_id' => 'nullable|integer|min:0',
            'items.*.qty' => 'required|integer|min:1|max:20',
            'items.*.name' => 'sometimes|string',
            'items.*.variant' => 'nullable|string|max:50',
            'items.*.price' => 'sometimes|numeric',
            'items.*.selectionDetails' => 'sometimes|array',
            'items.*.selectionDetails.extras' => 'sometimes|array',
            'items.*.selectionDetails.extras.*.name' => 'required|string|max:50',
            'items.*.image' => 'sometimes|string|nullable',
            'method' => 'required|string|in:Delivery,Deliver,Pickup',
            'delivery_service' => 'nullable|string|in:Lalamove,GrabCar',
            'delivery_date' => 'nullable|required_if:method,Pickup|date_format:Y-m-d|after_or_equal:today',
            'delivery_time' => 'nullable|date_format:H:i',
            'payment' => $this->input('method') === 'Pickup'
                ? 'required|string|in:QRPh'
                : 'required|string',
            'address' => 'required_if:method,Delivery,Deliver|string|nullable',
            'phone' => 'required|string',
            'lat' => 'nullable|numeric',
            'lng' => 'nullable|numeric',
            'order_type' => 'nullable|string',
            'is_customized' => 'nullable|boolean',
            'discount_type' => 'nullable|in:none,senior_citizen,pwd',
            'discount_id_image' => [
                'exclude_unless:discount_type,senior_citizen,pwd',
                'required_if:discount_type,senior_citizen,pwd',
                'file',
                'image',
                'mimes:jpeg,jpg,png,webp',
                $allowedImageExtension,
                'max:5120',
            ],
            'reward_code' => 'nullable|string|max:32',
            'promotion_coupon_code' => 'nullable|string|max:50',
        ];
    }
}
