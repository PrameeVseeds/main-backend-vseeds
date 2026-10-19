import { Injectable, Logger } from '@nestjs/common';
import { EmailService } from './email.service';

@Injectable()
export class EmailQueueService {
  private readonly logger = new Logger(EmailQueueService.name);

  constructor(private readonly emailService: EmailService) {}

  /**
   * Send a templated email directly and log results.
   */
  async enqueue(
    templateSlug: string,
    to: string | string[],
    data: Record<string, string>,
    bcc?: string | string[],
  ): Promise<void> {
    const recipients = Array.isArray(to) ? to.join(',') : to;
    this.logger.log(
      `Directly sending templated email: ${templateSlug} to ${recipients}`,
    );
    try {
      await this.emailService.sendWithTemplate(templateSlug, to, data, bcc);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Direct email send failed for ${recipients}: ${errMsg}`,
      );
    }
  }

  /**
   * Send a raw email directly and log results.
   */
  async enqueueRaw(
    to: string | string[],
    subject: string,
    html: string,
    text?: string,
    attachments?: { filename: string; content: Buffer; contentType?: string }[],
  ): Promise<void> {
    const recipients = Array.isArray(to) ? to.join(',') : to;
    this.logger.log(`Directly sending raw email to ${recipients}`);
    try {
      await this.emailService.send({ to, subject, html, text, attachments });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Direct raw email send failed for ${recipients}: ${errMsg}`,
      );
    }
  }
}
