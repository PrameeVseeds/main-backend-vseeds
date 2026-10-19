export enum OrderStatus {
  PENDING = 'pending',
  WAITING_FOR_PAYMENT = 'waiting_for_payment',
  PROCESSING = 'processing',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
}

export enum OrderType {
  PRODUCT = 'product',
  SERVICE = 'service',
}
