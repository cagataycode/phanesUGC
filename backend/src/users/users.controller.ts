import { Controller, Get, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { GetUser } from '../auth/get-user.decorator';
import type { DecodedIdToken } from 'firebase-admin/auth';

@Controller('api/v1')
@UseGuards(FirebaseAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async getMe(@GetUser() user: DecodedIdToken) {
    const userProfile = await this.usersService.getOrCreateUser(user);

    // We can also compute and return the PlatformContext here as described in the PRD
    return {
      platform_ready: true,
      platform_context: {
        user_id: userProfile?.uid,
        account_id: userProfile?.defaultBusinessId,
        role: 'owner', // Defaulting for simple onboarding response
        subscription_tier: 'free',
        entitlement_source: 'subscription',
      },
      profile: userProfile,
    };
  }
}
