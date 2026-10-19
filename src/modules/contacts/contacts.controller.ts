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
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ContactsService } from './contacts.service';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateContactDto } from './dto/create-contact.dto';
import { ReplyContactDto } from './dto/reply-contact.dto';
import { UpdateContactStatusDto } from './dto/update-contact-status.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';

@ApiTags('Contacts')
@Controller('contact')
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Public()
  @Post('add')
  @ApiOperation({ summary: 'Submit contact form' })
  create(@Body() dto: CreateContactDto) {
    return this.contactsService.create(dto);
  }

  @Get('all')
  @Roles('admin', 'super admin')
  @ApiOperation({ summary: 'Get all contacts (admin)' })
  findAll(@Query() pagination: PaginationDto) {
    return this.contactsService.findAll(pagination);
  }

  @Get('search/:search')
  @Roles('admin', 'super admin')
  @ApiOperation({ summary: 'Search contacts (admin)' })
  search(@Param('search') search: string, @Query() pagination: PaginationDto) {
    return this.contactsService.search(search, pagination);
  }

  @Get(':id')
  @Roles('admin', 'super admin')
  @ApiOperation({ summary: 'Get contact by ID (admin)' })
  findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.contactsService.findById(id);
  }

  @Put('update-status/:id')
  @Roles('admin', 'super admin')
  @ApiOperation({ summary: 'Update contact status (admin)' })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateContactStatusDto,
  ) {
    return this.contactsService.updateStatus(id, dto.status);
  }

  @Delete('delete/:id')
  @Roles('admin', 'super admin')
  @ApiOperation({ summary: 'Delete contact (admin, soft)' })
  delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.contactsService.softDelete(id);
  }

  @Post('reply/:id')
  @Roles('admin', 'super admin')
  @ApiOperation({ summary: 'Reply to contact (admin)' })
  reply(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReplyContactDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.contactsService.reply(id, dto.message, user.id);
  }
}
