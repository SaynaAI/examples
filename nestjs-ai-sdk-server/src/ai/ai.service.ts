import { Injectable, Logger } from '@nestjs/common';
import { generateText, streamText } from 'ai';
import { google } from '@ai-sdk/google';
import {
  VOICE_ASSISTANT_PROMPT,
  getRandomFallbackResponse,
} from './prompts/voice-assistant.prompt';

/**
 * Callback for receiving streamed sentences.
 */
export type SentenceCallback = (sentence: string) => void | Promise<void>;

/**
 * A message in the conversation history.
 */
export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

/**
 * Session history for a room.
 */
interface SessionHistory {
  messages: ConversationMessage[];
  createdAt: Date;
  lastUpdated: Date;
}

/**
 * Options for generating a response.
 */
export interface GenerateOptions {
  transcript: string;
  roomName?: string;
  maxTokens?: number;
}

/**
 * Result from AI generation.
 */
export interface GenerateResult {
  text: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

/**
 * Custom error for AI generation failures.
 */
export class AiGenerationError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
    public readonly isRetryable = false,
  ) {
    super(message);
    this.name = 'AiGenerationError';
  }
}

/**
 * Service for AI-powered text generation using Vercel AI SDK with Google Gemini.
 * Provides conversational responses suitable for voice interactions.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly model;
  private readonly history = new Map<string, SessionHistory>();

  /** Maximum messages to keep in history per room */
  private readonly maxHistoryMessages = 20;

  /** Default max tokens for response generation */
  private readonly defaultMaxTokens = 500;

  constructor() {
    // Initialize the Google Gemini model
    // The provider automatically reads GOOGLE_GENERATIVE_AI_API_KEY from environment
    this.model = google('gemini-2.5-flash');
    this.logger.log(
      'AI Service initialized with Google Gemini (gemini-2.5-flash)',
    );
  }

  /**
   * Generates a response for the given transcript.
   * Uses conversation history if a roomName is provided.
   *
   * @param options - Generation options including transcript and optional room context
   * @returns Generated response result
   */
  async generateResponse(options: GenerateOptions): Promise<GenerateResult> {
    const { transcript, roomName, maxTokens = this.defaultMaxTokens } = options;

    if (!transcript.trim()) {
      this.logger.warn('Empty transcript received, returning fallback');
      return { text: getRandomFallbackResponse() };
    }

    try {
      // Build messages array including history if available
      const messages = this.buildMessages(roomName, transcript);

      this.logger.debug(
        `Generating response for transcript: "${transcript.substring(0, 50)}..."`,
      );

      const result = await generateText({
        model: this.model,
        messages,
        maxOutputTokens: maxTokens,
        temperature: 0.7,
      });

      // Save to history if room context is provided
      if (roomName) {
        this.addToHistory(roomName, 'user', transcript);
        this.addToHistory(roomName, 'assistant', result.text);
      }

      this.logger.debug(
        `Generated response: "${result.text.substring(0, 50)}..."`,
      );

      // Extract usage if available
      const usage = result.usage
        ? {
            inputTokens: result.usage.inputTokens ?? 0,
            outputTokens: result.usage.outputTokens ?? 0,
          }
        : undefined;

      return {
        text: result.text,
        usage,
      };
    } catch (error) {
      this.logger.error(
        `AI generation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new AiGenerationError(
        'Failed to generate response',
        error,
        this.isRetryableError(error),
      );
    }
  }

  /**
   * Generates a response with retry logic.
   * Returns a fallback response if all retries fail.
   *
   * @param options - Generation options
   * @param maxRetries - Maximum number of retry attempts (default: 2)
   * @returns Generated response text
   */
  async generateResponseWithRetry(
    options: GenerateOptions,
    maxRetries = 2,
  ): Promise<string> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.generateResponse(options);
        return result.text;
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(`AI generation attempt ${attempt + 1} failed`);

        // Don't retry if it's a rate limit error
        if (error instanceof AiGenerationError && !error.isRetryable) {
          break;
        }

        // Wait before retry with exponential backoff
        if (attempt < maxRetries) {
          await this.delay(1000 * (attempt + 1));
        }
      }
    }

    // All retries failed - return fallback
    this.logger.error('AI generation failed after retries', lastError);
    return getRandomFallbackResponse();
  }

  /**
   * Generates a streaming response, calling the callback for each complete sentence.
   * This enables sentence-by-sentence TTS for lower latency voice responses.
   *
   * @param options - Generation options including transcript and room context
   * @param onSentence - Callback invoked for each complete sentence
   * @returns The full response text after streaming completes
   */
  async generateStreamingResponse(
    options: GenerateOptions,
    onSentence: SentenceCallback,
  ): Promise<string> {
    const { transcript, roomName } = options;

    if (!transcript.trim()) {
      this.logger.warn('Empty transcript received, returning fallback');
      const fallback = getRandomFallbackResponse();
      await onSentence(fallback);
      return fallback;
    }

    try {
      const messages = this.buildMessages(roomName, transcript);

      this.logger.debug(
        `Starting streaming response for: "${transcript.substring(0, 50)}..."`,
      );

      const result = streamText({
        model: this.model,
        messages,
        temperature: 0.7,
        // Note: maxTokens is handled by the model provider defaults
        // Google Gemini has generous default limits
      });

      let fullResponse = '';
      let sentenceBuffer = '';
      let chunkCount = 0;

      // Process the stream
      for await (const chunk of result.textStream) {
        chunkCount++;
        fullResponse += chunk;
        sentenceBuffer += chunk;

        // Extract and emit complete sentences
        const sentences = this.extractCompleteSentences(sentenceBuffer);
        if (sentences.extracted.length > 0) {
          for (const sentence of sentences.extracted) {
            this.logger.debug(`Streaming sentence: "${sentence}"`);
            await onSentence(sentence);
          }
          sentenceBuffer = sentences.remaining;
        }
      }

      // Log stream completion details
      const finishReason = await result.finishReason;
      const usage = await result.usage;
      this.logger.debug(
        `Stream ended: chunks=${chunkCount}, finishReason=${finishReason}, ` +
          `tokens=${usage?.totalTokens ?? 'unknown'}`,
      );

      // Emit any remaining text as final sentence
      const remaining = sentenceBuffer.trim();
      if (remaining) {
        this.logger.debug(`Final chunk: "${remaining}"`);
        await onSentence(remaining);
      }

      // Check if response seems truncated
      if (fullResponse.length < 20 && finishReason !== 'stop') {
        this.logger.warn(
          `Suspicious short response (${fullResponse.length} chars), ` +
            `finishReason: ${finishReason}`,
        );
      }

      // Save to history after complete response
      if (roomName) {
        this.addToHistory(roomName, 'user', transcript);
        this.addToHistory(roomName, 'assistant', fullResponse);
      }

      this.logger.debug(
        `Streaming complete. Full response: "${fullResponse.substring(0, 50)}..."`,
      );

      return fullResponse;
    } catch (error) {
      this.logger.error(
        `Streaming AI generation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new AiGenerationError(
        'Failed to generate streaming response',
        error,
        this.isRetryableError(error),
      );
    }
  }

  /**
   * Generates a streaming response with retry logic.
   * Falls back to a simple response on failure.
   *
   * @param options - Generation options
   * @param onSentence - Callback for each sentence
   * @param maxRetries - Maximum retry attempts
   * @returns The full response text
   */
  async generateStreamingResponseWithRetry(
    options: GenerateOptions,
    onSentence: SentenceCallback,
    maxRetries = 2,
  ): Promise<string> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.generateStreamingResponse(options, onSentence);
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(`Streaming AI attempt ${attempt + 1} failed`);

        if (error instanceof AiGenerationError && !error.isRetryable) {
          break;
        }

        if (attempt < maxRetries) {
          await this.delay(1000 * (attempt + 1));
        }
      }
    }

    // All retries failed - return fallback
    this.logger.error(
      'Streaming AI generation failed after retries',
      lastError,
    );
    const fallback = getRandomFallbackResponse();
    await onSentence(fallback);
    return fallback;
  }

  /**
   * Extracts complete sentences from a text buffer.
   * A sentence ends with . ! or ? followed by a space or end of string.
   *
   * @param buffer - Text buffer to extract sentences from
   * @returns Object with extracted sentences and remaining text
   */
  private extractCompleteSentences(buffer: string): {
    extracted: string[];
    remaining: string;
  } {
    const sentences: string[] = [];

    // Regex to match sentence endings: . ! ? followed by space or end
    // Also handles common abbreviations by requiring the punctuation
    // to be followed by a space and capital letter, or end of string
    const sentenceEndRegex = /([.!?])(?:\s+|$)/g;

    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = sentenceEndRegex.exec(buffer)) !== null) {
      const endPos = match.index + match[0].length;
      const sentence = buffer.slice(lastIndex, endPos).trim();

      if (sentence) {
        sentences.push(sentence);
      }
      lastIndex = endPos;
    }

    return {
      extracted: sentences,
      remaining: buffer.slice(lastIndex),
    };
  }

  /**
   * Clears conversation history for a room.
   *
   * @param roomName - The room to clear history for
   */
  clearHistory(roomName: string): void {
    this.history.delete(roomName);
    this.logger.debug(`Cleared history for room: ${roomName}`);
  }

  /**
   * Gets the conversation history for a room.
   *
   * @param roomName - The room to get history for
   * @returns Array of conversation messages
   */
  getHistory(roomName: string): ConversationMessage[] {
    return this.history.get(roomName)?.messages ?? [];
  }

  /**
   * Builds the messages array for the AI request.
   */
  private buildMessages(
    roomName: string | undefined,
    transcript: string,
  ): { role: 'system' | 'user' | 'assistant'; content: string }[] {
    const messages: {
      role: 'system' | 'user' | 'assistant';
      content: string;
    }[] = [{ role: 'system', content: VOICE_ASSISTANT_PROMPT }];

    // Add conversation history if available
    if (roomName) {
      const session = this.history.get(roomName);
      if (session) {
        for (const msg of session.messages) {
          messages.push({ role: msg.role, content: msg.content });
        }
      }
    }

    // Add current user message
    messages.push({ role: 'user', content: transcript });

    return messages;
  }

  /**
   * Adds a message to the conversation history for a room.
   */
  private addToHistory(
    roomName: string,
    role: 'user' | 'assistant',
    content: string,
  ): void {
    let session = this.history.get(roomName);
    if (!session) {
      session = {
        messages: [],
        createdAt: new Date(),
        lastUpdated: new Date(),
      };
      this.history.set(roomName, session);
    }

    session.messages.push({
      role,
      content,
      timestamp: Date.now(),
    });
    session.lastUpdated = new Date();

    // Prune old messages if history is too long
    if (session.messages.length > this.maxHistoryMessages) {
      session.messages = session.messages.slice(-this.maxHistoryMessages / 2);
    }
  }

  /**
   * Determines if an error is retryable.
   */
  private isRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
      // Rate limit errors are not retryable immediately
      if (error.message.includes('rate limit')) {
        return false;
      }
      // Network errors may be retryable
      if (
        error.message.includes('ECONNREFUSED') ||
        error.message.includes('timeout')
      ) {
        return true;
      }
    }
    return true;
  }

  /**
   * Helper to delay execution.
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
