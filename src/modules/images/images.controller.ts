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
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ImagesService } from './images.service';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { imageFileFilter } from '../../common/utils/image-file-filter';
import { GalleryQueryDto } from './dto/gallery-query.dto';
import { BulkDeleteDto } from './dto/bulk-delete.dto';

@ApiTags('Images')
@Controller('images')
export class ImagesController {
  constructor(private readonly imagesService: ImagesService) {}

  @Public()
  @Get('thumbnail/:productId')
  @ApiOperation({ summary: 'Get product thumbnail' })
  getThumbnail(@Param('productId', ParseUUIDPipe) productId: string) {
    return this.imagesService.getThumbnail(productId);
  }

  @Public()
  @Get('images/:productId')
  @ApiOperation({ summary: 'Get product images' })
  getProductImages(@Param('productId', ParseUUIDPipe) productId: string) {
    return this.imagesService.getProductImages(productId);
  }

  @Post('thumbnail/:productId')
  @Roles('admin', 'super admin')
  @UseInterceptors(FileInterceptor('image', { fileFilter: imageFileFilter }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload thumbnail' })
  addThumbnail(
    @Param('productId', ParseUUIDPipe) productId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('name') name?: string,
    @Body('folder') folder?: string,
  ) {
    return this.imagesService.addThumbnail(productId, file, name, folder);
  }

  @Put('thumbnail/:productId')
  @Roles('admin', 'super admin')
  @UseInterceptors(FileInterceptor('image', { fileFilter: imageFileFilter }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Update thumbnail' })
  updateThumbnail(
    @Param('productId', ParseUUIDPipe) productId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('name') name?: string,
    @Body('folder') folder?: string,
  ) {
    return this.imagesService.updateThumbnail(productId, file, name, folder);
  }

  @Post('images/:productId')
  @Roles('admin', 'super admin')
  @UseInterceptors(FilesInterceptor('images', 10, { fileFilter: imageFileFilter }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload product images' })
  addImages(
    @Param('productId', ParseUUIDPipe) productId: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body('name') name?: string,
    @Body('folder') folder?: string,
  ) {
    return this.imagesService.addImages(productId, files, name, folder);
  }

  @Post('upload')
  @Roles('admin', 'super admin')
  @UseInterceptors(FileInterceptor('file', { fileFilter: imageFileFilter }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a standalone image' })
  uploadGeneric(
    @UploadedFile() file: Express.Multer.File,
    @Body('name') name?: string,
    @Body('folder') folder?: string,
  ) {
    return this.imagesService.uploadGeneric(file, name, folder);
  }

  @Delete('delete/:mediaId')
  @Roles('admin', 'super admin')
  @ApiOperation({ summary: 'Delete media by ID' })
  deleteMedia(@Param('mediaId', ParseUUIDPipe) mediaId: string) {
    return this.imagesService.deleteMedia(mediaId);
  }

  @Delete('thumbnail/:mediaId')
  @Roles('admin', 'super admin')
  @ApiOperation({ summary: 'Delete thumbnail' })
  deleteThumbnail(@Param('mediaId', ParseUUIDPipe) mediaId: string) {
    return this.imagesService.deleteMedia(mediaId);
  }

  @Delete('images/:mediaId')
  @Roles('admin', 'super admin')
  @ApiOperation({ summary: 'Delete product image' })
  deleteProductMedia(@Param('mediaId', ParseUUIDPipe) mediaId: string) {
    return this.imagesService.deleteMedia(mediaId);
  }

  @Get('gallery')
  @Roles('admin', 'super admin')
  @ApiOperation({ summary: 'Get media gallery with filters' })
  getGallery(@Query() query: GalleryQueryDto) {
    return this.imagesService.getGallery(query);
  }

  @Get('counts')
  @Roles('admin', 'super admin')
  @ApiOperation({ summary: 'Get image counts by type and folder' })
  getCounts() {
    return this.imagesService.getCounts();
  }

  @Post('bulk-delete')
  @Roles('admin', 'super admin')
  @ApiOperation({ summary: 'Bulk delete media' })
  bulkDelete(@Body() dto: BulkDeleteDto) {
    return this.imagesService.bulkDelete(dto.ids);
  }
}
