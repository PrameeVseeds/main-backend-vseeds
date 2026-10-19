import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { EmailTemplatesService } from './email-templates.service';
import { EmailService } from '../email/email.service';
import { EncryptionService } from '../../common/services/encryption.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { CreateEmailTemplateDto } from './dto/create-email-template.dto';
import { UpdateEmailTemplateDto } from './dto/update-email-template.dto';

@ApiTags('Email Templates')
@Controller('email-templates')
@Roles('admin', 'super admin')
export class EmailTemplatesController {
  constructor(
    private readonly emailTemplatesService: EmailTemplatesService,
    private readonly emailService: EmailService,
    private readonly encryptionService: EncryptionService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all email templates (optional pagination)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  findAll(@Query('page') page?: string, @Query('limit') limit?: string) {
    const pagination =
      page != null && limit != null
        ? { page: Number(page) || 1, limit: Number(limit) || 10 }
        : undefined;
    return this.emailTemplatesService.findAll(pagination);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get email template by ID' })
  findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.emailTemplatesService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create email template' })
  create(@Body() dto: CreateEmailTemplateDto) {
    return this.emailTemplatesService.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update email template' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmailTemplateDto,
  ) {
    return this.emailTemplatesService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete email template (soft)' })
  delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.emailTemplatesService.softDelete(id);
  }

  @Post('preview/:slug')
  @ApiOperation({ summary: 'Preview rendered template with sample data' })
  preview(@Param('slug') slug: string, @Body() data: Record<string, string>) {
    return this.emailTemplatesService.render(slug, data);
  }

  @Post('send-test/:id')
  @ApiOperation({
    summary: 'Send a test email using this template to the current admin',
  })
  async sendTest(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const template = await this.emailTemplatesService.findById(id);
    const sampleData: Record<string, string> = {};
    for (const v of template.variables ?? []) {
      sampleData[v] = `[${v}]`;
    }
    const rendered = await this.emailTemplatesService.render(
      template.slug,
      sampleData,
    );
    const recipient = this.encryptionService.decrypt(user.email);
    const sent = await this.emailService.send({
      to: recipient,
      subject: `[TEST] ${rendered.subject}`,
      html: rendered.html,
      text: rendered.text ?? undefined,
    });
    if (!sent) {
      return {
        success: false,
        message: 'Failed to send test email. Check mail configuration.',
      };
    }
    return { success: true, message: `Test email sent to ${recipient}` };
  }
}
