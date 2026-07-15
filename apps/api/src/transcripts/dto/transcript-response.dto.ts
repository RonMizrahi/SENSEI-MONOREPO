import { ApiProperty } from '@nestjs/swagger';
import type { Transcript } from '../entities/transcript.entity';

/** One speaker-attributed line of a transcript (SPA session-detail shape). */
export class TranscriptSegmentDto {
  @ApiProperty({ description: 'Speaker label', example: 'מטפל/ת' })
  speaker!: string;

  @ApiProperty({ description: 'Utterance text', example: 'אז ספרי לי איך עבר עליך השבוע.' })
  text!: string;
}

/** GET /meetings/{id}/transcript response — snake_case contract shared with the SPA. */
export class TranscriptResponseDto {
  @ApiProperty({ description: 'Meeting (calendar event) id', format: 'uuid' })
  meeting_id!: string;

  @ApiProperty({ description: 'Transcript language (ISO code)', example: 'he' })
  language!: string;

  @ApiProperty({ description: 'Full transcript text', example: 'מטפל/ת: …\nמטופל/ת: …' })
  raw_text!: string;

  @ApiProperty({ description: 'Speaker-attributed lines', type: [TranscriptSegmentDto] })
  segments!: TranscriptSegmentDto[];

  /** Maps a Transcript row onto the wire shape (segments reduced to speaker + text). */
  static fromEntity(transcript: Transcript): TranscriptResponseDto {
    const dto = new TranscriptResponseDto();
    dto.meeting_id = transcript.meetingId;
    dto.language = transcript.language;
    dto.raw_text = transcript.rawText;
    dto.segments = transcript.diarizedSegments.map((segment) => ({
      speaker: segment.speaker,
      text: segment.text,
    }));
    return dto;
  }
}
