import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  HttpException,
  HttpStatus,
  Headers,
  Logger,
} from '@nestjs/common';
import { AdsService } from './ads.service';
import { CreateAdDto } from './dto/create-ad.dto';
import {
  CreateAdResponseDto,
  AdStatusResponseDto,
  AdResultDto,
} from './dto/ad-response.dto';

@Controller('v1/ads')
export class AdsController {
  private readonly logger = new Logger(AdsController.name);

  constructor(private readonly adsService: AdsService) {}

  /**
   * Create a new ad generation job
   * POST /v1/ads
   */
  @Post()
  async createAd(
    @Body() createAdDto: CreateAdDto,
    @Headers('authorization') authHeader: string,
  ): Promise<CreateAdResponseDto> {
    // Extract user ID from Firebase Auth token
    // In production, this would verify the Firebase JWT
    let userId = 'anonymous';
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      // TODO: Verify Firebase JWT and extract user ID
      // For now, we'll use a placeholder
      const token = authHeader.substring(7);
      if (token && token !== 'demo') {
        // In production: verify token with Firebase Admin
        // const decodedToken = await getAuth().verifyIdToken(token);
        // userId = decodedToken.uid;
        userId = token; // Temporary for development
      }
    }

    createAdDto.user_id = userId;

    try {
      return await this.adsService.createAd(createAdDto);
    } catch (error) {
      this.logger.error('Failed to create ad', error);
      throw new HttpException(
        'Failed to create ad job',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get ad status by ID
   * GET /v1/ads/:id
   */
  @Get(':id')
  async getAdStatus(@Param('id') id: string): Promise<AdStatusResponseDto> {
    const result = await this.adsService.getAdStatus(id);

    if (!result) {
      throw new HttpException('Ad not found', HttpStatus.NOT_FOUND);
    }

    return result;
  }

  /**
   * Get ad result (only available when completed)
   * GET /v1/ads/:id/result
   */
  @Get(':id/result')
  async getAdResult(@Param('id') id: string): Promise<AdResultDto> {
    const result = await this.adsService.getAdResult(id);

    if (!result) {
      throw new HttpException(
        'Ad result not found or not yet completed',
        HttpStatus.NOT_FOUND,
      );
    }

    return result;
  }

  /**
   * Regenerate a specific scene
   * POST /v1/ads/:id/scenes/:scene_id/regenerate
   */
  @Post(':id/scenes/:sceneId/regenerate')
  async regenerateScene(
    @Param('id') id: string,
    @Param('sceneId') sceneId: string,
  ): Promise<{ success: boolean }> {
    const result = await this.adsService.regenerateScene(id, parseInt(sceneId, 10));

    if (!result.success) {
      throw new HttpException('Ad not found', HttpStatus.NOT_FOUND);
    }

    return result;
  }

  /**
   * Health check endpoint
   */
  @Get('health')
  health(): { status: string } {
    return { status: 'ok' };
  }
}
