import { Controller, Get, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { GetUser } from '../auth/get-user.decorator';
import type { DecodedIdToken } from 'firebase-admin/auth';

@Controller('v1')
@UseGuards(FirebaseAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async getMe(@GetUser() user: DecodedIdToken) {
    const userProfile = await this.usersService.getOrCreateUser(user);
    const platformContext =
      await this.usersService.getUserPlatformContext(userProfile);

    return {
      platform_ready: true,
      platform_context: platformContext,
      profile: userProfile,
    };
  }
}
