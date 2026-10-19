import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../common/services/encryption.service';
import { EmailQueueService } from '../email/email-queue.service';
import { InvoiceQueryDto } from './dto/invoice-query.dto';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import puppeteer from 'puppeteer';
import { buildInvoiceDocument } from './invoice-document';

const INVOICE_NUMBER_PREFIX = 'INV-';
const MAX_INVOICE_NUMBER_LENGTH = 30;

function roundToTwo(value: any): number {
  return Math.round(Number(value) * 100) / 100;
}

const DEFAULT_INVOICE_PDF_SETTINGS = {
  layout: 'classic',
  companyName: 'VSEEDS',
  companyAddress: 'No. 123, Main Street, Colombo, Sri Lanka',
  companyPhone: '+94 11 234 5678',
  companyEmail: 'info@vseeds.lk',
  companyLogo: null,
  accentColor: '#16a34a',
  notes: 'Thank you for your business. If you have any questions, please contact support.',
  terms: 'Payment is due within 14 days. Late payments may be subject to a surcharge.',
  taxLabel: 'Tax',
  signatureName: 'Authorized Signatory',
  signatureTitle: 'VSEEDS Management',
  showLogo: true,
  showNotes: true,
  showTerms: true,
  showSignature: true,
};

async function generateInvoicePdf(
  invoice: any,
  settings: typeof DEFAULT_INVOICE_PDF_SETTINGS = DEFAULT_INVOICE_PDF_SETTINGS,
): Promise<Buffer> {
  const sample = {
    invoiceId: invoice.invoiceNumber || invoice.id,
    date: invoice.createdAt
      ? new Date(invoice.createdAt).toLocaleDateString()
      : '',
    dueDate: invoice.createdAt
      ? new Date(invoice.createdAt).toLocaleDateString()
      : '',
    orderNumber: invoice.orderNumber || '',
    customerName: invoice.customerName || 'Customer',
    customerEmail: invoice.customerEmail || '',
    customerPhone: invoice.customerPhone || '',
    status: invoice.status || '',
    items: (invoice.items || []).map((it: any, i: number) => ({
      no: i + 1,
      name: it.productName || '',
      qty: it.quantity || 0,
      unitPrice: Number(it.unitPrice || 0),
      total: Number(it.totalPrice || 0),
    })),
    subtotal: Number(invoice.subtotal || 0),
    tax: Number(invoice.taxAmount || 0),
    shipping: Number(invoice.shippingFee || 0),
    total: Number(invoice.totalAmount || 0),
  };

  const html = buildInvoiceDocument(settings as any, sample as any);
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'load' });
  const pdf = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: '12mm', right: '12mm', bottom: '12mm', left: '12mm' },
  });
  await browser.close();
  return Buffer.from(pdf);
}

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
    private readonly emailQueueService: EmailQueueService,
  ) {}

  private get invoiceClient() {
    return (this.prisma as any).invoice;
  }

  async generateFromOrder(orderId: string) {
    const existing = await this.invoiceClient.findFirst({
      where: { orderId },
      include: { items: true, order: true },
    });

    if (existing) {
      return existing;
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        shippingAddress: true,
        user: {
          include: {
            addresses: {
              where: { isDefault: true },
              take: 1,
            },
          },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const address = order.shippingAddress ?? order.user.addresses[0];

    const customerName = address
      ? this.encryptionService.decrypt(address.fullName || '')
      : `${this.encryptionService.decrypt(order.user.firstName || '')} ${this.encryptionService.decrypt(order.user.lastName || '')}`.trim();

    const customerEmail =
      this.encryptionService.decrypt((address?.email || order.user.email) || '') || null;
    const customerPhone =
      this.encryptionService.decrypt((address?.phone || order.user.phone) || '') || null;

    const buildAddressJson = (a?: any): any => {
      if (!a) return null;
      const decrypt = (v?: string | null) =>
        typeof v === 'string' ? this.encryptionService.decrypt(v) : null;
      return {
        label: a.label ?? null,
        fullName: decrypt(a.fullName),
        email: decrypt(a.email),
        phone: decrypt(a.phone),
        addressLine1: decrypt(a.addressLine1),
        addressLine2: decrypt(a.addressLine2),
        city: decrypt(a.city),
        district: decrypt(a.district),
        province: decrypt(a.province),
        postalCode: decrypt(a.postalCode),
        country: decrypt(a.country),
      };
    };

    const billingAddress = buildAddressJson(address);
    const shippingAddress = buildAddressJson(order.shippingAddress);

    const latestPayment = order.payments[0];
    const paymentMethod =
      latestPayment?.paymentMethod ?? 'bank_transfer';
    const paymentStatus =
      latestPayment?.status ?? 'pending';

    let invoiceNumber = `${INVOICE_NUMBER_PREFIX}${order.orderNumber}`;
    if (invoiceNumber.length > MAX_INVOICE_NUMBER_LENGTH) {
      const available =
        MAX_INVOICE_NUMBER_LENGTH - INVOICE_NUMBER_PREFIX.length;
      invoiceNumber =
        INVOICE_NUMBER_PREFIX +
        order.orderNumber.slice(-available);
    }

    const existingInvoiceNumber = await this.invoiceClient.findFirst({
      where: { invoiceNumber },
    });
    if (existingInvoiceNumber) {
      invoiceNumber =
        INVOICE_NUMBER_PREFIX +
        order.id.slice(0, MAX_INVOICE_NUMBER_LENGTH - INVOICE_NUMBER_PREFIX.length);
    }

    const invoice = await this.invoiceClient.create({
      data: {
        invoiceNumber,
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerName,
        customerEmail,
        customerPhone,
        billingAddress: billingAddress as any,
        shippingAddress: shippingAddress as any,
        subtotal: roundToTwo(order.subtotal),
        shippingFee: roundToTwo(order.shippingFee),
        discountAmount: roundToTwo(order.discountAmount),
        taxAmount: 0,
        totalAmount: roundToTwo(order.totalAmount),
        promoCode: order.promoCode,
        paymentMethod,
        paymentStatus,
        notes: order.customerNotes ?? order.adminNotes,
        status: 'generated',
        items: {
          create: order.items.map((item: any) => ({
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: roundToTwo(item.unitPrice),
            totalPrice: roundToTwo(item.totalPrice),
          })),
        },
      },
      include: { items: true, order: true },
    });

    return invoice;
  }

  async findAll(query: InvoiceQueryDto) {
    const {
      page = 1,
      limit = 10,
      status,
      paymentStatus,
      customer,
      startDate,
      endDate,
    } = query;

    const where: any = {};

    if (status && status !== 'all') {
      where.status = status;
    }

    if (paymentStatus && paymentStatus !== 'all') {
      where.paymentStatus = paymentStatus;
    }

    if (customer) {
      const term = customer.trim();
      where.OR = [
        { invoiceNumber: { contains: term } },
        { orderNumber: { contains: term } },
        { customerName: { contains: term } },
        { customerEmail: { contains: term } },
        { customerPhone: { contains: term } },
      ];
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    const [invoices, total] = await Promise.all([
      this.invoiceClient.findMany({
        where,
        include: { items: true, order: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.invoiceClient.count({ where }),
    ]);

    return {
      invoices,
      total,
      totalPages: Math.ceil(total / limit),
      page,
    };
  }

  async findById(id: string) {
    const invoice = await this.invoiceClient.findUnique({
      where: { id },
      include: { items: true, order: true },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    return invoice;
  }

  async findByOrderId(orderId: string) {
    const invoice = await this.invoiceClient.findFirst({
      where: { orderId },
      include: { items: true, order: true },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found for this order');
    }

    return invoice;
  }

  async sendInvoice(id: string) {
    const invoice = await this.findById(id);

    const activeTemplate = await (this.prisma as any).invoiceTemplate.findFirst({
      where: { isActive: true, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    const settings = {
      ...DEFAULT_INVOICE_PDF_SETTINGS,
      ...(activeTemplate?.settings || {}),
    };

    const updated = await this.invoiceClient.update({
      where: { id },
      data: {
        status: 'sent',
        sentAt: new Date(),
      },
      include: { items: true, order: true },
    });

    if (invoice.customerEmail) {
      const total = Number(invoice.totalAmount || 0).toFixed(2);
      const html = `<p>Dear ${invoice.customerName ?? 'Customer'},</p>
        <p>Your invoice <strong>${invoice.invoiceNumber}</strong> for order <strong>${invoice.orderNumber}</strong> has been sent.</p>
        <p>Total amount: <strong>${total}</strong></p>
        <p>Thank you for your business.</p>`;

      let decryptedPhone = invoice.customerPhone || '';
      if (decryptedPhone.startsWith('ENC:')) {
        try {
          decryptedPhone = this.encryptionService.decrypt(decryptedPhone);
        } catch {
          decryptedPhone = '';
        }
      }
      const pdfInvoice = { ...invoice, customerPhone: decryptedPhone };


      const pdfBuffer = await generateInvoicePdf(pdfInvoice, settings);
      void this.emailQueueService.enqueueRaw(
        invoice.customerEmail,
        `Invoice ${invoice.invoiceNumber}`,
        html,
        undefined,
        [
          {
            filename: `Invoice-${invoice.invoiceNumber}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf',
          },
        ],
      );
    }

    return updated;
  }

  async create(dto: CreateInvoiceDto) {
    return this.generateFromOrder(dto.orderId);
  }

  async generateAll() {
    const orders = await this.prisma.order.findMany({
      where: {
        deletedAt: null,
        invoices: { none: {} },
      },
      select: { id: true },
    });

    const results: any[] = [];
    for (const order of orders) {
      results.push(await this.generateFromOrder(order.id));
    }

    return {
      generated: results.length,
      total: orders.length,
    };
  }
}
