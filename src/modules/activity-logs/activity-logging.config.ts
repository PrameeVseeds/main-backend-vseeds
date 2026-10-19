/**
 * Config-driven mapping for activity logging. Add new API path prefixes and
 * entity/table mappings here instead of editing the interceptor.
 */

export const SKIP_PATHS = [
  '/api/health',
  '/api/activity-logs',
  '/api/docs',
  // Read-only POST endpoints — these don't mutate anything
  '/api/auth/refresh-token',
  '/api/email-templates/preview',
  '/api/email-templates/send-test',
];
export const LOGIN_PATHS = ['/api/auth/admin-login', '/api/auth/user-login'];
export const LOGGABLE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'] as const;

/**
 * Entities worth auditing. Creates/updates are only logged for these; deletes
 * are always logged regardless (see ALWAYS_LOG_DELETE). Keeps the audit trail
 * focused on security- and business-critical changes instead of high-volume
 * noise like media uploads, wishlists, reviews and public form submissions.
 */
export const LOGGED_ENTITIES = [
  'auth',
  'admin',
  'role',
  'user',
  'product',
  'category',
  'order',
  'payment',
  'delivery',
  'setting',
  'email_template',
] as const;

/** Deletions are destructive, so log them for every entity. */
export const ALWAYS_LOG_DELETE = true;

export const METHOD_ACTION_MAP: Record<string, string> = {
  POST: 'create',
  PUT: 'update',
  PATCH: 'update',
  DELETE: 'delete',
};

/** First path segment (after /api/) to entity type key. */
export const PATH_SEGMENT_TO_ENTITY: Record<string, string> = {
  products: 'product',
  categories: 'category',
  orders: 'order',
  users: 'user',
  payments: 'payment',
  reviews: 'review',
  wishlists: 'wishlist',
  deliveries: 'delivery',
  contact: 'contact',
  images: 'media',
  roles: 'role',
  admins: 'admin',
  auth: 'auth',
  quotes: 'quote',
  banner: 'banner',
  blogs: 'blog',
  faqs: 'faq',
  projects: 'project',
  settings: 'setting',
  'email-templates': 'email_template',
};

/** Entity type to table name and optional display name column. */
export const ENTITY_TABLE_MAP: Record<
  string,
  { table: string; nameCol?: string }
> = {
  product: { table: 'products', nameCol: 'name' },
  category: { table: 'categories', nameCol: 'name' },
  order: { table: 'orders', nameCol: 'order_number' },
  user: { table: 'users', nameCol: 'first_name' },
  admin: { table: 'admins', nameCol: 'username' },
  role: { table: 'roles', nameCol: 'name' },
  banner: { table: 'banners', nameCol: 'title' },
  blog: { table: 'blogs', nameCol: 'title' },
  faq: { table: 'faqs', nameCol: 'question' },
  project: { table: 'projects', nameCol: 'title' },
  setting: { table: 'settings', nameCol: 'setting_key' },
  contact: { table: 'contacts', nameCol: 'name' },
  review: { table: 'product_reviews', nameCol: 'review_text' },
  payment: { table: 'payments', nameCol: 'payment_number' },
  delivery: { table: 'shipments', nameCol: 'tracking_number' },
  media: { table: 'media', nameCol: 'original_name' },
  quote: { table: 'quotes', nameCol: 'quote_number' },
  email_template: { table: 'email_templates', nameCol: 'name' },
  wishlist: { table: 'wishlists' },
};

export const SENSITIVE_FIELDS = [
  'password',
  'passwordHash',
  'password_hash',
  'twoFactorSecret',
  'two_factor_secret',
  'refreshToken',
  'refresh_token',
];
