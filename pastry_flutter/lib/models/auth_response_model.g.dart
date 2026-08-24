// GENERATED CODE - manual stub

part of 'auth_response_model.dart';

ApiResponse<T> _$ApiResponseFromJson<T>(
    Map<String, dynamic> json, T Function(Object? json) fromJsonT) {
  return ApiResponse<T>(
    success: json['success'] as bool,
    message: json['message'] as String,
    data: json['data'] == null ? null : fromJsonT(json['data']),
    error: json['error'] as String?,
    code: json['code'] as int?,
  );
}

Map<String, dynamic> _$ApiResponseToJson<T>(
        ApiResponse<T> instance, Object? Function(T value) toJsonT) =>
    <String, dynamic>{
      'success': instance.success,
      'message': instance.message,
      'data': instance.data == null ? null : toJsonT(instance.data as T),
      'error': instance.error,
      'code': instance.code,
    };

LoginResponse _$LoginResponseFromJson(Map<String, dynamic> json) {
  return LoginResponse(
    success: json['success'] as bool,
    message: json['message'] as String,
    user: json['user'] == null ? null : User.fromJson(json['user'] as Map<String, dynamic>),
    token: json['token'] as String? ?? '',
    tokenType: json['token_type'] as String? ?? 'Bearer',
    expiresIn: json['expires_in'] as int?,
  );
}

Map<String, dynamic> _$LoginResponseToJson(LoginResponse instance) =>
    <String, dynamic>{
      'success': instance.success,
      'message': instance.message,
      'user': instance.user?.toJson(),
      'token': instance.token,
      'token_type': instance.tokenType,
      'expires_in': instance.expiresIn,
    };

RegisterResponse _$RegisterResponseFromJson(Map<String, dynamic> json) {
  return RegisterResponse(
    success: json['success'] as bool,
    message: json['message'] as String,
    user: json['user'] == null ? null : User.fromJson(json['user'] as Map<String, dynamic>),
    token: json['token'] as String? ?? '',
  );
}

Map<String, dynamic> _$RegisterResponseToJson(RegisterResponse instance) =>
    <String, dynamic>{
      'success': instance.success,
      'message': instance.message,
      'user': instance.user?.toJson(),
      'token': instance.token,
    };

ForgotPasswordResponse _$ForgotPasswordResponseFromJson(
    Map<String, dynamic> json) {
  return ForgotPasswordResponse(
    success: json['success'] as bool,
    message: json['message'] as String,
  );
}

Map<String, dynamic> _$ForgotPasswordResponseToJson(
        ForgotPasswordResponse instance) =>
    <String, dynamic>{
      'success': instance.success,
      'message': instance.message,
    };

VerifyResetCodeResponse _$VerifyResetCodeResponseFromJson(
    Map<String, dynamic> json) {
  return VerifyResetCodeResponse(
    success: json['success'] as bool,
    message: json['message'] as String,
    token: json['token'] as String? ?? '',
  );
}

Map<String, dynamic> _$VerifyResetCodeResponseToJson(
        VerifyResetCodeResponse instance) =>
    <String, dynamic>{
      'success': instance.success,
      'message': instance.message,
      'token': instance.token,
    };

ResetPasswordResponse _$ResetPasswordResponseFromJson(
    Map<String, dynamic> json) {
  return ResetPasswordResponse(
    success: json['success'] as bool,
    message: json['message'] as String,
  );
}

Map<String, dynamic> _$ResetPasswordResponseToJson(
        ResetPasswordResponse instance) =>
    <String, dynamic>{
      'success': instance.success,
      'message': instance.message,
    };

ErrorResponse _$ErrorResponseFromJson(Map<String, dynamic> json) {
  return ErrorResponse(
    success: json['success'] as bool,
    message: json['message'] as String,
    errors: json['errors'] as Map<String, dynamic>?,
  );
}

Map<String, dynamic> _$ErrorResponseToJson(ErrorResponse instance) =>
    <String, dynamic>{
      'success': instance.success,
      'message': instance.message,
      'errors': instance.errors,
    };
