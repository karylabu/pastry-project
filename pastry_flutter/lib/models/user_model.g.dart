// GENERATED CODE - manual stub

part of 'user_model.dart';

User _$UserFromJson(Map<String, dynamic> json) {
  return User(
    id: json['id'] as int,
    userId: json['user_id'] as int?,
    name: json['name'] as String,
    email: json['email'] as String,
    phone: (json['phone'] ?? '') as String,
    role: json['role'] as String,
    address: (json['address'] ?? '') as String,
    city: (json['city'] ?? '') as String,
    postalCode: (json['postal_code'] ?? '') as String,
    country: (json['country'] ?? '') as String,
    profilePicture: json['profile_picture'] as String?,
    createdAt: json['created_at'] as String?,
    updatedAt: json['updated_at'] as String?,
  );
}

Map<String, dynamic> _$UserToJson(User instance) => <String, dynamic>{
      'id': instance.id,
      'user_id': instance.userId,
      'name': instance.name,
      'email': instance.email,
      'phone': instance.phone,
      'role': instance.role,
      'address': instance.address,
      'city': instance.city,
      'postal_code': instance.postalCode,
      'country': instance.country,
      'profile_picture': instance.profilePicture,
      'created_at': instance.createdAt,
      'updated_at': instance.updatedAt,
    };
