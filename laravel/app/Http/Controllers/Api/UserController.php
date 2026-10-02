<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    protected function resolvePayload(Request $request): array
    {
        $payload = $request->all();

        if (empty($payload) && $request->getContent()) {
            $decoded = json_decode($request->getContent(), true);
            if (is_array($decoded)) {
                $payload = $decoded;
            }
        }

        if (!is_array($payload)) {
            $payload = [];
        }

        if (array_key_exists('email', $payload)) {
            $payload['email'] = strtolower(trim((string) $payload['email']));
        }

        if (array_key_exists('phone_number', $payload) && !array_key_exists('phone', $payload)) {
            $payload['phone'] = $payload['phone_number'];
        }

        return $payload;
    }

    protected function normalizeValidatedData(array $validated): array
    {
        if (array_key_exists('phone_number', $validated)) {
            $validated['phone'] = $validated['phone_number'];
            unset($validated['phone_number']);
        }

        if (array_key_exists('password_confirmation', $validated)) {
            unset($validated['password_confirmation']);
        }

        if (array_key_exists('status', $validated) && !in_array($validated['status'], ['active', 'inactive', 'banned'], true)) {
            $validated['status'] = 'active';
        }

        if (array_key_exists('password', $validated) && $validated['password'] === '') {
            unset($validated['password']);
        }

        return $validated;
    }

    /**
     * Return a paginated list of users.
     */
    public function index(Request $request)
    {
        if ($response = $this->authorizeAdmin($request)) return $response;

        $query = User::query()->orderByDesc('created_at');

        if ($request->filled('search')) {
            $search = trim($request->search);
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%" );
            });
        }

        if ($request->filled('role')) {
            $role = $request->role;
            if (in_array($role, ['admin', 'customer'], true)) {
                $query->where('role', $role);
            }
        }

        if ($request->filled('status')) {
            $status = $request->status;
            if (in_array($status, ['active', 'inactive', 'banned'], true)) {
                $query->where('status', $status);
            }
        }

        $perPage = (int) $request->input('per_page', 10);
        $perPage = $perPage > 0 ? min($perPage, 50) : 10;

        $users = $query->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => $users->items(),
            'pagination' => [
                'current_page' => $users->currentPage(),
                'last_page' => $users->lastPage(),
                'per_page' => $users->perPage(),
                'total' => $users->total(),
            ],
        ]);
    }

    /**
    * Create a new user account.
     */
    public function store(Request $request)
    {
        if ($response = $this->authorizeAdmin($request)) return $response;

        $payload = $this->resolvePayload($request);

        $validated = Validator::make($payload, [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'phone_number' => ['nullable', 'string', 'max:20'],
            'phone' => ['nullable', 'string', 'max:20'],
            'role' => ['required', Rule::in(['admin', 'customer'])],
            'status' => ['sometimes', Rule::in(['active', 'inactive', 'banned'])],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ])->validate();

        $validated = $this->normalizeValidatedData($validated);
        $validated['status'] = $validated['status'] ?? 'active';

        if (!empty($validated['password'])) {
            $validated['password'] = Hash::make($validated['password']);
        }

        $user = User::create($validated);

        return response()->json([
            'success' => true,
            'message' => 'User created successfully.',
            'data' => $user,
        ], 201);
    }

    /**
     * Show a single user record.
     */
    public function show(User $user)
    {
        if ($response = $this->authorizeAdmin(request())) return $response;

        return response()->json([
            'success' => true,
            'data' => $user,
        ]);
    }

    /**
     * Update an existing user.
     */
    public function update(Request $request, User $user)
    {
        if ($response = $this->authorizeAdmin($request)) return $response;

        $payload = $this->resolvePayload($request);

        $validated = Validator::make($payload, [
            'name' => ['sometimes', 'string', 'max:255'],
            'email' => ['sometimes', 'email', 'max:255', Rule::unique('users')->ignore($user->id)],
            'phone_number' => ['nullable', 'string', 'max:20'],
            'phone' => ['nullable', 'string', 'max:20'],
            'role' => ['sometimes', Rule::in(['admin', 'customer'])],
            'status' => ['sometimes', Rule::in(['active', 'inactive', 'banned'])],
            'password' => ['nullable', 'string', 'min:8', 'confirmed'],
        ])->validate();

        $validated = $this->normalizeValidatedData($validated);

        if (!empty($validated['password'])) {
            $validated['password'] = Hash::make($validated['password']);
        } else {
            unset($validated['password']);
        }

        $user->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'User updated successfully.',
            'data' => $user->fresh(),
        ]);
    }

    public function destroy(User $user)
    {
        $request = request();
        if ($response = $this->authorizeAdmin($request)) return $response;

        $admin = $this->getAuthenticatedUser($request);
        if ($admin && (int) $admin->id === (int) $user->id) {
            return response()->json([
                'success' => false,
                'message' => 'You cannot delete the account currently signed in.',
            ], 409);
        }

        DB::transaction(function () use ($user) {
            $userId = (int) $user->id;

            if (Schema::hasTable('addresses') && Schema::hasColumn('addresses', 'customer_id')) {
                DB::table('addresses')->where('customer_id', $userId)->delete();
            }
            if (Schema::hasTable('favorites') && Schema::hasColumn('favorites', 'customer_id')) {
                DB::table('favorites')->where('customer_id', $userId)->delete();
            }
            if (Schema::hasTable('orders') && Schema::hasColumn('orders', 'user_id')) {
                DB::table('orders')->where('user_id', $userId)->update(['user_id' => null]);
            }
            if (Schema::hasTable('variance') && Schema::hasColumn('variance', 'recorded_by')) {
                DB::table('variance')->where('recorded_by', $userId)->update(['recorded_by' => null]);
            }
            if (Schema::hasTable('messages') && Schema::hasColumn('messages', 'user_id')) {
                $updates = ['user_id' => null];
                if (Schema::hasColumn('messages', 'customer_name')) $updates['customer_name'] = null;
                if (Schema::hasColumn('messages', 'customer_email')) $updates['customer_email'] = null;
                DB::table('messages')->where('user_id', $userId)->update($updates);
            }
            if (Schema::hasTable('user_sessions')) {
                DB::table('user_sessions')->where('user_id', $userId)->delete();
            }

            $user->delete();
        });

        return response()->json([
            'success' => true,
            'message' => 'User deleted successfully.',
        ]);
    }

    protected function authorizeAdmin(Request $request): ?\Illuminate\Http\JsonResponse
    {
        $user = $this->getAuthenticatedUser($request);
        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Admin authorization required.'], 401);
        }
        if (strtolower(trim((string) $user->role)) !== 'admin') {
            return response()->json(['success' => false, 'message' => 'Admin authorization required.'], 403);
        }
        return null;
    }
}
