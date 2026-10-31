<?php

namespace App\Services;

use App\Models\AdminActivityLog;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Symfony\Component\HttpFoundation\Response;

class AdminActivityAuditService
{
    private const SENSITIVE_FIELDS = [
        'password',
        'password_confirmation',
        'current_password',
        'new_password',
        'token',
        'auth_token',
        'api_token',
        'secret',
        'authorization',
        'image',
        'image_file',
        'photo',
        'file',
        'files',
    ];

    private const RECORD_FIELDS = [
        'products' => ['id', 'name', 'category', 'price', 'stock', 'minimum_stock', 'small_price', 'big_price', 'meal_price', 'solo_price', 'sharing_price', 'combo_price', 'available', 'is_archived', 'description', 'deleted_at'],
        'product_sizes' => ['id', 'product_id', 'size', 'price', 'stock_quantity', 'threshold', 'available'],
        'ingredients' => ['id', 'name', 'unit', 'stock', 'unit_cost', 'threshold', 'expiry', 'deleted_at'],
        'orders' => ['id', 'order_number', 'status', 'payment_status', 'total', 'method', 'customer', 'email', 'delivery_date'],
        'users' => ['id', 'name', 'email', 'role', 'status', 'phone_number'],
        'promotions' => ['id', 'name', 'title', 'code', 'coupon_code', 'discount_type', 'discount_value', 'status', 'active'],
        'cake_flavors' => ['id', 'name', 'active'],
        'cake_sizes' => ['id', 'code', 'label', 'multiplier', 'active'],
        'product_recipes' => ['id', 'product_id', 'product_size_id', 'ingredient_id', 'ingredient_name', 'qty', 'unit', 'active'],
        'cake_recipes' => ['id', 'flavor_id', 'base_size_id', 'active'],
        'cake_recipe_ingredients' => ['id', 'recipe_id', 'ingredient_id', 'ingredient_name', 'quantity', 'unit'],
        'customized_cake_orders' => ['id', 'order_id', 'cake_type', 'status', 'notes'],
        'custom_cake_orders' => ['id', 'order_id', 'flavor', 'filling', 'frosting', 'occasion', 'theme_design', 'preferred_colors', 'cake_size', 'quantity', 'dedication', 'notes', 'estimated_price'],
        'custom_cake_request_settings' => ['id', 'enabled'],
        'admin_recycle_bin' => ['id', 'item_type', 'label', 'deleted_at', 'expires_at'],
        'discard_requests' => ['id', 'ingredient_id', 'ingredient_batch_id', 'quantity', 'reason', 'notes', 'status', 'requested_by', 'approved_by', 'rejected_by', 'rejection_note'],
        'waste_log' => ['id', 'datetime', 'item', 'qty', 'unit_cost', 'item_type', 'reason', 'ingredient_id', 'product_id', 'user_id', 'reference_type', 'reference_id', 'ingredient_batch_id', 'discard_request_id', 'unit'],
    ];

    public function captureBefore(Request $request, ?User $actor = null): array
    {
        $context = $this->context($request);
        $ids = $this->recordIds($request);
        if ($actor) {
            $ids['actor_id'] = (int) $actor->id;
        }

        return [
            'context' => $context,
            'ids' => $ids,
            'records' => $this->captureRecords($context['category'], $ids),
        ];
    }

    public function record(Request $request, Response $response, User $actor, array $before): void
    {
        if (!$this->isSuccessfulMutation($response)) {
            return;
        }

        if (!Schema::hasTable('admin_activity_logs')) {
            Log::error('Admin activity logging is unavailable because its database table is missing.', [
                'route' => $request->path(),
                'actor_id' => $actor->id,
            ]);

            return;
        }

        $responseData = $this->responseData($response);
        $ids = $this->recordIds($request, $responseData, $before['ids'] ?? []);
        $context = $before['context'] ?? $this->context($request);
        $after = $this->captureRecords($context['category'], $ids);
        $previousRecords = $before['records'] ?? [];
        $recordName = $this->recordName($context['category'], $after, $previousRecords, $request);
        [$action, $details] = $this->describeAction(
            $request,
            $response,
            $context,
            $recordName,
            $previousRecords,
            $after,
            $responseData
        );

        AdminActivityLog::create([
            'actor_id' => User::whereKey($actor->id)->exists() ? $actor->id : null,
            'actor_name' => (string) $actor->name,
            'actor_email' => (string) $actor->email,
            'actor_role' => strtolower(trim((string) $actor->role)),
            'action' => $action,
            'category' => $context['category'],
            'subject_type' => $context['subject_type'],
            'subject_id' => $this->subjectId($ids),
            'method' => strtoupper($request->method()),
            'route' => $request->route()?->uri() ?? $request->path(),
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'response_status' => $response->getStatusCode(),
            'details' => $this->sanitize($details),
        ]);
    }

    public function shouldExclude(Request $request): bool
    {
        $route = strtolower((string) ($request->route()?->uri() ?? $request->path()));

        return preg_match('~(?:^|/)login/?$~', $route) === 1
            || str_contains($route, 'sync-recipes');
    }

    private function isSuccessfulMutation(Response $response): bool
    {
        if ($response->getStatusCode() < 200 || $response->getStatusCode() >= 300) {
            return false;
        }

        $data = $this->responseData($response);
        if (($data['success'] ?? null) === false || strtolower((string) ($data['status'] ?? '')) === 'error') {
            return false;
        }

        return !($data['duplicate'] ?? false) && !($data['already_recorded'] ?? false);
    }

    private function context(Request $request): array
    {
        $route = strtolower((string) ($request->route()?->uri() ?? $request->path()));
        $category = match (true) {
            str_contains($route, 'recipe') => 'Recipe',
            str_contains($route, 'customized-cake') => 'Custom Cake',
            str_contains($route, 'ingredient'),
            str_contains($route, 'inventory'),
            str_contains($route, 'discard'),
            str_contains($route, 'waste') => 'Ingredients',
            str_contains($route, 'order') => 'Orders',
            str_contains($route, 'stock/mutate'),
            str_contains($route, 'product'),
            str_contains($route, 'production') => 'Products',
            str_contains($route, 'user') => 'Users',
            str_contains($route, 'promotion') => 'Promotions',
            str_contains($route, 'setting') => 'Settings',
            str_contains($route, 'notification'),
            str_contains($route, 'alert') => 'Notifications',
            str_contains($route, 'recycle-bin') => 'Recycle Bin',
            str_contains($route, 'review') => 'Reviews',
            str_contains($route, 'sales') => 'Sales',
            default => 'System',
        };

        return [
            'route' => $route,
            'category' => $category,
            'subject_type' => match ($category) {
                'Products' => 'product',
                'Ingredients' => str_contains($route, 'discard')
                    ? 'discard request'
                    : (str_contains($route, 'waste') ? 'waste record' : 'ingredient'),
                'Recipe' => 'recipe',
                'Orders' => 'order',
                'Custom Cake' => 'custom cake',
                'Users' => 'user',
                'Promotions' => 'promotion',
                'Settings' => 'shop settings',
                'Recycle Bin' => 'recycle bin entry',
                'Notifications' => 'notification',
                'Reviews' => 'review',
                'Sales' => 'sales import',
                default => 'system record',
            },
        ];
    }

    private function recordIds(Request $request, array $response = [], array $previous = []): array
    {
        $ids = $previous;
        foreach ($request->route()?->parameters() ?? [] as $key => $parameter) {
            if (is_object($parameter) && method_exists($parameter, 'getKey')) {
                $ids[strtolower((string) $key)] = (int) $parameter->getKey();
            } elseif (is_scalar($parameter) && is_numeric($parameter)) {
                $ids[strtolower((string) $key)] = (int) $parameter;
            }
        }

        foreach ([
            'discard_id' => data_get($response, 'request_id') ?? data_get($response, 'request.id'),
            'waste_id' => data_get($response, 'entry.id'),
        ] as $key => $value) {
            if (is_scalar($value) && is_numeric($value)) {
                $ids[$key] = (int) $value;
            }
        }

        foreach ([
            'product_id', 'product_size_id', 'ingredient_id', 'order_id', 'orderId',
            'user_id', 'flavor_id', 'size_id', 'recipe_id', 'promotion_id',
            'customized_cake_order_id', 'discard_id', 'request_id', 'waste_id',
        ] as $key) {
            $value = $request->input($key);
            if (is_scalar($value) && is_numeric($value)) {
                $ids[$key] = (int) $value;
            }
        }

        foreach ([
            'id', 'product_id', 'ingredient_id', 'order_id', 'user_id', 'promotion_id',
            'recipe_id', 'flavor_id', 'size_id',
        ] as $key) {
            $resource = rtrim($key, '_id');
            $value = data_get($response, $key)
                ?? data_get($response, 'data.' . $key)
                ?? data_get($response, $resource . '.id')
                ?? data_get($response, 'data.' . $resource . '.id');
            if (is_scalar($value) && is_numeric($value)) {
                $ids[$key] = (int) $value;
            }
        }

        if (!isset($ids['product_id']) && isset($ids['product_size_id']) && Schema::hasTable('product_sizes')) {
            $ids['product_id'] = (int) DB::table('product_sizes')->where('id', $ids['product_size_id'])->value('product_id');
        }

        return $ids;
    }

    private function captureRecords(string $category, array $ids): array
    {
        $records = [];
        $lookup = match ($category) {
            'Products' => [
                'product' => ['products', $ids['product_id'] ?? $ids['product'] ?? $ids['id'] ?? null],
                'size' => ['product_sizes', $ids['product_size_id'] ?? $ids['size'] ?? null],
            ],
            'Ingredients' => [
                'ingredient' => ['ingredients', $ids['ingredient_id'] ?? $ids['ingredient'] ?? $ids['id'] ?? null],
                'discard_request' => ['discard_requests', $ids['discard_id'] ?? $ids['discard'] ?? null],
                'waste_log' => ['waste_log', $ids['waste_id'] ?? null],
            ],
            'Orders' => [
                'order' => ['orders', $ids['order_id'] ?? $ids['orderid'] ?? $ids['id'] ?? null],
            ],
            'Users' => [
                'user' => ['users', $ids['user_id'] ?? $ids['user'] ?? $ids['id'] ?? null],
            ],
            'Promotions' => [
                'promotion' => ['promotions', $ids['promotion_id'] ?? $ids['promotion'] ?? null],
            ],
            'Recipe' => [
                'product' => ['products', $ids['product_id'] ?? $ids['product'] ?? null],
                'size' => ['product_sizes', $ids['product_size_id'] ?? $ids['product_size'] ?? null],
                'flavor' => ['cake_flavors', $ids['flavor_id'] ?? null],
            ],
            'Custom Cake' => [
                'order' => ['orders', $ids['order_id'] ?? $ids['orderid'] ?? $ids['id'] ?? null],
                'flavor' => ['cake_flavors', $ids['flavor_id'] ?? $ids['flavor'] ?? null],
                'size' => ['cake_sizes', $ids['size_id'] ?? $ids['size'] ?? null],
                'customized_cake_order' => ['customized_cake_orders', $ids['customized_cake_order_id'] ?? $ids['customizedcakeorderid'] ?? null],
                'request_settings' => ['custom_cake_request_settings', 1],
            ],
            'Recycle Bin' => [
                'recycle_bin_entry' => ['admin_recycle_bin', $ids['entryid'] ?? $ids['entry_id'] ?? $ids['id'] ?? null],
            ],
            default => [],
        };

        foreach ($lookup as $key => [$table, $id]) {
            if (!$id || !Schema::hasTable($table)) {
                continue;
            }
            $row = DB::table($table)->where('id', $id)->first();
            if ($row) {
                $records[$key] = $this->selectFields((array) $row, self::RECORD_FIELDS[$table] ?? []);
            }
        }

        if ($category === 'Recipe') {
            $productId = $ids['product_id'] ?? $ids['product'] ?? null;
            if ($productId && Schema::hasTable('product_recipes')) {
                $query = $this->recipeLineQuery('product_recipes')->where('audit_lines.product_id', $productId);
                if (!empty($ids['product_size_id'])) {
                    $query->where('audit_lines.product_size_id', $ids['product_size_id']);
                }
                $records['recipe_lines'] = $query->get()->map(
                    fn ($row) => $this->selectFields((array) $row, self::RECORD_FIELDS['product_recipes'])
                )->all();
            }
            $flavorId = $ids['flavor_id'] ?? null;
            $recipeId = $ids['recipe_id'] ?? $ids['recipeid'] ?? null;
            if (($flavorId || $recipeId) && Schema::hasTable('cake_recipes')) {
                $cakeRecipeQuery = DB::table('cake_recipes');
                if ($recipeId) {
                    $cakeRecipeQuery->where('id', $recipeId);
                } else {
                    $cakeRecipeQuery->where('flavor_id', $flavorId);
                }
                $cakeRecipe = $cakeRecipeQuery->first();
                if ($cakeRecipe) {
                    $records['cake_recipe'] = $this->selectFields((array) $cakeRecipe, self::RECORD_FIELDS['cake_recipes']);
                    if (!isset($records['flavor']) && Schema::hasTable('cake_flavors')) {
                        $flavor = DB::table('cake_flavors')->where('id', $cakeRecipe->flavor_id)->first();
                        if ($flavor) {
                            $records['flavor'] = $this->selectFields((array) $flavor, self::RECORD_FIELDS['cake_flavors']);
                        }
                    }
                    if (Schema::hasTable('cake_recipe_ingredients')) {
                        $records['cake_recipe_lines'] = $this->recipeLineQuery('cake_recipe_ingredients')
                            ->where('audit_lines.recipe_id', $cakeRecipe->id)
                            ->get()
                            ->map(fn ($row) => $this->selectFields((array) $row, self::RECORD_FIELDS['cake_recipe_ingredients']))
                            ->all();
                    }
                } else {
                    $records['cake_recipe_lines'] = [];
                }
            }
        }

        if ($category === 'Ingredients' && isset($records['discard_request'])
            && !isset($records['ingredient']) && Schema::hasTable('ingredients')) {
            $ingredient = DB::table('ingredients')->where('id', $records['discard_request']['ingredient_id'])->first();
            if ($ingredient) {
                $records['ingredient'] = $this->selectFields((array) $ingredient, self::RECORD_FIELDS['ingredients']);
            }
        }

        if ($category === 'Ingredients' && isset($records['ingredient']) && Schema::hasTable('ingredient_batches')) {
            $ingredientId = $records['ingredient']['id'] ?? null;
            if ($ingredientId) {
                $records['ingredient_stock'] = (float) DB::table('ingredient_batches')
                    ->where('ingredient_id', $ingredientId)
                    ->sum('quantity_remaining');
            }
        }

        if ($category === 'Orders') {
            $orderId = $ids['order_id'] ?? $ids['orderid'] ?? $ids['id'] ?? null;
            foreach (['customized_cake_orders', 'custom_cake_orders'] as $table) {
                if ($orderId && Schema::hasTable($table)) {
                    $row = DB::table($table)->where('order_id', $orderId)->first();
                    if ($row) {
                        $recordKey = $table === 'customized_cake_orders' ? 'customized_cake_order' : 'custom_cake_order';
                        $records[$recordKey] = $this->selectFields((array) $row, self::RECORD_FIELDS[$table]);
                    }
                }
            }
        }

        if ($category === 'Settings') {
            if (Schema::hasTable('shop_settings')) {
                $storedSettings = DB::table('shop_settings')->where('id', 1)->value('settings');
                $settings = is_string($storedSettings) ? json_decode($storedSettings, true) : null;
                if (is_array($settings)) {
                    $records['settings'] = $settings;
                }
            }
            $actorId = $ids['actor_id'] ?? null;
            if ($actorId && Schema::hasTable('admin_notification_preferences')) {
                $preferences = DB::table('admin_notification_preferences')->where('user_id', $actorId)->first();
                if ($preferences) {
                    $records['notification_preferences'] = [
                        'orderAlerts' => (bool) $preferences->order_alerts,
                        'lowStockAlerts' => (bool) $preferences->low_stock_alerts,
                        'messageAlerts' => (bool) $preferences->message_alerts,
                        'promotionAlerts' => (bool) $preferences->promotion_alerts,
                    ];
                }
            }
        }

        return $records;
    }

    private function describeAction(
        Request $request,
        Response $response,
        array $context,
        string $recordName,
        array $before,
        array $after,
        array $responseData
    ): array {
        $method = strtoupper($request->method());
        $route = $context['route'];
        $success = $this->isSuccessfulMutation($response);
        $name = $recordName !== '' ? $recordName : $context['subject_type'];
        $changes = $this->recordChanges($before, $after);

        if (!$success) {
            return ["Unable to complete changes for {$name}", [
                'Record' => $name,
                'Result' => $this->responseMessage($responseData),
            ]];
        }

        if (str_contains($route, 'staff/production')) {
            $quantity = max(0, $request->integer('quantity'));
            $size = (string) ($after['size']['size'] ?? $before['size']['size'] ?? '');
            $action = "Added {$quantity} {$name}" . ($size !== '' ? " ({$size})" : '') . ' to stock';
            $details = [
                'Product' => $name,
                'Quantity added' => $quantity,
            ];
            if ($size !== '') {
                $details['Size'] = $size;
            }
            if ($request->filled('expiry_date')) {
                $details['Expiry date'] = $request->input('expiry_date');
            }
            $oldStock = $before['size']['stock_quantity'] ?? $before['product']['stock'] ?? null;
            $newStock = data_get($responseData, 'size_stock') ?? data_get($responseData, 'new_stock')
                ?? $after['size']['stock_quantity'] ?? $after['product']['stock'] ?? null;
            if (is_numeric($oldStock)) {
                $details['Previous stock'] = $this->normalizeNumber($oldStock);
            }
            if (is_numeric($newStock)) {
                $details['New stock'] = $this->normalizeNumber($newStock);
            }

            return [$action, $details];
        }

        if (str_contains($route, 'stock/mutate')) {
            $quantity = $request->input('quantity');
            $isStockIn = strtolower((string) $request->input('action_type')) === 'stock_in';
            $action = ($isStockIn ? 'Stocked in ' : 'Stocked out ') . $name;

            return [$action, $this->stockDetails($request, 'Product', $name, $quantity, $isStockIn, $before, $after, 'size')];
        }

        if (str_contains($route, 'adjust-stock') || str_contains($route, 'inventory/batches')) {
            $quantity = $request->input('qty', $request->input('quantity_received'));
            $isStockIn = in_array(strtolower((string) $request->input('action', 'stock_in')), ['stock_in'], true);
            $action = ($isStockIn ? 'Stocked in ' : 'Stocked out ') . $name;

            return [$action, $this->stockDetails($request, 'Ingredient', $name, $quantity, $isStockIn, $before, $after, 'ingredient')];
        }

        $isDelete = $method === 'DELETE' || str_contains($route, 'delete');
        $verb = $isDelete ? 'Deleted' : match ($context['category']) {
            'Orders' => str_contains($route, 'status') ? 'Updated order status for' : 'Updated order',
            'Recipe' => $isDelete ? 'Deleted recipe for' : 'Updated recipe for',
            'Custom Cake' => str_contains($route, 'request-status') ? 'Updated custom cake request settings' : 'Updated custom cake',
            'Products' => isset($before['product']) || isset($before['size']) ? 'Updated' : 'Added',
            'Ingredients' => isset($before['ingredient']) ? 'Updated' : 'Added',
            'Users' => isset($before['user']) ? 'Updated account' : 'Created account',
            'Recycle Bin' => str_contains($route, 'restore')
                ? 'Restored'
                : ($method === 'DELETE' ? 'Permanently deleted' : 'Updated'),
            default => $isDelete ? 'Deleted' : ($method === 'POST' ? 'Added' : 'Updated'),
        };

        if (str_contains($route, 'discards') && str_contains($route, 'approve')) {
            $verb = 'Approved discard request for';
        } elseif (str_contains($route, 'discards') && str_contains($route, 'reject')) {
            $verb = 'Rejected discard request for';
        } elseif (str_contains($route, 'discards')) {
            $verb = !empty($responseData['auto_approved'])
                ? 'Automatically approved discard request for'
                : 'Submitted discard request for';
        } elseif (str_contains($route, 'waste')) {
            $verb = 'Recorded waste:';
        } elseif ($context['category'] === 'Orders' && str_contains($route, 'cancel')) {
            $verb = 'Cancelled order';
        } elseif ($context['category'] === 'Recycle Bin' && $method === 'DELETE') {
            $verb = 'Permanently deleted';
        } elseif ($context['category'] === 'Orders'
            && str_contains($route, 'status')
            && !empty($before['customized_cake_order'])
            && in_array(strtolower((string) $request->input('status')), ['preparing', 'confirmed', 'approved'], true)) {
            $verb = 'Approved custom cake request for';
        } elseif ($context['category'] === 'Orders'
            && str_contains($route, 'status')
            && !empty($before['customized_cake_order'])
            && in_array(strtolower((string) $request->input('status')), ['rejected', 'declined'], true)) {
            $verb = 'Rejected custom cake request for';
        } elseif ($context['category'] === 'Orders' && str_contains($route, 'status')
            && in_array(strtolower((string) $request->input('status')), ['preparing', 'confirmed', 'approved'], true)) {
            $verb = 'Accepted order';
        } elseif ($context['category'] === 'Custom Cake' && str_contains($route, 'approve')) {
            $verb = 'Approved custom cake request';
        } elseif ($context['category'] === 'Custom Cake' && str_contains($route, 'reject')) {
            $verb = 'Rejected custom cake request';
        } elseif ($context['category'] === 'Custom Cake' && str_contains($route, 'consume-inventory')) {
            $verb = 'Consumed inventory for';
        } elseif ($context['category'] === 'Custom Cake' && str_contains($route, 'flavors')) {
            $verb = isset($before['flavor']) ? 'Updated custom cake flavor' : 'Added custom cake flavor';
        } elseif ($context['category'] === 'Custom Cake' && str_contains($route, 'sizes')) {
            $verb = isset($before['size']) ? 'Updated custom cake size' : 'Added custom cake size';
        } elseif ($context['category'] === 'Recipe' && str_contains($route, 'recipe')) {
            $wasRecipePresent = isset($before['cake_recipe']) || !empty($before['recipe_lines']);
            $verb = $isDelete
                ? 'Deleted recipe for'
                : ($wasRecipePresent ? 'Updated recipe for' : 'Created recipe for');
        } elseif (str_contains($route, 'archive')) {
            $verb = 'Changed availability for';
        } elseif (str_contains($route, 'restore')) {
            $verb = 'Restored';
        }

        $action = $context['category'] === 'Custom Cake' && str_contains($route, 'request-status')
            ? $verb
            : trim($verb . ' ' . $name);
        $details = ['Record' => $name];
        if ($context['category'] === 'Ingredients' && $this->isCreateRequest($request, $before, $context)
            && is_numeric($request->input('stock')) && (float) $request->input('stock') > 0) {
            $details['Initial stock'] = [
                'Quantity added' => $this->normalizeNumber($request->input('stock')),
                'Previous stock' => 0,
                'New stock' => $after['ingredient_stock'] ?? $after['ingredient']['stock'] ?? null,
            ];
        }
        $target = $this->routeTargets($request);
        if ($target !== []) {
            $details['Target'] = $target;
        }
        if ($changes !== []) {
            $details['Changes'] = $changes;
        }
        if ($this->isCreateRequest($request, $before, $context)) {
            $inputDetails = $this->businessInput($request);
            if ($inputDetails !== []) {
                $details['Added information'] = $inputDetails;
            }
        } elseif ($changes === []) {
            $inputDetails = $this->businessInput($request);
            if ($inputDetails !== []) {
                $details['Submitted values'] = $inputDetails;
            }
        }
        if (isset($responseData['message']) && $details === ['Record' => $name]) {
            $details['Description'] = $responseData['message'];
        }

        return [$action, $details];
    }

    private function stockDetails(
        Request $request,
        string $label,
        string $name,
        mixed $quantity,
        bool $stockIn,
        array $before,
        array $after,
        string $recordKey
    ): array {
        $old = $recordKey === 'size'
            ? ($before['size']['stock_quantity'] ?? null)
            : ($before['ingredient_stock'] ?? $before['ingredient']['stock'] ?? null);
        $new = $recordKey === 'size'
            ? ($after['size']['stock_quantity'] ?? null)
            : ($after['ingredient_stock'] ?? $after['ingredient']['stock'] ?? null);
        $details = [
            $label => $name,
            $stockIn ? 'Quantity added' : 'Quantity removed' => is_numeric($quantity)
                ? $this->normalizeNumber($quantity)
                : $quantity,
        ];
        if ($recordKey === 'size') {
            $size = $after['size']['size'] ?? $before['size']['size'] ?? null;
            if ($size) {
                $details['Size'] = $size;
            }
        }
        $reason = $request->input('reason', $request->input('note'));
        if (is_string($reason) && trim($reason) !== '') {
            $details['Reason'] = $reason;
        }
        if (is_numeric($old)) {
            $details['Previous stock'] = $this->normalizeNumber($old);
        }
        if (is_numeric($new)) {
            $details['New stock'] = $this->normalizeNumber($new);
        }

        return $details;
    }

    private function normalizeNumber(mixed $value): int|float
    {
        $number = (float) $value;

        return floor($number) === $number ? (int) $number : $number;
    }

    private function recordChanges(array $before, array $after): array
    {
        $changes = [];
        foreach (array_unique(array_merge(array_keys($before), array_keys($after))) as $recordType) {
            $oldRecord = $before[$recordType] ?? null;
            $newRecord = $after[$recordType] ?? null;
            if (($oldRecord === null || (is_array($oldRecord) && !$this->isListArray($oldRecord)))
                && ($newRecord === null || (is_array($newRecord) && !$this->isListArray($newRecord)))) {
                $oldFields = is_array($oldRecord) ? $oldRecord : [];
                $newFields = is_array($newRecord) ? $newRecord : [];
                foreach (array_unique(array_merge(array_keys($oldFields), array_keys($newFields))) as $field) {
                    if (in_array($field, ['id', 'updated_at', 'created_at'], true)) {
                        continue;
                    }
                    $oldValue = $oldFields[$field] ?? null;
                    $newValue = $newFields[$field] ?? null;
                    if ($this->valuesDiffer($oldValue, $newValue)) {
                        $changes[$recordType][$field] = ['Before' => $oldValue, 'After' => $newValue];
                    }
                }
            } elseif ($this->valuesDiffer($oldRecord, $newRecord)) {
                $changes[$recordType] = ['Before' => $oldRecord, 'After' => $newRecord];
            }
        }

        return $changes;
    }

    private function recipeLineQuery(string $table)
    {
        $query = DB::table($table . ' as audit_lines')->select('audit_lines.*');
        if (Schema::hasTable('ingredients')) {
            $query->leftJoin('ingredients as audit_ingredients', 'audit_ingredients.id', '=', 'audit_lines.ingredient_id')
                ->addSelect('audit_ingredients.name as ingredient_name');
        }

        return $query;
    }

    private function isListArray(array $value): bool
    {
        return $value === [] || array_keys($value) === range(0, count($value) - 1);
    }

    private function valuesDiffer(mixed $before, mixed $after): bool
    {
        if (is_array($before) || is_array($after)) {
            return json_encode($before) !== json_encode($after);
        }
        if (($before === null) !== ($after === null)) {
            return true;
        }

        return (string) $before !== (string) $after;
    }

    private function isCreateRequest(Request $request, array $before, array $context): bool
    {
        return strtoupper($request->method()) === 'POST'
            && empty($before['records'][$this->recordKey($context['category'])]);
    }

    private function recordKey(string $category): string
    {
        return match ($category) {
            'Products' => 'product',
            'Ingredients' => 'ingredient',
            'Orders' => 'order',
            'Users' => 'user',
            'Promotions' => 'promotion',
            'Recipe' => 'recipe_lines',
            default => '',
        };
    }

    private function recordName(string $category, array $after, array $before, Request $request): string
    {
        $records = $after + $before;
        $route = strtolower((string) ($request->route()?->uri() ?? $request->path()));
        if (str_contains($route, 'waste') && isset($records['waste_log']['item'])) {
            return (string) $records['waste_log']['item'];
        }
        if (str_contains($route, 'discard') && isset($records['ingredient']['name'])) {
            return (string) $records['ingredient']['name'];
        }
        $name = match ($category) {
            'Products' => $records['product']['name'] ?? null,
            'Ingredients' => $records['ingredient']['name'] ?? null,
            'Orders' => $records['order']['order_number'] ?? null,
            'Users' => $records['user']['name'] ?? $request->input('name'),
            'Recipe' => $records['product']['name'] ?? $records['flavor']['name'] ?? null,
            'Custom Cake' => $records['order']['order_number'] ?? $records['flavor']['name'] ?? $records['size']['label'] ?? null,
            'Promotions' => $records['promotion']['name'] ?? $records['promotion']['title'] ?? null,
            'Settings' => 'Shop settings',
            'Recycle Bin' => $records['recycle_bin_entry']['label'] ?? null,
            default => null,
        };

        if (is_string($name) && trim($name) !== '') {
            return trim($name);
        }
        if ($category === 'Custom Cake' && isset($records['customized_cake_order']['id'])) {
            return 'Custom cake request #' . $records['customized_cake_order']['id'];
        }
        if ($category === 'Orders' && empty($name)) {
            $id = $records['order']['id'] ?? $request->route('id') ?? $request->route('orderId') ?? $request->input('order_id');
            return $id ? 'Order #' . $id : 'order';
        }

        return match ($category) {
            'Products' => 'product',
            'Ingredients' => 'ingredient',
            'Orders' => 'order',
            'Users' => 'account',
            'Recipe' => 'recipe',
            'Custom Cake' => 'custom cake request',
            'Promotions' => 'promotion',
            default => 'system record',
        };
    }

    private function responseData(Response $response): array
    {
        $data = json_decode($response->getContent(), true);

        return is_array($data) ? $data : [];
    }

    private function responseMessage(array $responseData): string
    {
        return mb_substr((string) ($responseData['message'] ?? 'The request did not complete successfully.'), 0, 300);
    }

    private function subjectId(array $ids): ?string
    {
        foreach ([
            'waste_id', 'discard_id', 'request_id',
            'product_id', 'product_size_id', 'ingredient_id', 'order_id', 'orderid',
            'customized_cake_order_id', 'customizedcakeorderid', 'discard_id', 'discard',
            'request_id', 'waste_id', 'id', 'user_id', 'promotion_id', 'flavor_id', 'recipe_id',
        ] as $key) {
            if (isset($ids[$key]) && is_numeric($ids[$key])) {
                return (string) $ids[$key];
            }
        }

        return null;
    }

    private function selectFields(array $record, array $allowedFields): array
    {
        return array_intersect_key($record, array_flip($allowedFields));
    }

    private function businessInput(Request $request): array
    {
        return $this->sanitize($request->except(self::SENSITIVE_FIELDS));
    }

    private function routeTargets(Request $request): array
    {
        $targets = [];
        foreach ($request->route()?->parameters() ?? [] as $key => $value) {
            if (is_object($value) && method_exists($value, 'getKey')) {
                $targets[$key] = $value->getKey();
            } elseif (is_scalar($value)) {
                $targets[$key] = $value;
            }
        }

        return $this->sanitize($targets);
    }

    private function sanitize(mixed $value, ?string $key = null): mixed
    {
        if ($key !== null && (
            preg_match('/password|token|secret|authorization|cookie|credential|api.?key|cvv|proof|pin|otp|verification|reset_code/i', $key)
            || preg_match('/(?:^|[^a-z])card(?:$|[^a-z])/i', $key)
            || preg_match('/^(?:card|Card)[A-Z]|[a-z]Card[A-Z]/', $key)
        )) {
            return '[REDACTED]';
        }

        if (is_array($value)) {
            $sanitized = [];
            foreach (array_slice($value, 0, 50, true) as $childKey => $childValue) {
                if (is_string($childKey) && preg_match('/image|file|upload/i', $childKey)) {
                    continue;
                }
                $sanitized[$childKey] = $this->sanitize($childValue, (string) $childKey);
            }

            return $sanitized;
        }

        if (is_string($value)) {
            return mb_substr($value, 0, 500);
        }

        return is_scalar($value) || $value === null ? $value : null;
    }
}
