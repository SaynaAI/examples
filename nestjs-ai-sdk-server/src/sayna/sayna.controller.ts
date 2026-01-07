import { Body, Controller, Get, Logger, Post } from '@nestjs/common';
import { SaynaService } from './sayna.service';
import { StartSessionDto } from './dto/start-session.dto';
import type { TokenResponseDto } from './dto/token-response.dto';

/**
 * Controller for Sayna voice session endpoints.
 */
@Controller()
export class SaynaController {
  private readonly logger = new Logger(SaynaController.name);

  constructor(private readonly saynaService: SaynaService) {}

  /**
   * Starts a voice session.
   * Returns LiveKit token immediately while voice agent starts in background.
   *
   * @param dto - Room and participant configuration
   * @returns LiveKit token and connection details
   */
  @Post('start')
  async start(@Body() dto: StartSessionDto): Promise<TokenResponseDto> {
    this.logger.log(`POST /start - room: ${dto.roomName}`);
    return this.saynaService.start(dto);
  }

  /**
   * Health check endpoint.
   */
  @Get('health')
  async health(): Promise<{ status: string; sayna: boolean }> {
    const saynaHealthy = await this.saynaService.checkHealth();
    return {
      status: saynaHealthy ? 'ok' : 'degraded',
      sayna: saynaHealthy,
    };
  }
}
