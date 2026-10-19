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
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { BannersService } from './banners.service';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { imageFileFilter } from '../../common/utils/image-file-filter';
import { CreateBannerDto } from './dto/create-banner.dto';
import { BannerQueryDto } from './dto/banner-query.dto';
import { Prisma, DeviceType } from '@prisma/client';
import {
  validateImageUpload,
  FILE_UPLOAD_LIMITS,
} from '../../common/utils/file-upload-validation';

interface UpdateBannerRequest {
  title?: string;
  deviceType?: string;
  linkUrl?: string;
  displayOrder?: string | number;
  isActive?: string | boolean;
  startsAt?: string | null;
  endsAt?: string | null;
}

@ApiTags('Banners')
@Controller('banner')
export class BannersController {
  constructor(
    private readonly bannersService: BannersService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get banners (public, filterable)' })
  findAll(@Query() query: BannerQueryDto) {
    return this.bannersService.findAll(query);
  }

  @Get(':id')
  @Roles('admin', 'super admin')
  @ApiOperation({ summary: 'Get banner by ID' })
  findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.bannersService.findById(id);
  }

  @Post('add')
  @Roles('admin', 'super admin')
  @UseInterceptors(FileInterceptor('image', { fileFilter: imageFileFilter }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Add banner with image (admin)' })
  async create(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateBannerDto,
  ) {
    if (!file) throw new BadRequestException('Image file is required');
    const validation = validateImageUpload(file.buffer, file.mimetype, {
      maxSize: FILE_UPLOAD_LIMITS.banner,
    });
    if (!validation.valid) {
      throw new BadRequestException(validation.error);
    }
    if (validation.detectedMime && file.mimetype !== validation.detectedMime) {
      file.mimetype = validation.detectedMime;
    }

    // Save to server instead of Google Drive
    const fs = require('fs');
    const path = require('path');
    const crypto = require('crypto');
    
    const uploadDir = process.env.UPLOAD_DIR || './uploads/images';
    const extension = path.extname(file.originalname);
    const filename = `banner-${crypto.randomUUID()}${extension}`;
    const filepath = path.join(uploadDir, filename);
    
    // Ensure upload directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    // Write file to server
    fs.writeFileSync(filepath, file.buffer);
    
    // Generate URL using CDN_URL from environment
    const cdnUrl = this.configService.get<string>('CDN_URL', 'https://www.vseeds.lk/upload_vseeds/images');
    const imageUrl = `${cdnUrl}/${filename}`;

    return this.bannersService.create(
      imageUrl,
      dto.deviceType,
      dto.isActive !== false,
      dto.title,
      dto.linkUrl,
      dto.displayOrder,
      dto.startsAt ? new Date(dto.startsAt) : undefined,
      dto.endsAt ? new Date(dto.endsAt) : undefined,
    );
  }

  @Put('update/:id')
  @Roles('admin', 'super admin')
  @UseInterceptors(FileInterceptor('image', { fileFilter: imageFileFilter }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Update an existing banner (admin)' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: UpdateBannerRequest,
  ) {
    const existingBanner = await this.bannersService.findById(id);
    let imageUrl = existingBanner.imageUrl;

    if (file) {
      const validation = validateImageUpload(file.buffer, file.mimetype, {
        maxSize: FILE_UPLOAD_LIMITS.banner,
      });
      if (!validation.valid) {
        throw new BadRequestException(validation.error);
      }
      if (
        validation.detectedMime &&
        file.mimetype !== validation.detectedMime
      ) {
        file.mimetype = validation.detectedMime;
      }

      // Clean up previous image from server
      if (existingBanner.imageUrl) {
        const fs = require('fs');
        const path = require('path');
        const uploadDir = process.env.UPLOAD_DIR || './uploads/images';
        const filename = existingBanner.imageUrl.split('/').pop();
        const filepath = path.join(uploadDir, filename);
        
        if (fs.existsSync(filepath)) {
          fs.unlinkSync(filepath);
        }
      }

      // Save new image to server
      const fs = require('fs');
      const path = require('path');
      const crypto = require('crypto');
      
      const uploadDir = process.env.UPLOAD_DIR || './uploads/images';
      const extension = path.extname(file.originalname);
      const filename = `banner-${crypto.randomUUID()}${extension}`;
      const filepath = path.join(uploadDir, filename);
      
      // Ensure upload directory exists
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      
      // Write file to server
      fs.writeFileSync(filepath, file.buffer);
      
      // Generate URL using CDN_URL from environment
      const cdnUrl = this.configService.get<string>('CDN_URL', 'https://www.vseeds.lk/upload_vseeds/images');
      imageUrl = `${cdnUrl}/${filename}`;
    }

    const updateData: Prisma.BannerUpdateInput = {};
    if (imageUrl) updateData.imageUrl = imageUrl;
    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.deviceType !== undefined) {
      updateData.deviceType = dto.deviceType as DeviceType;
    }
    if (dto.linkUrl !== undefined) updateData.linkUrl = dto.linkUrl;
    if (dto.displayOrder !== undefined) {
      updateData.displayOrder = Number(dto.displayOrder);
    }

    if (dto.isActive !== undefined)
      updateData.isActive = String(dto.isActive) !== 'false';

    if (dto.startsAt) updateData.startsAt = new Date(dto.startsAt);
    else if (dto.startsAt === '') updateData.startsAt = null;

    if (dto.endsAt) updateData.endsAt = new Date(dto.endsAt);
    else if (dto.endsAt === '') updateData.endsAt = null;

    return this.bannersService.update(id, updateData);
  }

  @Put('status/:id')
  @Roles('admin', 'super admin')
  @ApiOperation({ summary: 'Toggle banner status (admin)' })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('active') active: boolean,
  ) {
    return this.bannersService.updateStatus(id, active);
  }

  @Delete('delete/:id')
  @Roles('admin', 'super admin')
  @ApiOperation({ summary: 'Delete banner (admin)' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.bannersService.remove(id);
  }
}
