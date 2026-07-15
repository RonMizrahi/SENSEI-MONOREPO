import { Body, Controller, Get, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { NotificationResponseDto } from './dto/notification-response.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { NotificationsService } from './notifications.service';

/** Notification center — /notifications (unversioned, therapist-scoped). */
@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({
    summary: 'List the therapist’s notifications',
    description:
      'Returns every notification for the caller, newest first, including read/archived ' +
      'state. Filtering and grouping happen client-side.',
  })
  @ApiOkResponse({ type: [NotificationResponseDto], description: 'The therapist’s notifications' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid Bearer token' })
  list(@CurrentUser() user: AuthenticatedUser): Promise<NotificationResponseDto[]> {
    return this.notifications.list(user);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Toggle read / archived state',
    description: 'Marks a caller-owned notification read/unread and/or archived/restored.',
  })
  @ApiParam({ name: 'id', description: 'Notification id', format: 'uuid' })
  @ApiBody({ type: UpdateNotificationDto })
  @ApiOkResponse({ type: NotificationResponseDto, description: 'The updated notification' })
  @ApiNotFoundResponse({ description: 'No such notification (or it is another therapist’s)' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid Bearer token' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateNotificationDto,
  ): Promise<NotificationResponseDto> {
    return this.notifications.update(user, id, dto);
  }
}
