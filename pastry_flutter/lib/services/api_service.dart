/// API Service
/// Centralized HTTP client using Dio with interceptors for authentication,
/// error handling, and request/response logging

import 'package:dio/dio.dart';
import 'package:logger/logger.dart';
import '../config/api_config.dart';
import 'secure_storage_service.dart';

class ApiService {
  static final ApiService _instance = ApiService._internal();

  late final Dio _dio;
  final _logger = Logger();
  final _storage = SecureStorageService();

  ApiService._internal() {
    _initializeDio();
  }

  factory ApiService() {
    return _instance;
  }

  /// Initialize Dio instance with interceptors and configuration
  void _initializeDio() {
    _dio = Dio(
      BaseOptions(
        connectTimeout: ApiConfig.connectTimeout,
        receiveTimeout: ApiConfig.receiveTimeout,
        sendTimeout: ApiConfig.sendTimeout,
        headers: ApiConfig.defaultHeaders,
        contentType: 'application/json',
      ),
    );

    // Add interceptors
    _dio.interceptors.addAll([
      _AuthInterceptor(_storage, _logger),
      _LoggingInterceptor(_logger),
      _ErrorInterceptor(_logger),
    ]);
  }

  /// Get Dio instance (for advanced usage)
  Dio get dio => _dio;

  /// Generic GET request
  Future<Response<T>> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
  }) async {
    try {
      return await _dio.get<T>(
        path,
        queryParameters: queryParameters,
        options: options,
        cancelToken: cancelToken,
      );
    } catch (e) {
      _logger.e('GET Error: $path', error: e);
      rethrow;
    }
  }

  /// Generic POST request
  Future<Response<T>> post<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
  }) async {
    try {
      return await _dio.post<T>(
        path,
        data: data,
        queryParameters: queryParameters,
        options: options,
        cancelToken: cancelToken,
      );
    } catch (e) {
      _logger.e('POST Error: $path', error: e);
      rethrow;
    }
  }

  /// Generic PUT request
  Future<Response<T>> put<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
  }) async {
    try {
      return await _dio.put<T>(
        path,
        data: data,
        queryParameters: queryParameters,
        options: options,
        cancelToken: cancelToken,
      );
    } catch (e) {
      _logger.e('PUT Error: $path', error: e);
      rethrow;
    }
  }

  /// Generic DELETE request
  Future<Response<T>> delete<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
  }) async {
    try {
      return await _dio.delete<T>(
        path,
        data: data,
        queryParameters: queryParameters,
        options: options,
        cancelToken: cancelToken,
      );
    } catch (e) {
      _logger.e('DELETE Error: $path', error: e);
      rethrow;
    }
  }

  /// Update base URL at runtime (useful for switching environments)
  void setBaseUrl(String baseUrl) {
    _dio.options.baseUrl = baseUrl;
  }

  /// Add custom header
  void addHeader(String key, String value) {
    _dio.options.headers[key] = value;
  }

  /// Remove custom header
  void removeHeader(String key) {
    _dio.options.headers.remove(key);
  }

  /// Clear all headers
  void clearHeaders() {
    _dio.options.headers.clear();
    _dio.options.headers.addAll(ApiConfig.defaultHeaders);
  }
}

/// Authentication Interceptor
/// Adds JWT token to all requests and handles token refresh
class _AuthInterceptor extends Interceptor {
  final SecureStorageService _storage;
  final Logger _logger;

  _AuthInterceptor(this._storage, this._logger);

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final token = await _storage.getToken();

    if (token != null && token.isNotEmpty) {
      options.headers['Authorization'] = 'Bearer $token';
    }

    _logger.i('📤 API Request: ${options.method} ${options.path}');
    return handler.next(options);
  }

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    // Handle 401 Unauthorized - token might be expired
    if (err.response?.statusCode == 401) {
      _logger.w('🔐 Unauthorized (401) - Token may be expired');
      // Refresh token logic not implemented yet; only logging the error for now.
    }

    return handler.next(err);
  }
}

/// Logging Interceptor
/// Logs all requests and responses for debugging
class _LoggingInterceptor extends Interceptor {
  final Logger _logger;

  _LoggingInterceptor(this._logger);

  @override
  Future<void> onResponse(
    Response response,
    ResponseInterceptorHandler handler,
  ) async {
    _logger.d(
      '📥 API Response: ${response.statusCode} - ${response.requestOptions.path}',
    );
    return handler.next(response);
  }

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    _logger.e(
      '❌ API Error: ${err.type.name} - ${err.message}',
      error: err.error,
      stackTrace: err.stackTrace,
    );
    return handler.next(err);
  }
}

/// Error Interceptor
/// Handles common HTTP errors
class _ErrorInterceptor extends Interceptor {
  final Logger _logger;

  _ErrorInterceptor(this._logger);

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    String errorMessage = _getErrorMessage(err);
    _logger.e('🚨 Error: $errorMessage');
    return handler.next(err);
  }

  String _getErrorMessage(DioException error) {
    switch (error.type) {
      case DioExceptionType.badCertificate:
        return 'Certificate error. Please check your connection.';
      case DioExceptionType.badResponse:
        return 'Server returned ${error.response?.statusCode}';
      case DioExceptionType.cancel:
        return 'Request cancelled.';
      case DioExceptionType.connectionError:
        return 'Connection error. Please check your internet.';
      case DioExceptionType.connectionTimeout:
        return 'Connection timeout. Please try again.';
      case DioExceptionType.receiveTimeout:
        return 'Server took too long to respond.';
      case DioExceptionType.sendTimeout:
        return 'Upload timeout. Please try again.';
      case DioExceptionType.unknown:
        return 'Unknown error occurred.';
      default:
        return 'Unexpected network error.';
    }
  }
}
