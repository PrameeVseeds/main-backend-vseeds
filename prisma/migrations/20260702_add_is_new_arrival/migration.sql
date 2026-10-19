-- Add is_new_arrival column to products table
ALTER TABLE `products` ADD COLUMN `is_new_arrival` BOOLEAN NOT NULL DEFAULT FALSE AFTER `is_featured`;
