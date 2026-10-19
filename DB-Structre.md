# VSEEDS Database Structure

Source: `main-backend-vseeds/prisma/schema.prisma` (MySQL)

---

## Enums

| Enum | Values |
|------|--------|
| `UserStatus` | `active`, `inactive`, `suspended` |
| `AdminStatus` | `active`, `inactive`, `suspended` |
| `OrderType` | `product`, `service` |
| `OrderStatus` | `pending`, `waiting_for_payment`, `processing`, `shipped`, `delivered`, `cancelled`, `refunded` |
| `PaymentMethod` | `bank_transfer`, `cash`, `online` |
| `PaymentStatus` | `pending`, `completed`, `failed`, `refunded` |
| `DeviceType` | `all`, `desktop`, `mobile` |
| `FAQSite` | `electronics`, `embedded`, `both` |
| `BlogStatus` | `draft`, `published` |
| `ContactStatus` | `new`, `read`, `replied`, `archived`, `in_progress`, `resolved` |
| `ContactSource` | `electronics`, `embedded`, `general` |
| `DiscountType` | `percentage`, `fixed` |
| `AuthorType` | `user`, `admin` |
| `PromoCodeSite` | `electronics`, `embedded`, `both` |

---

## Core Identity & RBAC

### `users` (User)
- `id` `CHAR(36)` PK `default(uuid())`
- `first_name` `VARCHAR(100)`
- `last_name` `VARCHAR(100)`
- `email` `VARCHAR(500)`
- `email_lookup` `VARCHAR(64)` unique
- `password_hash` `VARCHAR(255)`
- `phone` `VARCHAR(20)` optional
- `status` enum `UserStatus` default `active`
- `two_factor_secret` `VARCHAR(255)` optional
- `two_factor_enabled` `Boolean` default `false`
- `last_login_at` `Timestamp` optional
- `refresh_token` `VARCHAR(500)` optional
- `created_at` `DateTime(3)`
- `updated_at` `DateTime(3)`
- `deleted_at` `DateTime(3)` optional
- Indexes: `idx_user_status`, `idx_user_email_lookup`

### `user_addresses` (UserAddress)
- `id` `CHAR(36)` PK
- `user_id` `CHAR(36)` FK → `users` on delete cascade
- `label` `VARCHAR(50)` optional
- `full_name` `VARCHAR(500)`
- `email` `VARCHAR(500)` optional
- `phone` `VARCHAR(500)`
- `address_line1` `VARCHAR(1000)`
- `address_line2` `VARCHAR(1000)` optional
- `city` `VARCHAR(500)` optional
- `district` `VARCHAR(500)`
- `province` `VARCHAR(500)`
- `postal_code` `VARCHAR(500)`
- `country` `VARCHAR(100)` default `Sri Lanka`
- `is_default` `Boolean` default `false`
- `created_at`, `updated_at`, `deleted_at` `DateTime(3)`
- Index: `idx_addr_user`

### `admins` (Admin)
- `id` `CHAR(36)` PK
- `username` `VARCHAR(500)`
- `username_lookup` `VARCHAR(64)` unique
- `email` `VARCHAR(500)`
- `email_lookup` `VARCHAR(64)` unique
- `password_hash` `VARCHAR(255)`
- `role_id` `CHAR(36)` optional FK → `roles`
- `phone` `VARCHAR(20)` optional
- `address` `VARCHAR(500)` optional
- `avatar_url` `VARCHAR(500)` optional
- `status` enum `AdminStatus` default `active`
- `two_factor_secret` `VARCHAR(255)` optional
- `two_factor_enabled` `Boolean` default `false`
- `failed_login_count` `SmallInt` default `0`
- `locked_until` `Timestamp` optional
- `last_login_at` `Timestamp` optional
- `refresh_token` `VARCHAR(500)` optional
- `created_at`, `updated_at`, `deleted_at` `DateTime(3)`
- Indexes: `idx_admin_email_lookup`, `idx_admin_username_lookup`, `idx_admin_status`

### `roles` (Role)
- `id` `CHAR(36)` PK
- `name` `VARCHAR(50)` unique
- `description` `VARCHAR(255)` optional
- `is_system` `Boolean` default `false`
- `created_at`, `updated_at` `DateTime(3)`

### `privileges` (Privilege)
- `id` `CHAR(36)` PK
- `name` `VARCHAR(100)` unique
- `module` `VARCHAR(50)`
- `description` `VARCHAR(255)` optional

### `role_privileges` (RolePrivilege)
- `id` `CHAR(36)` PK
- `role_id` `CHAR(36)` FK → `roles`
- `privilege_id` `CHAR(36)` FK → `privileges`
- `is_active` `Boolean` default `true`
- Unique: `(role_id, privilege_id)` `uq_role_priv`

### `activity_logs` (ActivityLog)
- `id` `CHAR(36)` PK
- `actor_id` `CHAR(36)` optional
- `actor_type` `VARCHAR(50)`
- `action` `VARCHAR(50)`
- `entity_type` `VARCHAR(50)`
- `entity_id` `CHAR(36)` optional
- `description` `VARCHAR(500)` optional
- `ip_address` `VARCHAR(45)` optional
- `user_agent` `VARCHAR(500)` optional
- `metadata` `Json` optional
- `created_at` `DateTime(3)`
- Indexes: `idx_al_actor`, `idx_al_created`

### `users_h` (UserHistory)
- `id` `CHAR(36)` PK
- `user_id` `CHAR(36)` FK → `users`
- `action` `VARCHAR(20)`
- `snapshot` `Json`
- `changed_by` `CHAR(36)` optional
- `changed_at` `DateTime(3)`
- Indexes: `idx_users_h_user`, `idx_users_h_changed`

### `admins_h` (AdminHistory)
- `id` `CHAR(36)` PK
- `admin_id` `CHAR(36)` FK → `admins`
- `action` `VARCHAR(20)`
- `snapshot` `Json`
- `changed_by` `CHAR(36)` optional
- `changed_at` `DateTime(3)`
- Indexes: `idx_admins_h_admin`, `idx_admins_h_changed`

---

## Catalog & Inventory

### `categories` (Category)
- `id` `CHAR(36)` PK
- `name` `VARCHAR(100)`
- `slug` `VARCHAR(150)` unique
- `icon` `VARCHAR(100)` optional
- `description` `Text` optional
- `status` `VARCHAR(191)` default `active`
- `display_order` `SmallInt` default `0`
- `parent_id` `CHAR(36)` optional self-FK
- `created_at`, `updated_at`, `deleted_at` `DateTime(3)`
- Indexes: `idx_cat_parent`, `idx_cat_status`

### `products` (Product)
- `id` `CHAR(36)` PK
- `category_id` `CHAR(36)` optional FK → `categories`
- `sku` `VARCHAR(100)` unique optional
- `name` `VARCHAR(300)`
- `slug` `VARCHAR(300)` unique
- `description` `Text` optional
- `short_description` `Text` optional
- `min_purchase_value` `INT` optional (minimum purchase quantity)
- `specifications` `Json` optional
- `tags` `Json` optional
- `datasheet_url` `VARCHAR(500)` optional
- `model_3d_url` `VARCHAR(500)` optional
- `product_link` `VARCHAR(500)` optional
- `sub_category` `VARCHAR(200)` optional
- `store_id` `VARCHAR(100)` optional
- `manufacturer` `VARCHAR(200)` optional
- `manufacturer_product_number` `VARCHAR(200)` optional
- `quantity_in_hand` `Int` default `0`
- `quantity_ordered` `Int` default `0`
- `purchased_price` `Decimal(12,2)` optional
- `expected_date` `Date` optional
- `status` `VARCHAR(191)` default `active`
- `is_featured` `Boolean` default `false`
- `is_new_arrival` `Boolean` default `false`
- `created_at`, `updated_at`, `deleted_at` `DateTime(3)`
- Indexes: `idx_prod_category`, `idx_prod_slug`, `idx_prod_status`, `idx_prod_cat_status`, `idx_prod_deleted_at`

### `product_price_tiers` (ProductPriceTier)
- `id` `CHAR(36)` PK
- `product_id` `CHAR(36)` FK → `products`
- `min_quantity` `UnsignedInt` default `1`
- `price` `Decimal(12,2)`
- Unique: `(product_id, min_quantity)` `uq_prod_qty`

### `media` (Media)
- `id` `CHAR(36)` PK
- `filename` `VARCHAR(255)`
- `original_name` `VARCHAR(255)`
- `url` `VARCHAR(500)`
- `mime_type` `VARCHAR(100)`
- `file_size` `Int`
- `alt_text` `VARCHAR(255)` optional
- `created_at`, `deleted_at` `DateTime(3)`

### `product_media` (ProductMedia)
- `id` `CHAR(36)` PK
- `product_id` `CHAR(36)` FK → `products`
- `media_id` `CHAR(36)` FK → `media`
- `is_thumbnail` `Boolean` default `false`
- `display_order` `SmallInt` default `0`
- Unique: `(product_id, media_id)` `uq_prod_media`
- Index: `idx_pm_product`

---

## Transactional Orders & Sales

### `orders` (Order)
- `id` `CHAR(36)` PK
- `order_number` `VARCHAR(30)` unique
- `user_id` `CHAR(36)` FK → `users`
- `shipping_address_id` `CHAR(36)` optional FK → `user_addresses`
- `order_type` enum `OrderType` default `product`
- `quote_id` `CHAR(36)` optional
- `subtotal` `Decimal(12,2)` default `0.00`
- `shipping_fee` `Decimal(12,2)` default `0.00`
- `discount_amount` `Decimal(12,2)` default `0.00`
- `promo_code` `VARCHAR(50)` optional
- `promo_code_id` `CHAR(36)` optional FK → `promo_codes`
- `total_amount` `Decimal(12,2)` default `0.00`
- `status` enum `OrderStatus` default `pending`
- `customer_notes` `Text` optional
- `admin_notes` `Text` optional
- `created_at`, `updated_at`, `deleted_at` `DateTime(3)`
- `version` `Int` default `0`
- Indexes: `idx_order_number`, `idx_order_user`, `idx_order_status`, `idx_order_created`, `idx_order_deleted_at`

### `order_items` (OrderItem)
- `id` `CHAR(36)` PK
- `order_id` `CHAR(36)` FK → `orders`
- `product_id` `CHAR(36)` optional FK → `products`
- `product_name` `VARCHAR(300)`
- `quantity` `UnsignedInt` default `1`
- `unit_price` `Decimal(12,2)`
- `total_price` `Decimal(12,2)`
- Index: `idx_oi_order`

### `order_status_history` (OrderStatusHistory)
- `id` `CHAR(36)` PK
- `order_id` `CHAR(36)` FK → `orders`
- `from_status` `VARCHAR(30)` optional
- `to_status` `VARCHAR(30)`
- `changed_by` `CHAR(36)` optional
- `note` `VARCHAR(500)` optional
- `created_at` `DateTime(3)`
- Index: `idx_osh_order`

### `order_comments` (OrderComment)
- `id` `CHAR(36)` PK
- `order_id` `CHAR(36)` FK → `orders`
- `comments` `Text` optional
- `address_id` `CHAR(36)` optional

### `payments` (Payment)
- `id` `CHAR(36)` PK
- `payment_number` `VARCHAR(30)` unique
- `order_id` `CHAR(36)` FK → `orders`
- `amount` `Decimal(12,2)`
- `payment_method` enum `PaymentMethod` default `bank_transfer`
- `status` enum `PaymentStatus` default `pending`
- `reference_number` `VARCHAR(1000)` optional
- `receipt_url` `VARCHAR(500)` optional
- `paid_at` `Timestamp` optional
- `created_at`, `updated_at` `DateTime(3)`
- Indexes: `idx_pay_order`, `idx_pay_status`

### `shipments` (Shipment)
- `id` `CHAR(36)` PK
- `order_id` `CHAR(36)` FK → `orders`
- `tracking_number` `VARCHAR(100)` optional
- `carrier` `VARCHAR(100)` optional
- `shipped_at` `Timestamp` optional
- `expected_delivery_at` `Timestamp` optional
- `delivered_at` `Timestamp` optional
- `shipping_fee` `Decimal(12,2)` default `0.00`
- `created_at`, `updated_at` `DateTime(3)`
- Index: `idx_ship_order`

### `wishlists` (Wishlist)
- `id` `CHAR(36)` PK
- `user_id` `CHAR(36)` FK → `users`
- `product_id` `CHAR(36)` FK → `products`
- `created_at` `DateTime(3)`
- Unique: `(user_id, product_id)` `uq_wish`
- Index: `idx_wish_user`

### `product_reviews` (ProductReview)
- `id` `CHAR(36)` PK
- `product_id` `CHAR(36)` FK → `products`
- `user_id` `CHAR(36)` optional FK → `users`
- `rating` `TinyInt`
- `review_text` `Text` optional
- `image_url` `VARCHAR(500)` optional
- `admin_reply` `Text` optional
- `admin_reply_at` `Timestamp` optional
- `is_approved` `Boolean` default `false`
- `created_at`, `updated_at`, `deleted_at` `DateTime(3)`
- `order_id` `CHAR(36)` optional FK → `orders`
- `quote_id` `CHAR(36)` optional FK → `quotes`
- Index: `idx_rev_product`

### `quotes` (Quote)
- `id` `CHAR(36)` PK
- `quote_number` `VARCHAR(30)` unique
- `user_id` `CHAR(36)` optional FK → `users`
- `service_type` `VARCHAR(50)`
- `customer_name` `VARCHAR(200)`
- `customer_email` `VARCHAR(255)`
- `customer_phone` `VARCHAR(20)` optional
- `customer_company` `VARCHAR(200)` optional
- `details` `Json`
- `service_level` `VARCHAR(50)` optional
- `estimated_build_time` `VARCHAR(50)` optional
- `total_price` `Decimal(12,2)` optional
- `status` `VARCHAR(191)` default `pending`
- `admin_notes` `Text` optional
- `created_at`, `updated_at` `DateTime(3)`
- Indexes: `idx_quote_user`, `idx_quote_email`, `idx_quote_status`

### `promo_codes` (PromoCode)
- `id` `CHAR(36)` PK
- `code` `VARCHAR(500)`
- `code_lookup` `VARCHAR(64)` unique
- `description` `VARCHAR(255)` optional
- `discount_type` enum `DiscountType` default `percentage`
- `discount_value` `Decimal(12,2)`
- `applicable_site` enum `PromoCodeSite` default `both`
- `min_order_amount` `Decimal(12,2)` default `0.00`
- `max_discount_amount` `Decimal(12,2)` optional
- `usage_limit` `Int` default `0`
- `used_count` `Int` default `0`
- `per_user_limit` `Int` default `1`
- `start_date` `Timestamp` optional
- `expiry_date` `Timestamp` optional
- `is_active` `Boolean` default `true`
- `created_at`, `updated_at` `DateTime(3)`
- Index: `idx_promo_code_lookup`

### `promo_codes_h` (PromoCodeHistory)
- `id` `CHAR(36)` PK
- `promo_code_id` `CHAR(36)` FK → `promo_codes`
- `action` `VARCHAR(20)`
- `snapshot` `Json`
- `changed_by` `CHAR(36)` optional
- `changed_at` `DateTime(3)`
- Indexes: `idx_promo_codes_h_code`, `idx_promo_codes_h_changed`

### `banks` (Bank)
- `id` `CHAR(36)` PK
- `bank_name` `VARCHAR(500)`
- `branch` `VARCHAR(500)`
- `account_number` `VARCHAR(500)`
- `account_name` `VARCHAR(500)`
- `is_active` `Boolean` default `true`
- `display_order` `SmallInt` default `0`
- `created_at`, `updated_at` `DateTime(3)`

---

## General Content & Settings

### `blogs` (Blog)
- `id` `CHAR(36)` PK
- `title` `VARCHAR(200)`
- `slug` `VARCHAR(200)` unique
- `excerpt` `VARCHAR(500)` optional
- `content` `Text`
- `cover_image_url` `VARCHAR(500)` optional
- `author` `VARCHAR(100)`
- `tags` `Json` optional
- `status` enum `BlogStatus` default `draft`
- `published_at` `DateTime(3)` optional
- `created_at`, `updated_at`, `deleted_at` `DateTime(3)`

### `banners` (Banner)
- `id` `CHAR(36)` PK
- `title` `VARCHAR(200)`
- `image_url` `VARCHAR(500)`
- `link_url` `VARCHAR(500)` optional
- `device_type` enum `DeviceType` default `all`
- `display_order` `SmallInt` default `0`
- `is_active` `Boolean` default `true`
- `starts_at`, `ends_at` `DateTime(3)` optional
- `created_at`, `updated_at` `DateTime(3)`

### `faqs` (FAQ)
- `id` `CHAR(36)` PK
- `question` `VARCHAR(300)`
- `answer` `Text`
- `category` `VARCHAR(100)` optional
- `site` enum `FAQSite` default `both`
- `display_order` `SmallInt` default `0`
- `is_active` `Boolean` default `true`
- `created_at`, `updated_at`, `deleted_at` `DateTime(3)`

### `contacts` (Contact)
- `id` `CHAR(36)` PK
- `name` `VARCHAR(100)`
- `email` `VARCHAR(500)`
- `phone` `VARCHAR(20)` optional
- `subject` `VARCHAR(200)`
- `message` `Text`
- `source` enum `ContactSource` default `general`
- `status` enum `ContactStatus` default `new`
- `created_at`, `updated_at`, `deleted_at` `DateTime(3)`

### `contacts_h` (ContactHistory)
- `id` `CHAR(36)` PK
- `contact_id` `CHAR(36)` FK → `contacts`
- `action` `VARCHAR(20)`
- `snapshot` `Json`
- `changed_by` `CHAR(36)` optional
- `changed_at` `DateTime(3)`
- Indexes: `idx_contacts_h_contact`, `idx_contacts_h_changed`

### `contact_replies` (ContactReply)
- `id` `CHAR(36)` PK
- `contact_id` `CHAR(36)` FK → `contacts`
- `admin_id` `CHAR(36)` FK → `admins`
- `message` `Text`
- `created_at` `DateTime(3)`

### `settings` (Setting)
- `id` `CHAR(36)` PK
- `setting_key` `VARCHAR(100)` unique
- `setting_value` `Text`
- `value_type` `VARCHAR(191)` default `string`
- `setting_group` `VARCHAR(50)`
- `description` `VARCHAR(255)` optional
- `created_at`, `updated_at` `DateTime(3)`

### `projects` (Project)
- `id` `CHAR(36)` PK
- `title` `VARCHAR(200)`
- `category` `VARCHAR(100)`
- `description` `Text`
- `image_url` `VARCHAR(500)` optional
- `technologies` `Json` optional
- `display_order` `SmallInt` default `0`
- `is_public` `Boolean` default `true`
- `created_at`, `updated_at` `DateTime(3)`

### `email_templates` (EmailTemplate)
- `id` `CHAR(36)` PK
- `slug` `VARCHAR(100)` unique
- `name` `VARCHAR(100)`
- `category` `VARCHAR(50)`
- `description` `VARCHAR(255)` optional
- `subject` `VARCHAR(200)`
- `html_body` `Text`
- `text_body` `Text` optional
- `variables` `Json` optional
- `is_active` `Boolean` default `true`
- `created_at`, `updated_at`, `deleted_at` `DateTime(3)`
