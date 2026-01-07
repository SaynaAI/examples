/**
 * Re-export LiveKitTokenResponse from Sayna SDK as the response DTO.
 * This ensures type consistency between the SDK and NestJS endpoints.
 *
 * The response structure contains:
 * - token: JWT token for LiveKit connection
 * - room_name: Confirmed room name
 * - participant_identity: Confirmed participant identity
 * - livekit_url: LiveKit server WebSocket URL
 */
export type { LiveKitTokenResponse as TokenResponseDto } from '@sayna-ai/node-sdk';
