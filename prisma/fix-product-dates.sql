-- Fix invalid zero/epoch dates in product and attribute tables.
-- Prisma cannot parse MySQL values like 0000-00-00 00:00:00 or month/day zero.

UPDATE products
SET updated_at = IF(
  created_at IS NULL OR IFNULL(TO_DAYS(created_at), 0) = 0,
  NOW(),
  created_at
)
WHERE IFNULL(TO_DAYS(updated_at), 0) = 0;

UPDATE products
SET created_at = NOW()
WHERE IFNULL(TO_DAYS(created_at), 0) = 0;

UPDATE product_attributes
SET updated_at = IF(
  created_at IS NULL OR IFNULL(TO_DAYS(created_at), 0) = 0,
  NOW(),
  created_at
)
WHERE IFNULL(TO_DAYS(updated_at), 0) = 0;

UPDATE product_attributes
SET created_at = NOW()
WHERE IFNULL(TO_DAYS(created_at), 0) = 0;

UPDATE attributes
SET updated_at = IF(
  created_at IS NULL OR IFNULL(TO_DAYS(created_at), 0) = 0,
  NOW(),
  created_at
)
WHERE IFNULL(TO_DAYS(updated_at), 0) = 0;

UPDATE attributes
SET created_at = NOW()
WHERE IFNULL(TO_DAYS(created_at), 0) = 0;

UPDATE categories
SET updated_at = IF(
  created_at IS NULL OR IFNULL(TO_DAYS(created_at), 0) = 0,
  NOW(),
  created_at
)
WHERE IFNULL(TO_DAYS(updated_at), 0) = 0;

UPDATE categories
SET created_at = NOW()
WHERE IFNULL(TO_DAYS(created_at), 0) = 0;

UPDATE categories
SET deleted_at = NULL
WHERE deleted_at IS NOT NULL AND IFNULL(TO_DAYS(deleted_at), 0) = 0;

UPDATE sub_categories
SET updated_at = IF(
  created_at IS NULL OR IFNULL(TO_DAYS(created_at), 0) = 0,
  NOW(),
  created_at
)
WHERE IFNULL(TO_DAYS(updated_at), 0) = 0;

UPDATE sub_categories
SET created_at = NOW()
WHERE IFNULL(TO_DAYS(created_at), 0) = 0;

UPDATE sub_categories
SET deleted_at = NULL
WHERE deleted_at IS NOT NULL AND IFNULL(TO_DAYS(deleted_at), 0) = 0;

UPDATE media
SET created_at = NOW()
WHERE IFNULL(TO_DAYS(created_at), 0) = 0;

UPDATE media
SET deleted_at = NULL
WHERE deleted_at IS NOT NULL AND IFNULL(TO_DAYS(deleted_at), 0) = 0;
