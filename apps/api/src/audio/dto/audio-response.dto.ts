import { ApiProperty } from '@nestjs/swagger';

/** 201 body of POST /audio/upload — file metadata + transcription outcome. */
export class AudioUploadResponseDto {
  @ApiProperty({
    description: 'Stored audio id ({uuid-hex}{ext})',
    example: '3f2b8c1d9a4e4f6a8b0c1d2e3f405162.mp3',
  })
  id!: string;

  @ApiProperty({ description: 'Original upload filename', example: 'session.mp3' })
  filename!: string;

  @ApiProperty({ description: 'Declared MIME type of the upload', example: 'audio/mpeg' })
  content_type!: string;

  @ApiProperty({ description: 'Upload size in bytes', example: 524288 })
  size_bytes!: number;

  @ApiProperty({ description: 'Transcript language (ISO-639-1)', example: 'he' })
  language!: string;

  @ApiProperty({ description: 'Full transcribed text' })
  text!: string;

  @ApiProperty({ description: 'Meeting the transcript was saved for', format: 'uuid' })
  meeting_id!: string;

  @ApiProperty({ description: 'Id of the persisted transcript row', format: 'uuid' })
  transcript_id!: string;
}

/** One transcribed word with second-offsets from the start of the audio. */
export class TranscribedWordDto {
  @ApiProperty({ description: 'The word text', example: 'שלום' })
  text!: string;

  @ApiProperty({ description: 'Start offset in seconds', example: 0.4 })
  start!: number;

  @ApiProperty({ description: 'End offset in seconds', example: 0.8 })
  end!: number;
}

/** 200 body of POST /audio/{id}/transcribe. */
export class TranscriptionResponseDto {
  @ApiProperty({
    description: 'The transcribed stored-audio id',
    example: '3f2b8c1d9a4e4f6a8b0c1d2e3f405162.mp3',
  })
  id!: string;

  @ApiProperty({ description: 'Transcript language (ISO-639-1)', example: 'he' })
  language!: string;

  @ApiProperty({ description: 'Full transcribed text' })
  text!: string;

  @ApiProperty({ description: 'Word-level timestamps', type: [TranscribedWordDto] })
  words!: TranscribedWordDto[];
}
