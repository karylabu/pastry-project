<?php

namespace App\Http\Controllers;

use App\Models\Subscriber;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class NewsletterController extends Controller
{
    public function subscribe(Request $request)
    {
        $payload = $request->all();

        if (empty($payload) && $request->getContent()) {
            $decoded = json_decode($request->getContent(), true);
            if (is_array($decoded)) {
                $payload = $decoded;
            } else {
                parse_str($request->getContent(), $payload);
            }
        }

        if (empty($payload) && $request->has('email')) {
            $payload['email'] = $request->input('email');
        }

        $validator = Validator::make($payload, [
            'email' => ['required', 'email:rfc', 'max:191', 'unique:subscribers,email'],
        ], [
            'email.required' => 'Please enter your email address.',
            'email.email' => 'Please enter a valid email address.',
            'email.unique' => 'This email is already subscribed.',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => $validator->errors()->first('email'),
            ], 422);
        }

        $subscriber = Subscriber::create([
            'email' => strtolower(trim($payload['email'] ?? '')),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Thanks for subscribing!',
            'subscriber' => $subscriber,
        ], 201);
    }
}
