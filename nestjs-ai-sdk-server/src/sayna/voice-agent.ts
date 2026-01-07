import { Logger } from '@nestjs/common';
import type { SaynaClient } from '@sayna-ai/node-sdk';
import type { AiService } from '../ai/ai.service';

/**
 * VoiceAgent handles a voice conversation session.
 *
 * It connects to Sayna via WebSocket, listens for speech transcriptions,
 * generates AI responses using Vercel AI SDK, and speaks them back via TTS.
 *
 * This class is self-contained and manages its own lifecycle.
 */
export class VoiceAgent {
  private readonly logger = new Logger(VoiceAgent.name);
  private isRunning = false;

  constructor(
    private readonly client: SaynaClient,
    private readonly aiService: AiService,
    private readonly roomName: string,
  ) {}

  /**
   * Starts the voice agent.
   * Registers callbacks, connects to Sayna, and sends initial greeting.
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn(`Agent already running for room: ${this.roomName}`);
      return;
    }

    this.logger.log(`Starting voice agent for room: ${this.roomName}`);

    // Register all callbacks BEFORE connecting
    this.registerCallbacks();

    // Connect to Sayna WebSocket
    try {
      this.logger.log(
        `Connecting to Sayna WebSocket... (client ready: ${this.client.ready}, connected: ${this.client.connected})`,
      );
      await this.client.connect();
      this.isRunning = true;
      this.logger.log(
        `Voice agent connected for room: ${this.roomName} (ready: ${this.client.ready})`,
      );

      // Send initial greeting as both text message and TTS
      const greeting =
        'Hello! I am your AI assistant. How can I help you today?';
      this.sendAiResponseMessage(greeting);
      this.client.speak(greeting);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to connect to Sayna: ${errorMessage}`);
      if (errorStack) {
        this.logger.error(`Stack trace: ${errorStack}`);
      }
      throw error;
    }
  }

  /**
   * Stops the voice agent and cleans up resources.
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.logger.log(`Stopping voice agent for room: ${this.roomName}`);
    this.isRunning = false;

    try {
      this.client.disconnect();
    } catch (error) {
      this.logger.error(
        `Error disconnecting: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    // Clear AI conversation history
    this.aiService.clearHistory(this.roomName);
    this.logger.log(`Voice agent stopped for room: ${this.roomName}`);
  }

  /**
   * Registers all event callbacks on the SaynaClient.
   */
  private registerCallbacks(): void {
    // Handle STT transcription results - send all transcripts as text messages
    this.client.registerOnSttResult((result) => {
      const transcript = result.transcript.trim();
      if (!transcript) {
        return;
      }

      // Determine if this is a final transcript
      const isFinal = result.is_final && result.is_speech_final;

      // Send transcript as a text message to the UI
      // The UI will merge interim messages and display final ones
      this.sendTranscriptMessage(transcript, isFinal);

      // Only process with AI when we have a final complete transcript
      if (isFinal) {
        this.logger.log(`Final transcript: "${transcript}"`);
        void this.processTranscript(transcript);
      } else {
        this.logger.debug(`Interim transcript: "${transcript}"`);
      }
    });

    // Handle errors
    this.client.registerOnError((error) => {
      this.logger.error(`Sayna error: ${error.message}`);
    });

    // Handle participant disconnection - stop the agent
    this.client.registerOnParticipantDisconnected((participant) => {
      this.logger.log(`Participant ${participant.identity} disconnected`);
      this.stop();
    });

    // Handle TTS playback completion
    this.client.registerOnTtsPlaybackComplete(() => {
      this.logger.debug('TTS playback complete');
    });
  }

  /**
   * Sends a user transcript as a text message via LiveKit data channel.
   *
   * @param transcript - The transcribed text
   * @param isFinal - Whether this is a final (complete) transcript
   */
  private sendTranscriptMessage(transcript: string, isFinal: boolean): void {
    if (!this.isRunning || !this.client.ready) {
      return;
    }

    try {
      this.client.sendMessage(transcript, 'user', 'chat', {
        is_final: isFinal,
        timestamp: Date.now(),
      });
    } catch (error) {
      this.logger.warn(
        `Failed to send transcript message: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Sends an AI response as a text message via LiveKit data channel.
   *
   * @param response - The AI-generated response text
   * @param isFinal - Whether this is the final message (default: true)
   * @param fullText - The full accumulated text so far (for streaming updates)
   */
  private sendAiResponseMessage(
    response: string,
    isFinal = true,
    fullText?: string,
  ): void {
    if (!this.isRunning || !this.client.ready) {
      return;
    }

    try {
      // For streaming, send the full accumulated text so the UI can display it properly
      const messageText = fullText ?? response;
      this.client.sendMessage(messageText, 'ai', 'chat', {
        is_final: isFinal,
        timestamp: Date.now(),
      });
    } catch (error) {
      this.logger.warn(
        `Failed to send AI response message: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Processes a transcript using streaming AI response.
   * Speaks each sentence as it arrives for lower latency.
   */
  private async processTranscript(transcript: string): Promise<void> {
    if (!this.isRunning || !this.client.ready) {
      this.logger.warn('Agent not ready, skipping transcript');
      return;
    }

    try {
      let accumulatedText = '';
      let sentenceCount = 0;

      // Use streaming response - speak each sentence as it arrives
      const fullResponse =
        await this.aiService.generateStreamingResponseWithRetry(
          {
            transcript,
            roomName: this.roomName,
          },
          (sentence: string) => {
            sentenceCount++;
            accumulatedText += (accumulatedText ? ' ' : '') + sentence;

            this.logger.debug(
              `Sentence ${sentenceCount}: "${sentence}" (accumulated: ${accumulatedText.length} chars)`,
            );

            // Send accumulated text as streaming message (is_final: false)
            this.sendAiResponseMessage(sentence, false, accumulatedText);

            // Speak this sentence immediately via TTS
            if (this.isRunning && this.client.ready) {
              this.client.speak(sentence);
            }
          },
        );

      this.logger.log(
        `AI response complete (${sentenceCount} sentences): "${fullResponse.substring(0, 50)}..."`,
      );

      // Send final message to mark streaming complete
      this.sendAiResponseMessage(fullResponse, true);
    } catch (error) {
      this.logger.error(
        `Failed to process transcript: ${error instanceof Error ? error.message : String(error)}`,
      );

      const fallbackMessage =
        "I'm sorry, I couldn't process that. Could you try again?";

      // Send fallback as a final message
      this.sendAiResponseMessage(fallbackMessage, true);

      // Speak fallback via TTS
      if (this.isRunning && this.client.ready) {
        this.client.speak(fallbackMessage);
      }
    }
  }
}
