import { SaynaClient, type TokenResponse } from "@sayna-ai/js-sdk";
import type { ConnectionConfig } from "./types";

/**
 * Error thrown when token fetch fails
 */
export class TokenFetchError extends Error {
  statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = "TokenFetchError";
    this.statusCode = statusCode;
  }
}

/**
 * Creates a token fetch handler that calls the API_ENDPOINT
 * to get LiveKit credentials.
 *
 * The API returns `livekit_url` per the Sayna API spec, which we
 * normalize to `liveUrl` to match the JS SDK's TokenResponse interface.
 */
function createTokenFetchHandler(
  config: ConnectionConfig
): () => Promise<TokenResponse> {
  return async () => {
    const apiEndpoint = import.meta.env.API_ENDPOINT;

    if (!apiEndpoint) {
      throw new TokenFetchError(
        "API_ENDPOINT environment variable is not configured"
      );
    }

    const response = await fetch(apiEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        room_name: config.roomName,
        participant_name: config.participantName || config.roomName,
        participant_identity:
          config.participantIdentity || `user-${Date.now()}`,
      }),
    });

    if (!response.ok) {
      let errorMessage: string;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || `Request failed: ${response.status}`;
      } catch {
        errorMessage = `Request failed: ${response.status} ${response.statusText}`;
      }
      throw new TokenFetchError(errorMessage, response.status);
    }

    const data = await response.json();

    // Normalize API response to match TokenResponse interface
    // API returns `livekit_url`, SDK expects `liveUrl`
    const tokenResponse: TokenResponse = {
      token: data.token,
      liveUrl: data.livekit_url || data.liveUrl,
    };

    if (!tokenResponse.token || typeof tokenResponse.token !== "string") {
      throw new TokenFetchError("Invalid token response: missing token");
    }

    if (!tokenResponse.liveUrl || typeof tokenResponse.liveUrl !== "string") {
      throw new TokenFetchError("Invalid token response: missing liveUrl");
    }

    return tokenResponse;
  };
}

export interface CreateSaynaClientOptions {
  config: ConnectionConfig;
  audioElement?: HTMLAudioElement | null;
}

/**
 * Creates a new SaynaClient instance configured for the given room and participant.
 *
 * @param options - Configuration options including room/participant info and optional audio element
 * @returns A configured SaynaClient instance
 */
export function createSaynaClient(
  options: CreateSaynaClientOptions
): SaynaClient {
  const { config, audioElement } = options;

  return new SaynaClient({
    tokenFetchHandler: createTokenFetchHandler(config),
    audioElement: audioElement ?? undefined,
    enableAudioPlayback: true,
  });
}

/**
 * Attempts to play audio on an HTMLAudioElement.
 * Returns true if playback started, false if blocked.
 */
export async function tryPlayAudio(
  audioElement: HTMLAudioElement | null
): Promise<boolean> {
  if (!audioElement) return false;
  if (!audioElement.srcObject && !audioElement.src) {
    return true;
  }

  try {
    await audioElement.play();
    return true;
  } catch (error) {
    // NotAllowedError indicates autoplay was blocked
    if (
      error instanceof Error &&
      (error.name === "NotAllowedError" || error.name === "NotSupportedError")
    ) {
      return false;
    }
    throw error;
  }
}
