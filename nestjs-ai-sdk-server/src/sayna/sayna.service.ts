import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SaynaClient,
  type LiveKitTokenResponse,
  type STTConfig,
  type TTSConfig,
  type LiveKitConfig,
} from '@sayna-ai/node-sdk';
import { AiService } from '../ai/ai.service';
import { StartSessionDto } from './dto/start-session.dto';
import { VoiceAgent } from './voice-agent';

/**
 * Service for Sayna voice API integration.
 * Handles LiveKit token generation and voice agent creation.
 */
@Injectable()
export class SaynaService {
  private readonly logger = new Logger(SaynaService.name);
  private readonly saynaUrl: string;
  private readonly saynaApiKey: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly aiService: AiService,
  ) {
    this.saynaUrl = this.configService.get<string>('SAYNA_URL') ?? '';
    this.saynaApiKey = this.configService.get<string>('SAYNA_API_KEY') ?? '';
  }

  /**
   * Starts a voice session: gets LiveKit token and starts voice agent in background.
   *
   * @param dto - Session configuration
   * @returns LiveKit token response
   */
  async start(dto: StartSessionDto): Promise<LiveKitTokenResponse> {
    const { roomName, participantName, participantIdentity } = dto;

    this.logger.log(`Starting session for room: ${roomName}`);

    // Create a single SaynaClient with full configuration
    const client = this.createClient(roomName);

    // Get LiveKit token using the same client
    const tokenResponse = await client.getLiveKitToken(
      roomName,
      participantName,
      participantIdentity,
    );

    this.logger.debug(`Token obtained for room: ${roomName}`);

    // Start voice agent in background (fire and forget)
    this.startVoiceAgentInBackground(client, roomName);

    return tokenResponse;
  }

  /**
   * Creates a SaynaClient with full STT/TTS/LiveKit configuration.
   */
  private createClient(roomName: string): SaynaClient {
    const sttConfig: STTConfig = {
      provider: 'deepgram',
      language: 'en-US',
      sample_rate: 16000,
      channels: 1,
      punctuation: true,
      encoding: 'linear16',
      model: 'nova-3',
    };

    const ttsConfig: TTSConfig = {
      provider: 'elevenlabs',
      model: 'eleven_turbo_v2_5',
      voice_id: 'ZIlrSGI4jZqobxRKprJz',
      speaking_rate: 1.0,
      audio_format: 'linear16',
      sample_rate: 16000,
    };

    const livekitConfig: LiveKitConfig = {
      room_name: roomName,
      sayna_participant_identity: 'ai-agent',
      sayna_participant_name: 'AI Assistant',
      listen_participants: [],
    };

    this.logger.log(
      `Creating SaynaClient for room: ${roomName} with LiveKit config`,
    );

    return new SaynaClient(
      this.saynaUrl,
      sttConfig,
      ttsConfig,
      livekitConfig,
      false, // withoutAudio = false (enable audio)
      this.saynaApiKey,
    );
  }

  /**
   * Starts a VoiceAgent in the background.
   * Errors are logged but don't affect the token response.
   */
  private startVoiceAgentInBackground(
    client: SaynaClient,
    roomName: string,
  ): void {
    const agent = new VoiceAgent(client, this.aiService, roomName);

    agent.start().catch((error: unknown) => {
      this.logger.error(
        `Voice agent failed for room ${roomName}: ${error instanceof Error ? error.message : String(error)}`,
      );
    });
  }

  /**
   * Health check for Sayna API.
   */
  async checkHealth(): Promise<boolean> {
    try {
      // Create a minimal client just for health check
      const client = new SaynaClient(
        this.saynaUrl,
        undefined,
        undefined,
        undefined,
        true, // withoutAudio for REST-only
        this.saynaApiKey,
      );
      await client.health();
      return true;
    } catch {
      return false;
    }
  }
}
