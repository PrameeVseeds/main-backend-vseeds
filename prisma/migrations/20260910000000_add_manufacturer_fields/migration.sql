-- Add manufacturer and manufacturer product number columns to products table
ALTER TABLE `products`
  ADD COLUMN `manufacturer` VARCHAR(200) NULL,
  ADD COLUMN `manufacturer_product_number` VARCHAR(200) NULL;
