import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { SaynaController } from './sayna.controller';
import { SaynaService } from './sayna.service';

/**
 * Module encapsulating Sayna voice SDK interactions.
 * Provides LiveKit token generation and voice session management.
 */
@Module({
  imports: [AiModule],
  controllers: [SaynaController],
  providers: [SaynaService],
  exports: [SaynaService],
})
export class SaynaModule {}
