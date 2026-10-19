import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { StatisticsService } from './statistics.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { TrendsQueryDto } from './dto/trends-query.dto';

@ApiTags('Statistics')
@Controller('statistics')
@Roles('admin', 'super admin')
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @Get('basic')
  @ApiOperation({ summary: 'Basic statistics summary' })
  getBasicStats() {
    return this.statisticsService.getBasicStats();
  }

  @Get('detailed')
  @ApiOperation({ summary: 'Detailed dashboard statistics' })
  getDetailedStats() {
    return this.statisticsService.getDetailedStats();
  }

  @Get('categories')
  @ApiOperation({ summary: 'Category statistics' })
  getCategoryStats() {
    return this.statisticsService.getCategoryStats();
  }

  @Get('products-by-category')
  @ApiOperation({ summary: 'Products grouped by category' })
  getProductsByCategory() {
    return this.statisticsService.getProductsByCategory();
  }

  @Get('inventory')
  @ApiOperation({ summary: 'Inventory insights and alerts' })
  getInventoryInsights() {
    return this.statisticsService.getInventoryInsights();
  }

  @Get('trends')
  @ApiOperation({ summary: 'Time-based statistics trends' })
  getTrends(@Query() query: TrendsQueryDto) {
    return this.statisticsService.getTrends(query.period);
  }

  @Get('price-ranges')
  @ApiOperation({ summary: 'Price range distribution' })
  getPriceRanges() {
    return this.statisticsService.getPriceRanges();
  }
}
