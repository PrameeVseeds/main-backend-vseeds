import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, Media } from '@prisma/client';
import { GalleryQueryDto } from './dto/gallery-query.dto';
import {
  validateImageUpload,
  FILE_UPLOAD_LIMITS,
} from '../../common/utils/file-upload-validation';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ImagesService {
  private readonly logger = new Logger(ImagesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  private get uploadDir(): string {
    const dir = this.configService.get<string>('UPLOAD_DIR');
    if (dir) {
      // Resolve relative paths from the project root; keep absolute paths as-is
      if (dir.startsWith('./') || dir.startsWith('../')) {
        return path.resolve(dir);
      }
      return dir;
    }
    // Fallback — log a warning so devs know they should configure UPLOAD_DIR
    const fallback = path.resolve(
      __dirname,
      '../../../../public_html/upload_vseeds/images',
    );
    this.logger.warn(
      `UPLOAD_DIR not set. Falling back to: ${fallback}. Set UPLOAD_DIR in your .env file.`,
    );
    return fallback;
  }

  public get baseUrl(): string {
    return this.configService.get<string>('CDN_URL') || 'https://cdn.vseeds.lk';
  }

  // ─── Public: Get thumbnail for product ──────────────────────────

  async getThumbnail(productId: string) {
    const pm = await this.prisma.productMedia.findFirst({
      where: { productId, isThumbnail: true },
      include: { media: true },
    });
    return pm?.media || null;
  }

  // ─── Public: Get product images ─────────────────────────────────

  async getProductImages(productId: string) {
    const items = await this.prisma.productMedia.findMany({
      where: { productId, isThumbnail: false },
      include: { media: true },
      orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
    });
    return items.map((pm) => pm.media);
  }

  // ─── Admin: Add thumbnail ──────────────────────────────────────
  async addThumbnail(
    productId: string,
    file: Express.Multer.File,
    customName?: string,
    folder = 'products',
  ) {
    const media = await this.saveMedia(file, customName, folder);

    await this.prisma.productMedia.create({
      data: {
        productId,
        mediaId: media.id,
        isThumbnail: true,
      },
    });

    return media;
  }

  // ─── Admin: Update thumbnail ───────────────────────────────────
  async updateThumbnail(
    productId: string,
    file: Express.Multer.File,
    customName?: string,
    folder = 'products',
  ) {
    const existing = await this.prisma.productMedia.findFirst({
      where: { productId, isThumbnail: true },
      include: { media: true },
    });

    if (existing) {
      const validation = validateImageUpload(file.buffer, file.mimetype, {
        maxSize: FILE_UPLOAD_LIMITS.image,
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
      // Delete from server storage using the filename
      if (existing.media.filename) {
        const filepath = path.join(this.uploadDir, existing.media.filename);
        if (fs.existsSync(filepath)) {
          fs.unlinkSync(filepath);
        }
      }

      const folderName = folder ? `vseeds-${folder}` : 'vseeds-general';
      const cloudResponse = await this.uploadToCloud(file, folderName);

      await this.prisma.media.update({
        where: { id: existing.mediaId },
        data: {
          filename: cloudResponse.filename,
          url: cloudResponse.url,
          originalName: file.originalname,
          mimeType: file.mimetype,
          fileSize: file.size,
        },
      });
      return this.prisma.media.findUnique({ where: { id: existing.mediaId } });
    }

    return this.addThumbnail(productId, file, customName, folder);
  }

  // ─── Admin: Add other images ───────────────────────────────────

  async addImages(
    productId: string,
    files: Express.Multer.File[],
    customName?: string,
    folder = 'products',
    startOrder = 0,
  ): Promise<Media[]> {
    const results: Media[] = [];

    for (let i = 0; i < files.length; i++) {
      const media = await this.saveMedia(files[i], customName, folder);
      await this.prisma.productMedia.create({
        data: {
          productId,
          mediaId: media.id,
          isThumbnail: false,
          displayOrder: startOrder + i,
        },
      });
      results.push(media);
    }

    return results;
  }

  // ─── Admin: Delete media ────────────────────────────────────────

  async deleteMedia(mediaId: string) {
    const media = await this.prisma.media.findUnique({
      where: { id: mediaId },
    });
    if (!media) throw new NotFoundException('Media not found');

    await this.prisma.productMedia.deleteMany({ where: { mediaId } });
    await this.prisma.media.delete({ where: { id: mediaId } });

    // Delete from server storage using the filename
    if (media.filename) {
      const filepath = path.join(this.uploadDir, media.filename);
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
    }

    return { message: 'Media deleted' };
  }

  // ─── Admin: Bulk delete ────────────────────────────────────────

  async bulkDelete(ids: string[]) {
    const items = await this.prisma.media.findMany({
      where: { id: { in: ids } },
    });

    await this.prisma.productMedia.deleteMany({
      where: {
        mediaId: { in: ids },
      },
    });

    await this.prisma.media.deleteMany({
      where: {
        id: { in: ids },
      },
    });

    for (const item of items) {
      // Delete from server storage using the filename
      if (item.filename) {
        const filepath = path.join(this.uploadDir, item.filename);
        if (fs.existsSync(filepath)) {
          fs.unlinkSync(filepath);
        }
      }
    }

    return { message: `${items.length} media items deleted` };
  }

  // ─── Admin: Generic upload (no product association) ────────────
  async uploadGeneric(
    file: Express.Multer.File,
    customName?: string,
    folder = 'general',
  ) {
    return this.saveMedia(file, customName, folder);
  }

  // ─── Admin: Gallery ────────────────────────────────────────────

  async getGallery(query: GalleryQueryDto) {
    const { page = 1, limit = 20, filter, categoryId } = query;

    const where: Prisma.MediaWhereInput = {};

    if (filter === 'used') {
      where.productMedia = { some: {} };
    } else if (filter === 'orphaned') {
      where.productMedia = { none: {} };
    } else if (filter === 'thumbnail') {
      where.productMedia = { some: { isThumbnail: true } };
    }

    if (categoryId) {
      if (filter === 'thumbnail') {
        where.productMedia = {
          some: {
            isThumbnail: true,
            product: {
              categoryId,
            },
          },
        };
      } else {
        where.productMedia = {
          some: {
            product: {
              categoryId,
            },
          },
        };
      }
    }

    const [mediaItems, total] = await Promise.all([
      this.prisma.media.findMany({
        where,
        include: {
          productMedia: {
            include: {
              product: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.media.count({ where }),
    ]);

    const images = mediaItems.map((m) => {
      const pm = m.productMedia[0];
      return {
        id: m.id,
        filename: m.filename,
        originalName: m.originalName,
        url: m.url,
        mimeType: m.mimeType,
        fileSize: m.fileSize,
        altText: m.altText,
        createdAt: m.createdAt,
        productId: pm?.productId ?? null,
        isThumbnail: pm?.isThumbnail ?? null,
        displayOrder: pm?.displayOrder ?? null,
      };
    });

    return { images, total, totalPages: Math.ceil(total / limit), page };
  }

  // ─── Admin: Get Counts ────────────────────────────────────────────
  async getCounts() {
    const allMedia = await this.prisma.media.findMany({
      select: {
        filename: true,
        mimeType: true,
      },
    });

    const typeCounts: Record<string, number> = {
      PNG: 0,
      JPG: 0,
      WEBP: 0,
    };

    const folderCounts: Record<string, number> = {
      Products: 0,
      Banners: 0,
      Blog: 0,
      Categories: 0,
      General: 0,
    };

    allMedia.forEach((media) => {
      // Count by type
      const type = media.mimeType ? media.mimeType.split('/')[1].toUpperCase() : 'IMG';
      if (typeCounts[type] !== undefined) {
        typeCounts[type]++;
      }

      // Count by folder based on filename pattern
      let folder = 'General';
      if (media.filename.includes('vseeds-')) {
        const parts = media.filename.split('-');
        if (parts.length >= 2) {
          folder = parts[1].charAt(0).toUpperCase() + parts[1].slice(1);
        }
      } else if (media.filename.includes('thumbnail_') || media.filename.includes('images_')) {
        folder = 'Products';
      }

      if (folderCounts[folder] !== undefined) {
        folderCounts[folder]++;
      }
    });

    return {
      typeCounts,
      folderCounts,
      total: allMedia.length,
    };
  }

  // ─── File helpers ──────────────────────────────────────────────
  private writeToDisk(filename: string, buffer: Buffer) {
    const dir = this.uploadDir;
    const fullPath = path.join(dir, filename);
    const targetDir = path.dirname(fullPath);

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    fs.writeFileSync(fullPath, buffer);
  }

  private async saveMedia(
    file: Express.Multer.File,
    _customName?: string,
    folder?: string,
  ) {
    const validation = validateImageUpload(file.buffer, file.mimetype, {
      maxSize: FILE_UPLOAD_LIMITS.image,
    });
    if (!validation.valid) {
      throw new BadRequestException(validation.error);
    }
    if (validation.detectedMime && file.mimetype !== validation.detectedMime) {
      file.mimetype = validation.detectedMime;
    }

    const folderName = folder ? `vseeds-${folder}` : 'vseeds-general';
    const cloudResponse = await this.uploadToCloud(file, folderName);

    return this.prisma.media.create({
      data: {
        filename: cloudResponse.filename,
        url: cloudResponse.url,
        originalName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
      },
    });
  }

  private async uploadToCloud(
    file: Express.Multer.File,
    folderName: string,
  ): Promise<{ filename: string; url: string }> {
    // Always use server storage
    const crypto = require('crypto');
    const extension = path.extname(file.originalname);
    const filename = `${folderName}-${crypto.randomUUID()}${extension}`;
    
    this.writeToDisk(filename, file.buffer);
    
    const url = `${this.baseUrl}/${filename}`;
    
    return {
      filename: filename, // Store the local filename
      url: url,
    };
  }

  deleteFileFromDisk(url: string) {
    try {
      // Split by baseUrl to get the relative path
      const relativePath = url.replace(`${this.baseUrl}/`, '');
      if (relativePath && relativePath !== url) {
        const filepath = path.join(this.uploadDir, relativePath);
        if (fs.existsSync(filepath)) {
          fs.unlinkSync(filepath);
        }
      }
    } catch {
      // File may not exist on disk
    }
  }
}
