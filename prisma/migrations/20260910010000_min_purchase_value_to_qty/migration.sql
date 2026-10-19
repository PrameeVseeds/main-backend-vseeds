-- min_purchase_value is a minimum purchase quantity (unit count), not a price
ALTER TABLE `products`
  MODIFY COLUMN `min_purchase_value` INT NULL;
