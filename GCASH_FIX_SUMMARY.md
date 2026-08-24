# GCash Payment Integration - Fix Complete

## Summary
Fixed the GCash payment integration that was broken due to incorrect database column mapping in the order creation APIs.

## Root Cause
The PHP APIs (`api_orders.php` and `api_place_order.php`) were attempting to insert data into non-existent database columns `latitude` and `longitude`, but the actual table columns were named `lat` and `lng`. This caused order creation to fail with SQL error: "Unknown column 'latitude' in 'field list'".

## Files Modified

### 1. **customer/api_orders.php** (2 changes)
- Line 75: Changed field name from `'latitude'` to `'lat'`
- Line 75: Changed field name from `'longitude'` to `'lng'`
- Dynamic INSERT now correctly maps to actual database columns

### 2. **customer/api_place_order.php** (1 change)
- Line 51: Changed INSERT statement from `latitude, longitude` to `lat, lng`
- Ensures prepared statement inserts to correct columns

### 3. **customer_portal/src/customer/components/CheckoutModal.jsx** (Previous fix)
- Added `payment_method` parameter to API payload
- Frontend now sends payment method (GCash, PayMaya, COD) to backend

### 4. **customer/create_payment.php** (Previous fix)
- Added payment method to PayMongo API request
- Maps payment methods to correct source types (gcash, paymaya, card)

## Verification Results

### Direct API Test
```bash
✓ Order creation: HTTP 200, returns order_id=112
✓ GCash payment link: HTTP 200, returns valid PayMongo checkout_url
✓ Link format: https://pm.link/org-VzJB1sfgrZEigK9bKvv3Kv8Y/test/FNAABYm
```

### Test Payload
```json
{
  "items": [{"name": "Chocolate Ganache Cake", "qty": 3, "price": 100}],
  "total": 345,
  "method": "Deliver",
  "payment": "GCash",
  "address": "123 Test Street",
  "phone": "09123456789",
  "latitude": 13.7565,
  "longitude": 121.0583,
  "user_id": 2
}
```

## Git Commit
```
Commit: 83bdfea6
Message: "fix(payment): fix column names for orders table (lat/lng) and add payment_method routing"
Branch: fix/customer-order-identity
Files: 
  - customer/api_orders.php
  - customer/api_place_order.php
  - customer_portal/src/customer/components/CheckoutModal.jsx
```

## How It Works
1. Customer selects GCash at checkout
2. Frontend sends payment_method="GCash" to API
3. Backend creates order (now succeeds, previously failed)
4. Backend requests PayMongo payment link with source.type="gcash"
5. PayMongo returns GCash-specific checkout URL
6. Customer is redirected to PayMongo to complete payment

## Status
✅ Database column names corrected
✅ Order creation API working  
✅ PayMongo integration verified
✅ Payment method routing implemented
✅ Changes committed to git

## Next Steps (Optional)
- [ ] Test full checkout flow in browser
- [ ] Test other payment methods (PayMaya, COD)
- [ ] Add integration tests for payment flows
