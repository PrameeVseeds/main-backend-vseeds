-- Add shortDescription and minPurchaseValue columns to products table
ALTER TABLE `products`
  ADD COLUMN IF NOT EXISTS `short_description` TEXT NULL,
  ADD COLUMN IF NOT EXISTS `min_purchase_value` DECIMAL(12, 2) NULL;
