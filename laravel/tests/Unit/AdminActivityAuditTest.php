<?php

namespace Tests\Unit;

use App\Http\Middleware\AuditAdminActivity;
use Illuminate\Http\Request;
use PHPUnit\Framework\TestCase;

class AdminActivityAuditTest extends TestCase
{
    /**
     * @dataProvider auditedActions
     */
    public function test_it_describes_operational_actions(string $method, string $uri, array $input, array $expected): void
    {
        $request = Request::create('/' . str_replace('{id}', '42', $uri), $method, $input);
        $request->setRouteResolver(static fn () => new class ($uri) {
            public function __construct(private string $routeUri)
            {
            }

            public function uri(): string
            {
                return $this->routeUri;
            }

            public function parameters(): array
            {
                return str_contains($this->routeUri, '{id}') ? ['id' => 42] : [];
            }
        });

        $describeRequest = new \ReflectionMethod(AuditAdminActivity::class, 'describeRequest');
        $describeRequest->setAccessible(true);
        $actual = $describeRequest->invoke(new AuditAdminActivity(), $request);

        $this->assertSame($expected, $actual);
    }

    public static function auditedActions(): array
    {
        return [
            'accepting an order' => [
                'PUT',
                'api/staff/orders/{id}/status',
                ['status' => 'Preparing'],
                ['Accepted order', 'Orders', 'order', '42'],
            ],
            'deleting an ingredient' => [
                'DELETE',
                'api/staff/ingredients/{id}',
                [],
                ['Deleted ingredient', 'Ingredients', 'ingredient', '42'],
            ],
            'stocking in a product' => [
                'POST',
                'api/admin/stock/mutate',
                ['product_size_id' => 23, 'action_type' => 'stock_in', 'quantity' => 4],
                ['Stocked in product', 'Products', 'product', '23'],
            ],
            'saving a recipe' => [
                'PUT',
                'api/staff/products/{id}/recipe',
                [],
                ['Saved recipe', 'Recipe', 'recipe', '42'],
            ],
        ];
    }
}
