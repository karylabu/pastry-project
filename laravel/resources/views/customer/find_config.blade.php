@extends('customer.layout')

@section('title', 'Find Config')

@section('content')
<div class="card">
    <h1>Config Files</h1>

    @if (empty($files))
        <p>No config.php files were found.</p>
    @else
        <ul>
            @foreach ($files as $file)
                <li>{{ $file }}</li>
            @endforeach
        </ul>
    @endif
</div>
@endsection
