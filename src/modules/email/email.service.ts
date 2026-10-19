import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { EmailTemplatesService } from '../email-templates/email-templates.service';

export interface SendMailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  bcc?: string | string[];
  attachments?: { filename: string; content: Buffer; contentType?: string }[];
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor(
    private readonly configService: ConfigService,
    private readonly emailTemplatesService: EmailTemplatesService,
  ) {
    const port = Number(this.configService.get('MAIL_PORT', '587'));
    const mailSecureEnv = this.configService.get<string | undefined>('MAIL_SECURE');
    const secure = mailSecureEnv ? mailSecureEnv === 'true' : port === 465;
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('MAIL_HOST'),
      port,
      secure,
      auth: {
        user: this.configService.get<string>('MAIL_USERNAME'),
        pass: this.configService.get<string>('MAIL_PASSWORD'),
      },
    });
  }

  async send(options: SendMailOptions): Promise<boolean> {
    const recipients = Array.isArray(options.to)
      ? options.to.join(',')
      : options.to;
    try {
      await this.transporter.sendMail({
        from: this.configService.get<string>('MAIL_FROM_ADDRESS'),
        to: recipients,
        subject: options.subject,
        html: options.html,
        text: options.text,
        bcc: options.bcc
          ? Array.isArray(options.bcc)
            ? options.bcc.join(',')
            : options.bcc
          : undefined,
        attachments: options.attachments,
      });
      this.logger.log(`Email sent to ${recipients}`);
      return true;
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to send email to ${recipients}: ${errMsg}`);
      return false;
    }
  }

  async sendWithTemplate(
    templateSlug: string,
    to: string | string[],
    data: Record<string, string>,
    bcc?: string | string[],
  ): Promise<boolean> {
    const rendered = await this.emailTemplatesService.render(
      templateSlug,
      data,
    );
    return this.send({
      to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text ?? undefined,
      bcc,
    });
  }

  async sendToSystem(subject: string, html: string): Promise<boolean> {
    const bccSystem = this.configService.get<string>('MAIL_BCC_SYSTEM');
    if (!bccSystem) return false;
    return this.send({ to: bccSystem, subject, html });
  }

  async sendToSales(
    to: string,
    subject: string,
    html: string,
  ): Promise<boolean> {
    const bccSales = this.configService.get<string>('MAIL_BCC_SALES');
    return this.send({ to, subject, html, bcc: bccSales });
  }

  async sendToCustomer(
    to: string,
    subject: string,
    html: string,
  ): Promise<boolean> {
    return this.send({ to, subject, html });
  }
}
