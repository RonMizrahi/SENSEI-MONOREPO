import {
  Body,
  Controller,
  Post,
  Req,
  Res,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { Env } from '../config/env.schema';
import { AssistantService } from './assistant.service';
import { ChatRequestDto, latestQuestionLength, sessionId } from './dto/chat-request.dto';
import {
  UI_MESSAGE_STREAM_HEADER,
  UI_MESSAGE_STREAM_VERSION,
} from './sse';

/** The "שאל את סנסיי" chat assistant — streams a Vercel AI SDK UI Message Stream. */
@ApiTags('assistant')
@ApiBearerAuth()
@Controller('assistant')
export class AssistantController {
  constructor(
    private readonly assistantService: AssistantService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Post('chat')
  @ApiOperation({
    summary: 'Stream an assistant reply',
    description:
      'Consumed by `@ai-sdk/react`\'s useChat as Server-Sent Events (UI Message Stream ' +
      'protocol v1), so the reply renders token-by-token. Stateless — the client sends ' +
      'the full conversation each turn.',
  })
  @ApiBody({ type: ChatRequestDto })
  @ApiOkResponse({ description: 'SSE stream (text/event-stream) of UI Message Stream frames.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid Bearer token' })
  @ApiUnprocessableEntityResponse({ description: 'No user question, or the question is too long' })
  @ApiServiceUnavailableResponse({ description: 'The assistant is disabled or not configured' })
  async chat(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
    @Body() body: ChatRequestDto,
    @Res() response: Response,
  ): Promise<void> {
    const questionLength = latestQuestionLength(body);
    if (questionLength === 0) {
      throw new UnprocessableEntityException('a user question is required');
    }
    if (questionLength > this.config.get('ASSISTANT_MAX_QUESTION_CHARS', { infer: true })) {
      throw new UnprocessableEntityException('the question is too long');
    }
    this.assistantService.ensureAvailable();

    response.status(200);
    response.setHeader('content-type', 'text/event-stream');
    response.setHeader(UI_MESSAGE_STREAM_HEADER, UI_MESSAGE_STREAM_VERSION);
    response.setHeader('cache-control', 'no-cache');
    // Disable proxy buffering so deltas reach the browser as they are produced.
    response.setHeader('x-accel-buffering', 'no');

    const authHeader = request.headers.authorization;
    for await (const frame of this.assistantService.streamSse(body, {
      userId: user.userId,
      sessionId: sessionId(body),
      authHeader,
    })) {
      response.write(frame);
    }
    response.end();
  }
}
