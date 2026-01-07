import { Module } from '@nestjs/common';
import { AiService } from './ai.service';

/**
 * Module providing AI-powered text generation capabilities.
 * Uses Vercel AI SDK with Google Gemini for generating
 * conversational responses suitable for voice interactions.
 */
@Module({
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
