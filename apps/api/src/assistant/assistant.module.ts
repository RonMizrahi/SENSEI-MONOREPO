import { Module } from '@nestjs/common';
import { provideMockSwappable } from '../common/mock-mode';
import { CalendarModule } from '../calendar/calendar.module';
import { PatientsModule } from '../patients/patients.module';
import { SummariesModule } from '../summaries/summaries.module';
import { AssistantContextController } from './assistant-context.controller';
import { AssistantContextService } from './assistant-context.service';
import { ASSISTANT_CLIENT, type AssistantClient } from './assistant-client';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';
import { MockAssistant } from './mock.assistant';
import { OpenAIAssistant } from './openai.assistant';

/**
 * The "שאל את סנסיי" chat assistant: the streaming /assistant/chat endpoint (OpenAI
 * or MOCK_MODE mock, mock-swappable) plus the PHI-safe /assistant/context/* surface
 * its tools read (reusing the patients, calendar, and summaries repositories).
 */
@Module({
  imports: [PatientsModule, CalendarModule, SummariesModule],
  controllers: [AssistantController, AssistantContextController],
  providers: [
    AssistantService,
    AssistantContextService,
    provideMockSwappable<AssistantClient>(ASSISTANT_CLIENT, OpenAIAssistant, MockAssistant),
  ],
})
export class AssistantModule {}
