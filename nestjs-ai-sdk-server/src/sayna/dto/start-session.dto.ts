import { Expose } from 'class-transformer';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

/**
 * DTO for starting a voice session and obtaining a LiveKit token.
 * Accepts snake_case properties from the API (room_name, participant_name, participant_identity)
 * and transforms them to camelCase for internal use.
 */
export class StartSessionDto {
  /**
   * LiveKit room identifier.
   */
  @Expose({ name: 'room_name' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  roomName!: string;

  /**
   * Display name shown in the LiveKit room.
   */
  @Expose({ name: 'participant_name' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  participantName!: string;

  /**
   * Unique identifier for the participant.
   */
  @Expose({ name: 'participant_identity' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  participantIdentity!: string;
}
