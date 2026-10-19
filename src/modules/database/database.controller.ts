import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import type { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { DatabaseService, DumpType } from './database.service';
import { Roles } from '../../common/decorators/roles.decorator';

const DUMPS_DIR = path.resolve(process.cwd(), 'db-dumps');
const DUMP_NAMES: Record<DumpType, string> = {
  latest: 'latest_db.sql',
  old: 'old_db.sql',
};

function assertType(type: string): asserts type is DumpType {
  if (type !== 'latest' && type !== 'old') {
    throw new BadRequestException(
      `Invalid dump type "${type}". Use "latest" or "old".`,
    );
  }
}

@ApiTags('Database')
@Controller('database')
@Roles('admin', 'super admin')
export class DatabaseController {
  constructor(private readonly databaseService: DatabaseService) {}

  @Get('dumps')
  @ApiOperation({ summary: 'List uploaded SQL dumps (latest + old)' })
  getDumps() {
    return this.databaseService.getDumps();
  }

  @Get('backup')
  @ApiOperation({ summary: 'Generate and download a full SQL backup of the live database' })
  async backup(@Res({ passthrough: true }) res: Response) {
    const { filePath, fileName } = await this.databaseService.createBackup();
    res.set({
      'Content-Type': 'application/sql',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    });
    return new StreamableFile(fs.createReadStream(filePath));
  }

  @Get('import-status')
  @ApiOperation({ summary: 'Get import status for both dump types' })
  getImportStatus() {
    return this.databaseService.getImportStatus();
  }

  @Get('import-status/:type')
  @ApiOperation({ summary: 'Get import status for a dump type' })
  getImportStatusFor(@Param('type') type: string) {
    assertType(type);
    return this.databaseService.getImportStatus(type);
  }

  @Post('upload/:type')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a SQL dump ("latest" full restore or "old" legacy dump)' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          fs.mkdirSync(DUMPS_DIR, { recursive: true });
          cb(null, DUMPS_DIR);
        },
        filename: (req, _file, cb) => {
          const type = req.params.type as DumpType;
          cb(null, DUMP_NAMES[type] ?? `dump_${Date.now()}.sql`);
        },
      }),
      limits: { fileSize: 1024 * 1024 * 1024 }, // 1 GB
      fileFilter: (req, file, cb) => {
        const type = req.params.type;
        if (type !== 'latest' && type !== 'old') {
          return cb(
            new BadRequestException(
              `Invalid dump type "${type}". Use "latest" or "old".`,
            ) as any,
            false,
          );
        }
        if (!/\.sql$/i.test(file.originalname)) {
          return cb(
            new BadRequestException('Only .sql files are accepted') as any,
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  uploadDump(
    @Param('type') type: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    assertType(type);
    if (!file) throw new BadRequestException('No file uploaded');
    return this.databaseService.registerUpload(type, file);
  }

  @Post('import/:type')
  @ApiOperation({
    summary:
      'Run import: "latest" executes the dump on the live DB, "old" runs the legacy migration script. Pass ?clear=true to wipe existing data first (admin/RBAC and system config tables are preserved).',
  })
  importDump(@Param('type') type: string, @Query('clear') clear?: string) {
    assertType(type);
    return this.databaseService.importDump(type, clear === 'true');
  }
}
