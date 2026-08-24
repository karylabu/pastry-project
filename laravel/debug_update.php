<?php
require 'vendor/autoload.php';
$app = require 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$user = App\Models\User::find(26);
$user->name = 'php-script-update';
$user->save();
echo $user->fresh()->name, PHP_EOL;
