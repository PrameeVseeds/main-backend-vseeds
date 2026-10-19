import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';
import { createLookupHash } from './common/utils/lookup-hash.util';

interface SettingSeed {
  key: string;
  value: string;
  valueType: 'string' | 'number' | 'boolean' | 'json';
  group: string;
  description: string;
}

const DEFAULT_SETTINGS: SettingSeed[] = [
  // ---- Site Status ----
  {
    key: 'maintenanceMode',
    value: 'false',
    valueType: 'boolean',
    group: 'site-status',
    description: 'Enable maintenance mode across all frontends',
  },
  {
    key: 'maintenanceMessage',
    value: 'We are currently under maintenance. Please check back later.',
    valueType: 'string',
    group: 'site-status',
    description: 'Message shown during maintenance',
  },

  // ---- Store Settings ----
  {
    key: 'acceptOrders',
    value: 'true',
    valueType: 'boolean',
    group: 'store',
    description: 'Allow customers to place orders',
  },
  {
    key: 'allowRegistration',
    value: 'true',
    valueType: 'boolean',
    group: 'store',
    description: 'Allow new user registration',
  },
  {
    key: 'allowReviews',
    value: 'true',
    valueType: 'boolean',
    group: 'store',
    description: 'Allow product reviews',
  },
  {
    key: 'enableWishlist',
    value: 'true',
    valueType: 'boolean',
    group: 'store',
    description: 'Enable wishlist functionality',
  },

  // ---- Notification Settings ----
  {
    key: 'notifyOrders',
    value: 'true',
    valueType: 'boolean',
    group: 'notifications',
    description: 'Send email on new orders',
  },
  {
    key: 'notifyContacts',
    value: 'true',
    valueType: 'boolean',
    group: 'notifications',
    description: 'Send email on new contact form submissions',
  },
  {
    key: 'notifyLowStock',
    value: 'true',
    valueType: 'boolean',
    group: 'notifications',
    description: 'Alert when product stock is low',
  },
  {
    key: 'notifyReviews',
    value: 'true',
    valueType: 'boolean',
    group: 'notifications',
    description: 'Send email on new product reviews',
  },
  {
    key: 'notificationEmail',
    value: '',
    valueType: 'string',
    group: 'notifications',
    description: 'Email address for admin notifications',
  },

  // ---- Security Settings ----
  // (Redacted - moved to dedicated security module)

  // ---- Bank Details (public) ----
  {
    key: 'accountName',
    value: 'SEEDS (PVT) LTD',
    valueType: 'string',
    group: 'bank-details',
    description: 'Bank account holder name',
  },
  {
    key: 'accountNumber',
    value: 'xxxxxxxxxx',
    valueType: 'string',
    group: 'bank-details',
    description: 'Bank account number',
  },
  {
    key: 'bankName',
    value: 'Sampath Bank',
    valueType: 'string',
    group: 'bank-details',
    description: 'Name of the bank',
  },
  {
    key: 'branchName',
    value: 'Negombo',
    valueType: 'string',
    group: 'bank-details',
    description: 'Bank branch name',
  },
  {
    key: 'supportEmail',
    value: 'online@vseeds.lk',
    valueType: 'string',
    group: 'bank-details',
    description: 'Support email for payment queries',
  },
  {
    key: 'supportWhatsApp',
    value: '+94770000000',
    valueType: 'string',
    group: 'bank-details',
    description: 'WhatsApp number for payment support',
  },

  // ---- General / SEO ----
  {
    key: 'siteName',
    value: 'Vseeds',
    valueType: 'string',
    group: 'general',
    description: 'Application display name',
  },
  {
    key: 'siteDescription',
    value: '',
    valueType: 'string',
    group: 'general',
    description: 'Default meta description for SEO',
  },
  {
    key: 'siteKeywords',
    value: '',
    valueType: 'string',
    group: 'general',
    description: 'Default meta keywords for SEO',
  },
  {
    key: 'contactPhone',
    value: '',
    valueType: 'string',
    group: 'general',
    description: 'Primary contact phone number',
  },
  {
    key: 'contactEmail',
    value: '',
    valueType: 'string',
    group: 'general',
    description: 'Primary contact email',
  },
  {
    key: 'contactAddress',
    value: '',
    valueType: 'string',
    group: 'general',
    description: 'Business address',
  },
];

// ─── Email template HTML helpers ─────────────────────────
const _responsive =
  `<style>` +
  `body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}` +
  `table,td{mso-table-lspace:0;mso-table-rspace:0}` +
  `img{-ms-interpolation-mode:bicubic;border:0;outline:none;text-decoration:none}` +
  `@media only screen and (max-width:620px){` +
  `.ew{padding:12px 6px !important}` +
  `.ec{border-radius:10px !important}` +
  `.eh,.eb,.ef{padding-left:16px !important;padding-right:16px !important}` +
  `.eb p,.eb div{font-size:13px !important}` +
  `.eb h1{font-size:18px !important}` +
  `.er td{font-size:12px !important;padding:5px 0 !important}` +
  `.ot{font-size:12px !important}` +
  `.ot th,.ot td{padding:6px 8px !important}` +
  `.em-btn a{padding:10px 20px !important;font-size:13px !important}` +
  `.eli td{font-size:12px !important}` +
  `}</style>`;

const _wrap = (accent: string, title: string, inner: string): string =>
  `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">` +
  `<meta name="viewport" content="width=device-width,initial-scale=1.0">` +
  `<meta http-equiv="X-UA-Compatible" content="IE=edge">` +
  `<title>${title}</title>${_responsive}</head>` +
  `<body style="margin:0;padding:0;background:#f4f7fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">` +
  `<div class="ew" style="background:#f4f7fa;padding:24px 16px;">` +
  `<div class="ec" style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.06);">` +
  `<div style="height:3px;background:${accent};"></div>` +
  `<div class="eh" style="padding:28px 28px 0;text-align:center;">` +
  `<img src="https://www.vseeds.lk/upload_vseeds/images/formail-header.png" alt="VSeeds" style="width:48px;height:48px;border-radius:10px;object-fit:contain;" />` +
  `<h1 style="margin:14px 0 0;font-size:20px;font-weight:700;color:#1a1d21;line-height:1.3;">${title}</h1>` +
  `</div>` +
  `<div class="eb" style="padding:24px 28px;">${inner}</div>` +
  `<div class="ef" style="background:#f8fafc;padding:20px 28px;text-align:center;border-top:1px solid #eef0f4;">` +
  `<p style="margin:0;font-size:11px;color:#9ca3af;">VSeeds Electronics &copy; 2025 &middot; <a href="https://www.vseeds.lk" style="color:#9ca3af;">vseeds.lk</a></p>` +
  `</div></div></div></body></html>`;

const _p = (text: string): string =>
  `<p style="margin:0 0 14px;font-size:14px;line-height:1.7;color:#374151;">${text}</p>`;

const _card = (inner: string): string =>
  `<div style="background:#f8fafc;border:1px solid #e8ecf1;border-radius:10px;padding:16px;margin-bottom:16px;">${inner}</div>`;

const _row = (label: string, value: string, color: string): string =>
  `<table class="er" role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">` +
  `<tr><td style="padding:6px 0;font-size:13px;color:#6b7280;white-space:nowrap;">${label}</td>` +
  `<td style="padding:6px 0;font-size:13px;text-align:right;word-break:break-all;"><strong style="color:${color};">${value}</strong></td></tr></table>`;

const _btn = (href: string, label: string, color: string): string =>
  `<div class="em-btn" style="text-align:center;margin:20px 0 4px;"><a href="${href}" style="display:inline-block;padding:10px 28px;font-size:14px;font-weight:600;color:#fff;background:${color};text-decoration:none;border-radius:8px;">${label}</a></div>`;

const _note = (text: string): string =>
  `<div style="background:#fffbeb;border-left:3px solid #f59e0b;border-radius:0 8px 8px 0;padding:12px 14px;margin-bottom:16px;font-size:13px;color:#92400e;line-height:1.6;">${text}</div>`;

const _badge = (text: string, bg: string, fg: string): string =>
  `<div style="text-align:center;margin-bottom:16px;"><span style="display:inline-block;background:${bg};color:${fg};font-size:12px;font-weight:600;padding:4px 14px;border-radius:20px;">${text}</span></div>`;

const _listItem = (
  icon: string,
  text: string,
  color: string,
  border = true,
): string =>
  `<table class="eli" role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;${border ? 'border-bottom:1px solid #f1f3f5;' : ''}">` +
  `<tr><td style="width:28px;padding:8px 0;font-size:16px;color:${color};vertical-align:middle;">${icon}</td>` +
  `<td style="padding:8px 0;font-size:13px;color:#374151;vertical-align:middle;">${text}</td></tr></table>`;

interface EmailTemplateSeed {
  slug: string;
  name: string;
  category: string;
  description: string;
  subject: string;
  htmlBody: string;
  variables: string[];
}

const DEFAULT_EMAIL_TEMPLATES: EmailTemplateSeed[] = [
  {
    slug: 'order-confirmation',
    name: 'Order Confirmation',
    category: 'Orders',
    subject: 'New Order Received - #{{orderId}}',
    description:
      'Sent to customers when an order is successfully placed and confirmed.',
    htmlBody: _wrap(
      'linear-gradient(90deg,#22c55e,#16a34a)',
      'Order Confirmed',
      _badge('Order Received', '#dcfce7', '#166534') +
        _p('Dear <strong>{{username}}</strong>,') +
        _p(
          'Thank you for shopping with us! Your order has been successfully received and is currently being processed.',
        ) +
        _card(
          _row('Order Number: ', '#{{orderId}}', '#16a34a') +
            _row('Order Date: ', '{{orderDate}}', '#1a1d21'),
        ) +
        _p(
          'We will send you a shipping notification once your order is on its way.',
        ) +
        _btn('mailto:sales@vseeds.lk', 'Contact Support', '#16a34a'),
    ),
    variables: ['username', 'orderId', 'orderDate'],
  },
  {
    slug: 'payment-request',
    name: 'Payment Request (Bank Transfer)',
    category: 'Orders',
    subject:
      'Payment Request for VSEEDS.LK Order (Bank Transfer) - #{{orderId}}',
    description:
      'Sent to customers with bank transfer details after order placement.',
    htmlBody: _wrap(
      'linear-gradient(90deg,#f97316,#ea580c)',
      'Payment Required',
      _badge('Bank Transfer', '#fff7ed', '#9a3412') +
        _p('Dear <strong>{{username}}</strong>,') +
        _p(
          'Thank you for shopping with us! Your order has been received and is pending payment. Below are the details:',
        ) +
        _card(
          _row('Order Number: ', '#{{orderId}}', '#ea580c') +
            _row('Order Date: ', '{{orderDate}}', '#1a1d21'),
        ) +
        '<p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#1a1d21;">Order Items</p>' +
        '<div style="border:1px solid #e8ecf1;border-radius:10px;overflow:hidden;margin-bottom:16px;">' +
        '<table class="ot" role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:13px;">' +
        '<tr style="background:#f8fafc;"><th style="padding:8px 12px;text-align:left;color:#6b7280;font-weight:600;border-bottom:1px solid #e8ecf1;">Product</th><th style="padding:8px 12px;text-align:center;color:#6b7280;font-weight:600;border-bottom:1px solid #e8ecf1;">Qty</th><th style="padding:8px 12px;text-align:right;color:#6b7280;font-weight:600;border-bottom:1px solid #e8ecf1;">Price</th><th style="padding:8px 12px;text-align:right;color:#6b7280;font-weight:600;border-bottom:1px solid #e8ecf1;">Total</th></tr>' +
        '{{itemRows}}' +
        '<tr style="background:#f8fafc;"><td colspan="3" style="padding:8px 12px;text-align:right;color:#6b7280;">Subtotal</td><td style="padding:8px 12px;text-align:right;color:#1a1d21;font-weight:600;">Rs. {{subtotal}}</td></tr>' +
        '<tr style="background:#f8fafc;"><td colspan="3" style="padding:8px 12px;text-align:right;color:#6b7280;">Shipping</td><td style="padding:8px 12px;text-align:right;color:#1a1d21;font-weight:600;">Rs. {{shippingCost}}</td></tr>' +
        '<tr style="background:#fff7ed;"><td colspan="3" style="padding:10px 12px;text-align:right;color:#9a3412;font-weight:700;">Total Due</td><td style="padding:10px 12px;text-align:right;color:#ea580c;font-weight:700;font-size:15px;">Rs. {{orderTotal}}</td></tr>' +
        '</table></div>' +
        _card(
          '<p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Shipping Address</p>' +
            '<p style="margin:0;font-size:13px;color:#374151;line-height:1.6;">{{shippingAddress}}</p>',
        ) +
        '<p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#1a1d21;">Bank Details</p>' +
        '{{bankDetails}}' +
        _card(
          _row('Amount Due: ', 'Rs. {{orderTotal2}}', '#ea580c') +
            _row('Reference: ', '#{{orderId}}', '#1a1d21'),
        ) +
        _note(
          'Order will not ship until payment is confirmed. If payment is not received within 7 days, the order will be cancelled automatically. If you credit more than the total, no refund will be issued for the extra amount.',
        ) +
        _btn('mailto:sales@vseeds.lk', 'Send Payment Receipt', '#ea580c'),
    ),
    variables: [
      'username',
      'orderId',
      'orderDate',
      'itemRows',
      'subtotal',
      'shippingCost',
      'orderTotal',
      'shippingAddress',
      'bankDetails',
      'orderTotal2',
    ],
  },
  {
    slug: 'order-shipped',
    name: 'Order Shipped',
    category: 'Orders',
    subject: 'Order Shipped - #{{orderId}}',
    description: 'Sent when an order is dispatched with tracking details.',
    htmlBody: _wrap(
      'linear-gradient(90deg,#06b6d4,#0891b2)',
      'Your Order Has Shipped',
      _badge('On The Way', '#cffafe', '#155e75') +
        _p('Dear <strong>{{username}}</strong>,') +
        _p(
          'Great news! Your order has been shipped and is on its way to you.',
        ) +
        _card(
          _row('Order ID: ', '#{{orderId}}', '#0891b2') +
            '<div style="border-top:1px solid #e8ecf1;margin:8px 0;"></div>' +
            _row('Tracking Number: ', '{{trackingNumber}}', '#1a1d21') +
            _row('Carrier: ', '{{carrier}}', '#1a1d21'),
        ) +
        _p('You can track your package using the tracking number above.'),
    ),
    variables: ['username', 'orderId', 'trackingNumber', 'carrier'],
  },
  {
    slug: 'order-cancellation',
    name: 'Order Cancellation',
    category: 'Orders',
    subject: 'Order Cancellation - #{{orderId}}',
    description: 'Sent when an order is cancelled.',
    htmlBody: _wrap(
      'linear-gradient(90deg,#ef4444,#dc2626)',
      'Order Cancelled',
      _badge('Cancelled', '#fef2f2', '#991b1b') +
        _p('Dear <strong>{{username}}</strong>,') +
        _p('We regret to inform you that your order has been cancelled.') +
        _card(
          '<div style="text-align:center;padding:4px 0;"><span style="font-size:13px;color:#6b7280;">Order ID</span><div style="font-size:18px;font-weight:700;color:#dc2626;margin-top:4px;">#{{orderId}}</div></div>',
        ) +
        _p(
          "If you have questions about this cancellation, please don't hesitate to reach out to our support team.",
        ) +
        _btn('mailto:sales@vseeds.lk', 'Contact Support', '#dc2626'),
    ),
    variables: ['username', 'orderId'],
  },
  {
    slug: 'order-status-update',
    name: 'Order Status Update',
    category: 'Orders',
    subject: 'Order Status Update - #{{orderId}}',
    description:
      'Sent when the order status changes (processing, shipped, delivered).',
    htmlBody: _wrap(
      'linear-gradient(90deg,#06b6d4,#0891b2)',
      'Status Updated',
      _p('Dear <strong>{{username}}</strong>,') +
        _p('The status of your order has been updated.') +
        _card(
          _row('Order ID: ', '#{{orderId}}', '#0891b2') +
            '<div style="border-top:1px solid #e8ecf1;margin:8px 0;"></div>' +
            '<div style="text-align:center;padding:8px 0;"><span style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Current Status</span><div style="font-size:16px;font-weight:700;color:#0891b2;margin-top:4px;">{{status}}</div></div>',
        ) +
        _p('You can view the updated status by logging into your account.') +
        _btn('https://www.vseeds.lk', 'Track Order', '#0891b2'),
    ),
    variables: ['username', 'orderId', 'status'],
  },
  {
    slug: 'out-of-stock-alert',
    name: 'Out of Stock Alert',
    category: 'Inventory',
    subject: 'Out of Stock Alert',
    description: 'Sent to customers when ordered products are out of stock.',
    htmlBody: _wrap(
      'linear-gradient(90deg,#f59e0b,#d97706)',
      'Stock Issue',
      _badge('Stock Alert', '#fffbeb', '#92400e') +
        _p('Dear <strong>{{username}}</strong>,') +
        _p(
          'We have an issue with the stock for your recent order. The following products are currently out of stock:',
        ) +
        '<div style="background:#fef3c7;border:1px solid #fde68a;border-radius:10px;padding:14px 16px;margin-bottom:16px;font-size:14px;font-weight:600;color:#92400e;">{{productNames}}</div>' +
        _p(
          'We sincerely apologize for the inconvenience and are working to resolve this as soon as possible.',
        ),
    ),
    variables: ['username', 'productNames'],
  },
  {
    slug: 'welcome-email',
    name: 'Welcome Email',
    category: 'Account',
    subject: 'Welcome to VSeeds!',
    description: 'Sent to new customers after registration.',
    htmlBody: _wrap(
      'linear-gradient(90deg,#22c55e,#16a34a)',
      'Welcome to VSeeds!',
      _p('Dear <strong>{{username}}</strong>,') +
        _p(
          "Thank you for registering! We're thrilled to have you join our community.",
        ) +
        '<div style="margin-bottom:20px;">' +
        '<p style="font-size:13px;font-weight:700;color:#1a1d21;margin:0 0 6px;">Electronics Store</p>' +
        '<p style="font-size:12px;color:#6b7280;margin:0 0 10px;">Browse and shop electronic components &amp; accessories.</p>' +
        _listItem(
          '&#x1F6CD;&#xFE0F;',
          'Seamless shopping experience',
          '#16a34a',
        ) +
        _listItem('&#x1F4E6;', 'Real-time order tracking', '#16a34a') +
        _listItem(
          '&#x1F381;',
          'Exclusive offers &amp; discounts',
          '#16a34a',
          false,
        ) +
        '</div>' +
        _btn('https://www.vseeds.lk', 'Start Shopping', '#16a34a') +
        '<div style="margin:24px 0 20px;border-top:1px solid #e5e7eb;"></div>' +
        '<div style="margin-bottom:16px;">' +
        '<p style="font-size:13px;font-weight:700;color:#1a1d21;margin:0 0 6px;">Embedded &amp; PCB Services</p>' +
        '<p style="font-size:12px;color:#6b7280;margin:0 0 10px;">Custom PCB manufacturing, assembly &amp; prototyping.</p>' +
        _listItem('&#x1F4CB;', 'Instant PCB quotes', '#0891b2') +
        _listItem(
          '&#x2699;&#xFE0F;',
          'Multi-layer &amp; flex PCB manufacturing',
          '#0891b2',
        ) +
        _listItem('&#x1F4E6;', 'Full turnkey PCB assembly', '#0891b2', false) +
        '</div>' +
        _btn('https://www.embedded.vseeds.lk', 'Get a PCB Quote', '#0891b2') +
        '<div style="margin-top:20px;">' +
        _p(
          '<span style="font-size:12px;color:#9ca3af;">Access both platforms from any device with a single account.</span>',
        ) +
        '</div>',
    ),
    variables: ['username'],
  },
  {
    slug: 'customer-password-reset',
    name: 'Customer Password Reset',
    category: 'Account',
    subject: 'Password Reset Request',
    description: 'Sent when a customer requests a password reset.',
    htmlBody: _wrap(
      'linear-gradient(90deg,#ef4444,#dc2626)',
      'Reset Your Password',
      _p('Dear <strong>{{username}}</strong>,') +
        _p(
          'We received a request to reset the password for your VSeeds account. Click the button below to set a new password.',
        ) +
        _btn(
          '{{resetUrl}}?token={{token}}',
          'Reset Password',
          '#dc2626',
        ) +
        _card(
          '<p style="margin:0;font-size:12px;color:#6b7280;text-align:center;line-height:1.6;"><strong style="color:#dc2626;">Security Notice:</strong> This link will expire for security reasons. If you didn\'t request this reset, please ignore this email.</p>',
        ),
    ),
    variables: ['username', 'token', 'resetUrl'],
  },
  {
    slug: 'contact-reply',
    name: 'Contact Form Reply',
    category: 'Communication',
    subject: 'Thank you for contacting us',
    description: 'Sent when an admin replies to a contact form submission.',
    htmlBody: _wrap(
      'linear-gradient(90deg,#3b82f6,#2563eb)',
      "We've Replied",
      _p('Dear <strong>{{username}}</strong>,') +
        _p(
          'Thank you for reaching out. Here is our response to your inquiry:',
        ) +
        '<div style="background:#eff6ff;border-left:3px solid #3b82f6;border-radius:0 10px 10px 0;padding:16px;margin-bottom:16px;font-size:14px;color:#1e40af;line-height:1.7;">{{reply}}</div>' +
        _p(
          'If you have further questions, feel free to reply to this email or visit our website.',
        ) +
        _btn('https://www.vseeds.lk/', 'Visit Website', '#2563eb'),
    ),
    variables: ['username', 'reply'],
  },
  {
    slug: 'admin-registration',
    name: 'Admin Registration',
    category: 'Admin',
    subject: 'Welcome to VSeeds Admin Panel!',
    description: 'Sent to new admins with their login credentials.',
    htmlBody: _wrap(
      'linear-gradient(90deg,#1d6c67,#00312f)',
      'Welcome, Admin!',
      _p('Hello <strong>{{username}}</strong>,') +
        _p(
          "We're excited to welcome you to the VSeeds team! Below are your login credentials:",
        ) +
        _card(
          '<p style="font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 10px;">Login Credentials</p>' +
            _row('Email: ', '{{email}}', '#1d6c67') +
            _row('Password: ', '{{password}}', '#1d6c67'),
        ) +
        _note(
          'Please change your password after your first login for security.',
        ) +
        _btn(
          'https://www.admin-portal.vseeds.lk',
          'Open Admin Panel',
          '#1d6c67',
        ),
    ),
    variables: ['username', 'email', 'password'],
  },
  {
    slug: 'admin-account-activated',
    name: 'Admin Account Activated',
    category: 'Admin',
    subject: 'Admin Status Update Notification',
    description: 'Sent when an admin account is activated.',
    htmlBody: _wrap(
      'linear-gradient(90deg,#22c55e,#16a34a)',
      'Account Activated',
      '<div style="text-align:center;margin-bottom:16px;font-size:36px;">&#x2705;</div>' +
        _badge('Active', '#dcfce7', '#166534') +
        _p('Hello <strong>{{username}}</strong>,') +
        _p(
          'Your VSeeds admin account has been <strong>activated</strong> successfully. You now have full access to all platform features and services.',
        ) +
        _p('Please contact the admin if you have any questions.'),
    ),
    variables: ['username'],
  },
  {
    slug: 'admin-account-deactivated',
    name: 'Admin Account Deactivated',
    category: 'Admin',
    subject: 'Admin Status Update Notification',
    description: 'Sent when an admin account is deactivated.',
    htmlBody: _wrap(
      'linear-gradient(90deg,#ef4444,#dc2626)',
      'Account Deactivated',
      '<div style="text-align:center;margin-bottom:16px;font-size:36px;">&#x1F512;</div>' +
        _badge('Deactivated', '#fef2f2', '#991b1b') +
        _p('Hello <strong>{{username}}</strong>,') +
        _p(
          'We regret to inform you that your VSeeds admin account has been <strong>deactivated</strong>. This action was taken in accordance with our administrative policies.',
        ) +
        _p(
          'Please contact the admin for more information or to appeal this decision.',
        ),
    ),
    variables: ['username'],
  },
  {
    slug: 'admin-password-reset',
    name: 'Admin Password Reset',
    category: 'Admin',
    subject: 'Password Reset Request',
    description: 'Sent when an admin requests a password reset.',
    htmlBody: _wrap(
      'linear-gradient(90deg,#f97316,#ea580c)',
      'Admin Password Reset',
      _badge('Security Alert', '#fff7ed', '#9a3412') +
        _p('Hello <strong>{{username}}</strong>,') +
        _p(
          'We received a request to reset the password for your VSeeds admin account. Click below to proceed:',
        ) +
        _btn(
          '{{resetUrl}}?token={{token}}',
          'Reset My Password',
          '#ea580c',
        ) +
        _card(
          '<p style="margin:0;font-size:12px;color:#6b7280;text-align:center;line-height:1.6;"><strong style="color:#dc2626;">Important:</strong> If you did not request this, please disregard this email and ensure your current password is secure.</p>',
        ),
    ),
    variables: ['username', 'token', 'resetUrl'],
  },
  {
    slug: 'admin-account-deleted',
    name: 'Admin Account Deleted',
    category: 'Admin',
    subject: 'Account Deletion Notification',
    description: 'Sent when an admin account is permanently deleted.',
    htmlBody: _wrap(
      'linear-gradient(90deg,#6b7280,#4b5563)',
      'Account Deleted',
      '<div style="text-align:center;margin-bottom:16px;font-size:36px;">&#x1F5D1;&#xFE0F;</div>' +
        _badge('Permanently Removed', '#f3f4f6', '#374151') +
        _p('Dear <strong>{{username}}</strong>,') +
        _p(
          'Your VSeeds admin account has been permanently deleted from our system. All associated data, settings, and account information have been removed.',
        ) +
        _card(
          '<p style="margin:0;font-size:12px;color:#6b7280;text-align:center;">This action cannot be undone. Contact <a href="mailto:online@vseeds.lk" style="color:#4b5563;font-weight:600;">online@vseeds.lk</a> if you have questions.</p>',
        ),
    ),
    variables: ['username'],
  },
  {
    slug: 'product-restock',
    name: 'Product Back in Stock',
    category: 'Wishlist',
    subject: '{{productName}} is Back in Stock at VSeeds!',
    description: 'Sent to customers when a wishlisted product is restocked.',
    htmlBody: _wrap(
      'linear-gradient(90deg,#22c55e,#16a34a)',
      'Back in Stock!',
      _badge('Available Now', '#dcfce7', '#166534') +
        _p('Dear <strong>{{username}}</strong>,') +
        _p('Great news! A product from your wishlist is back in stock:') +
        '<div style="text-align:center;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:20px;margin-bottom:16px;"><p style="font-size:18px;font-weight:700;color:#16a34a;margin:0;">{{productName}}</p></div>' +
        _note("Popular items sell out quickly. Don't miss your chance!") +
        _btn('https://www.vseeds.lk', 'Shop Now', '#16a34a'),
    ),
    variables: ['username', 'productName'],
  },
  {
    slug: 'coupon-email',
    name: 'Exclusive Coupon',
    category: 'Promotions',
    subject: "Exclusive Coupon Inside - Don't Miss Out!",
    description:
      'Sent to customers with an exclusive coupon code and discount.',
    htmlBody: _wrap(
      'linear-gradient(90deg,#1d6c67,#00312f)',
      'Your Exclusive Coupon',
      _p('Dear <strong>{{username}}</strong>,') +
        _p(
          "As a token of appreciation, here's an exclusive coupon just for you!",
        ) +
        '<div style="background:linear-gradient(135deg,#1d6c67,#00312f);border-radius:12px;padding:20px;text-align:center;margin-bottom:16px;"><p style="color:rgba(255,255,255,0.8);font-size:12px;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 4px;">Your Discount</p><p style="color:#fff;font-size:22px;font-weight:700;margin:0 0 14px;">{{discount}} OFF</p><div style="background:#fff;border-radius:8px;padding:12px;border:2px dashed rgba(29,108,103,0.3);"><span style="font-family:monospace;font-size:22px;font-weight:700;color:#1d6c67;letter-spacing:0.05em;">{{couponCode}}</span></div></div>' +
        _btn('https://www.vseeds.lk', 'Shop Now', '#1d6c67'),
    ),
    variables: ['username', 'discount', 'couponCode'],
  },
  {
    slug: 'limited-time-offer',
    name: 'Limited Time Offer',
    category: 'Promotions',
    subject: "Limited Time Offer - Don't Miss Out!",
    description: 'Sent to customers with a limited time promotional offer.',
    htmlBody: _wrap(
      'linear-gradient(90deg,#f59e0b,#d97706)',
      'Limited Time Offer',
      _badge('Expires Soon', '#fffbeb', '#92400e') +
        _p('Dear <strong>{{username}}</strong>,') +
        _p(
          "We're excited to share an exclusive promotion with you! For a limited time, enjoy a special discount on select products:",
        ) +
        '<div style="background:linear-gradient(135deg,#f59e0b,#d97706);border-radius:12px;padding:20px;text-align:center;margin-bottom:16px;"><div style="background:#fff;border-radius:8px;padding:14px;border:2px dashed rgba(217,119,6,0.3);"><span style="font-size:22px;font-weight:700;color:#d97706;">{{discount}}</span></div><p style="color:#fff;font-size:13px;margin:10px 0 0;">Limited time — don\'t miss out!</p></div>' +
        _btn('https://www.vseeds.lk', 'Shop Now', '#d97706'),
    ),
    variables: ['username', 'discount'],
  },
];

interface FaqSeed {
  question: string;
  answer: string;
  category: string;
  site: 'electronics' | 'embedded' | 'both';
  displayOrder: number;
}

const DEFAULT_FAQS: FaqSeed[] = [
  // ── Electronics FAQs ──
  {
    question: 'What are your delivery areas in Sri Lanka?',
    answer:
      'We deliver island-wide across Sri Lanka, including Jaffna, Colombo, Kandy, and Galle. Most orders are handled via registered courier services to ensure safe delivery of electronic components.',
    category: 'Shipping & Delivery',
    site: 'electronics',
    displayOrder: 0,
  },
  {
    question: 'How long does shipping take?',
    answer:
      'Normal delivery takes 2-4 business days. For urgent projects in the Ja-Ela or Colombo area, we may offer faster delivery options. You will receive a tracking number once your order is dispatched.',
    category: 'Shipping & Delivery',
    site: 'electronics',
    displayOrder: 1,
  },
  {
    question: 'Do you offer free shipping?',
    answer:
      'We offer free shipping on orders above Rs. 15,000. For orders below this amount, a standard shipping fee is applied based on your location and total parcel weight.',
    category: 'Shipping & Delivery',
    site: 'electronics',
    displayOrder: 2,
  },
  {
    question: 'Are the products genuine and high-quality?',
    answer:
      'Yes, at VSEEDS we only source high-grade industrial components and original sensors. Every batch is tested to ensure it meets the specifications for professional and DIY electronics projects.',
    category: 'Products & Stock',
    site: 'electronics',
    displayOrder: 3,
  },
  {
    question: 'Can I request a product that is not listed?',
    answer:
      'Absolutely! If you need a specific microcontroller, sensor, or industrial module not currently in our store, please contact us via WhatsApp. We can often source custom items for our clients.',
    category: 'Products & Stock',
    site: 'electronics',
    displayOrder: 4,
  },
  {
    question: 'Do you provide bulk discounts for universities or companies?',
    answer:
      'Yes, we provide special pricing for bulk orders, schools, and university project groups. Contact our sales team with your component list for a custom quotation.',
    category: 'Products & Stock',
    site: 'electronics',
    displayOrder: 5,
  },
  {
    question: 'What payment methods do you accept?',
    answer:
      'We accept Bank Transfers, Credit/Debit Cards, and popular mobile payment methods in Sri Lanka. Cash on Delivery is available for specific regions and established customers.',
    category: 'Payments & Refunds',
    site: 'electronics',
    displayOrder: 6,
  },
  {
    question: 'What is your refund policy for damaged items?',
    answer:
      'If you receive a defective component, please notify us within 48 hours of delivery. We will provide a replacement or full refund once the defect is verified. Please keep the original packaging.',
    category: 'Payments & Refunds',
    site: 'electronics',
    displayOrder: 7,
  },
  {
    question: 'Do you provide guides for the components?',
    answer:
      'Many of our specialized modules come with downloadable datasheets or links to our Tech Blog where we post tutorials and DIY project guides.',
    category: 'Technical Support',
    site: 'electronics',
    displayOrder: 8,
  },
  {
    question: 'Can you help me with my project circuit?',
    answer:
      'While we can give general guidance on component usage, we do not provide full circuit design services for free. However, our blog is a great resource for common electronics troubleshooting.',
    category: 'Technical Support',
    site: 'electronics',
    displayOrder: 9,
  },

  // ── Embedded / PCB FAQs ──
  {
    question: 'What types of PCBs do you manufacture?',
    answer:
      'We manufacture a wide range of PCBs including Standard single and double-sided PCBs, Advanced multi-layer and HDI PCBs, Flexible PCBs (FPC), Rigid-Flex PCBs, and SMD Stencils. We also provide full turnkey PCB assembly services.',
    category: 'General',
    site: 'embedded',
    displayOrder: 0,
  },
  {
    question: 'What is the minimum order quantity?',
    answer:
      'We offer flexible order quantities to suit your needs. For prototyping, we accept orders as low as 5 pieces. For production runs, minimum quantities may vary depending on the PCB specifications. Contact us for specific requirements.',
    category: 'General',
    site: 'embedded',
    displayOrder: 1,
  },
  {
    question: 'How do I get a quote for my PCB project?',
    answer:
      'You can get a quote by visiting our "Get a Quote" page and filling in your PCB specifications. Our team will review your requirements and provide a detailed quote within 24 hours. You can also email us your Gerber files for a more accurate quotation.',
    category: 'Ordering',
    site: 'embedded',
    displayOrder: 2,
  },
  {
    question: 'What file formats do you accept for PCB designs?',
    answer:
      'We accept Gerber files (RS-274X), ODB++ files, Eagle (.brd), KiCad (.kicad_pcb), and Altium Designer files. Gerber files are preferred for the most accurate manufacturing results.',
    category: 'PCB Manufacturing',
    site: 'embedded',
    displayOrder: 3,
  },
  {
    question: 'What is the standard turnaround time?',
    answer:
      'Standard turnaround time is 5-7 business days for prototype orders and 7-14 business days for production orders. We also offer expedited services with 24-48 hour turnaround for urgent projects at an additional cost.',
    category: 'PCB Manufacturing',
    site: 'embedded',
    displayOrder: 4,
  },
  {
    question: 'What quality standards do you follow?',
    answer:
      'We follow IPC Class 2 and Class 3 standards for PCB manufacturing. All boards undergo automated optical inspection (AOI), electrical testing, and visual inspection before shipping. We maintain ISO 9001 quality management practices.',
    category: 'PCB Manufacturing',
    site: 'embedded',
    displayOrder: 5,
  },
  {
    question: 'Do you offer PCB assembly services?',
    answer:
      'Yes, we offer full turnkey PCB assembly services including SMT (Surface Mount Technology) and through-hole assembly. We handle component sourcing, solder paste application, pick-and-place, reflow soldering, and quality inspection.',
    category: 'PCB Manufacturing',
    site: 'embedded',
    displayOrder: 6,
  },
  {
    question: 'What are your payment methods?',
    answer:
      'We accept bank transfers, credit/debit cards, and online payment methods. For regular customers, we also offer credit terms. Payment is typically required before production begins.',
    category: 'Ordering',
    site: 'embedded',
    displayOrder: 7,
  },
  {
    question: 'Can I track my order?',
    answer:
      'Yes, once your order is placed, you can track its progress through your account dashboard. You will receive email notifications at each stage of production and when your order is shipped.',
    category: 'Ordering',
    site: 'embedded',
    displayOrder: 8,
  },
  {
    question: 'Do you ship internationally?',
    answer:
      'Yes, we ship to destinations worldwide. We partner with leading courier services like DHL, FedEx, and UPS to ensure safe and timely delivery. Shipping costs are calculated based on the destination and package weight.',
    category: 'Shipping',
    site: 'embedded',
    displayOrder: 9,
  },
  {
    question: 'How are the PCBs packaged for shipping?',
    answer:
      'All PCBs are vacuum-sealed and placed in anti-static packaging to prevent moisture and static damage. They are then securely packed in corrugated boxes with adequate cushioning material for safe transit.',
    category: 'Shipping',
    site: 'embedded',
    displayOrder: 10,
  },
  {
    question: 'What if I receive a defective product?',
    answer:
      'We stand behind the quality of our products. If you receive a defective PCB, please contact our support team within 7 days of delivery with photos and details. We will arrange a replacement or refund as per our quality guarantee policy.',
    category: 'Shipping',
    site: 'embedded',
    displayOrder: 11,
  },
];

const DEFAULT_BANKS = [
  {
    bankName: 'Sampath Bank',
    branch: 'Negombo',
    accountNumber: 'xxxxxxxxxx',
    accountName: 'SEEDS (PVT) LTD',
    isActive: true,
    displayOrder: 1,
  },
  {
    bankName: 'Bank of Ceylon',
    branch: 'Negombo',
    accountNumber: 'xxxxxxxxxx',
    accountName: 'SEEDS (PVT) LTD',
    isActive: true,
    displayOrder: 2,
  },
];

const PRIVILEGE_MODULES = [
  'dashboard',
  'products',
  'categories',
  'orders',
  'payments',
  'deliveries',
  'wishlists',
  'banners',
  'blogs',
  'faqs',
  'projects',
  'reviews',
  'quotes',
  'customers',
  'admins',
  'roles',
  'statistics',
  'activity_logs',
  'contacts',
  'email_templates',
  'image_gallery',
  'settings',
  'banks',
];
const ACTIONS = ['read', 'create', 'update', 'delete'] as const;

async function seed() {
  const logger = new Logger('Seed');
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const prisma = app.get(PrismaService);

    // ---------- Roles ----------
    const roleDefs = [
      {
        name: 'super admin',
        description: 'Full system access',
        isSystem: true,
      },
      { name: 'admin', description: 'Administrative access', isSystem: true },
      { name: 'user', description: 'Customer access', isSystem: true },
      { name: 'employee', description: 'Employee access', isSystem: false },
    ];

    for (const def of roleDefs) {
      const exists = await prisma.role.findUnique({
        where: { name: def.name },
      });
      if (!exists) {
        await prisma.role.create({ data: def });
        logger.log(`Created role: ${def.name}`);
      }
    }

    // ---------- Super Admin ----------
    const superAdminRole = await prisma.role.findUnique({
      where: { name: 'super admin' },
    });
    if (!superAdminRole) {
      logger.error('super admin role not found — aborting admin creation');
      return;
    }

    const adminEmail =
      process.env.SUPER_ADMIN_EMAIL ?? 'kajamohanofficial@gmail.com';
    const existing = await prisma.admin.findUnique({
      where: { emailLookup: createLookupHash(adminEmail, 'email') },
    });

    if (!existing) {
      const salt = await bcrypt.genSalt(10);
      const superAdminPassword =
        process.env.SUPER_ADMIN_SECURITY ?? 'S33d$_1998_K@j@';
      const hashedPassword = await bcrypt.hash(superAdminPassword, salt);
      await prisma.admin.create({
        data: {
          username: 'SuperAdmin',
          usernameLookup: createLookupHash('SuperAdmin', 'username'),
          email: adminEmail,
          emailLookup: createLookupHash(adminEmail, 'email'),
          passwordHash: hashedPassword,
          roleId: superAdminRole.id,
          status: 'active',
        },
      });
      logger.log(`Created super admin: ${adminEmail}`);
    }

    // ---------- Settings ----------
    let created = 0;
    for (const def of DEFAULT_SETTINGS) {
      const exists = await prisma.setting.findUnique({
        where: { key: def.key },
      });
      if (!exists) {
        await prisma.setting.create({
          data: {
            key: def.key,
            value: def.value,
            valueType: def.valueType,
            group: def.group,
            description: def.description,
          },
        });
        created++;
      }
    }
    if (created > 0) {
      logger.log(`Created ${created} default settings`);
    } else {
      logger.log('All default settings already exist');
    }

    // ---------- Privileges ----------
    let privCreated = 0;
    for (const mod of PRIVILEGE_MODULES) {
      for (const action of ACTIONS) {
        const name = `${mod}.${action}`;
        const exists = await prisma.privilege.findUnique({ where: { name } });
        if (!exists) {
          await prisma.privilege.create({
            data: {
              name,
              module: mod,
              description: `${action} access for ${mod.replace(/_/g, ' ')}`,
            },
          });
          privCreated++;
        }
      }
    }
    if (privCreated > 0) {
      logger.log(`Created ${privCreated} privileges`);
    } else {
      logger.log('All privileges already exist');
    }

    // ---------- Assign all privileges to super admin ----------
    const saRole = await prisma.role.findUnique({
      where: { name: 'super admin' },
    });
    if (saRole) {
      const allPrivileges = await prisma.privilege.findMany();
      let assigned = 0;
      for (const priv of allPrivileges) {
        const exists = await prisma.rolePrivilege.findUnique({
          where: {
            uq_role_priv: {
              roleId: saRole.id,
              privilegeId: priv.id,
            },
          },
        });
        if (!exists) {
          await prisma.rolePrivilege.create({
            data: {
              roleId: saRole.id,
              privilegeId: priv.id,
              isActive: true,
            },
          });
          assigned++;
        }
      }
      if (assigned > 0) {
        logger.log(`Assigned ${assigned} privileges to super admin`);
      }
    }

    // ---------- Assign read privileges to admin role ----------
    const adminRole = await prisma.role.findUnique({
      where: { name: 'admin' },
    });
    if (adminRole) {
      const readPrivileges = await prisma.privilege.findMany();
      let assigned = 0;
      for (const priv of readPrivileges.filter(
        (p) =>
          p.name.endsWith('.read') ||
          p.name.endsWith('.create') ||
          p.name.endsWith('.update'),
      )) {
        const exists = await prisma.rolePrivilege.findUnique({
          where: {
            uq_role_priv: {
              roleId: adminRole.id,
              privilegeId: priv.id,
            },
          },
        });
        if (!exists) {
          await prisma.rolePrivilege.create({
            data: {
              roleId: adminRole.id,
              privilegeId: priv.id,
              isActive: true,
            },
          });
          assigned++;
        }
      }
      if (assigned > 0) {
        logger.log(`Assigned ${assigned} privileges to admin`);
      }
    }

    // ---------- Email Templates ----------
    let templatesCreated = 0;
    for (const tpl of DEFAULT_EMAIL_TEMPLATES) {
      await prisma.emailTemplate.upsert({
        where: { slug: tpl.slug },
        update: {
          name: tpl.name,
          category: tpl.category,
          description: tpl.description,
          subject: tpl.subject,
          htmlBody: tpl.htmlBody,
          variables: tpl.variables,
        },
        create: {
          slug: tpl.slug,
          name: tpl.name,
          category: tpl.category,
          description: tpl.description,
          subject: tpl.subject,
          htmlBody: tpl.htmlBody,
          variables: tpl.variables,
          isActive: true,
        },
      });
      templatesCreated++;
    }
    logger.log(`Upserted ${templatesCreated} default email templates`);

    // ---------- FAQs ----------
    let faqsCreated = 0;
    for (const def of DEFAULT_FAQS) {
      const exists = await prisma.fAQ.findFirst({
        where: { question: def.question, site: def.site },
      });
      if (!exists) {
        await prisma.fAQ.create({
          data: {
            question: def.question,
            answer: def.answer,
            category: def.category,
            site: def.site,
            displayOrder: def.displayOrder,
            isActive: true,
          },
        });
        faqsCreated++;
      }
    }
    if (faqsCreated > 0) {
      logger.log(`Created ${faqsCreated} default FAQs`);
    } else {
      logger.log('All default FAQs already exist');
    }

    // ---------- Banks ----------
    let banksCreated = 0;
    for (const def of DEFAULT_BANKS) {
      const exists = await prisma.bank.findFirst({
        where: { bankName: def.bankName, accountNumber: def.accountNumber },
      });
      if (!exists) {
        await prisma.bank.create({
          data: {
            bankName: def.bankName,
            branch: def.branch,
            accountNumber: def.accountNumber,
            accountName: def.accountName,
            isActive: def.isActive,
            displayOrder: def.displayOrder,
          },
        });
        banksCreated++;
      }
    }
    if (banksCreated > 0) {
      logger.log(`Created ${banksCreated} default bank accounts`);
    } else {
      logger.log('All default bank accounts already exist');
    }

    logger.log('Seed completed successfully');
  } catch (err) {
    logger.error('Seed failed', err);
  } finally {
    try {
      await app.close();
    } catch (err) {
      console.log(err);
      // Ignore connection cleanup errors (e.g. Redis)
    }
  }
}

seed().catch((err) => {
  console.error('Unhandled error during seeding:', err);
  process.exit(1);
});
