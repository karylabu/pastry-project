<?php
require 'vendor/autoload.php';
$app = require 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$request = new Illuminate\Http\Request();
$request->setMethod('PUT');
$request->request->add(['name' => 'controller-direct-update', 'email' => 'controller-direct@example.com', 'role' => 'customer', 'status' => 'active']);
$user = App\Models\User::find(26);
$controller = new App\Http\Controllers\Api\UserController();
$response = $controller->update($request, $user);
$payload = json_decode($response->getContent(), true);
var_dump($payload);

echo PHP_EOL, 'DB: ', App\Models\User::find(26)->name, PHP_EOL;
