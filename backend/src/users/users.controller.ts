import { Controller, Get, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { GetUser } from '../auth/get-user.decorator';
import { FirestoreService } from '../firebase/firestore.service';
import type { DecodedIdToken } from 'firebase-admin/auth';

@Controller('v1')
@UseGuards(FirebaseAuthGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly firestore: FirestoreService,
  ) {}

  @Get('me')
  async getMe(@GetUser() user: DecodedIdToken) {
    const userProfile = await this.usersService.getOrCreateUser(user);

    // Fetch business membership to get role and calculate entitlements
    const db = this.firestore.getFirestore();
    const memberRef = db.doc(
      `businesses/${userProfile.defaultBusinessId}/members/${user.uid}`,
    );
    const memberSnap = await memberRef.get();

    let role = 'owner'; // Default
    let subscriptionTier = 'free';

    if (memberSnap.exists) {
      const memberData = memberSnap.data() as {
        role?: string;
        subscriptionTier?: string;
      };
      role = memberData?.role || 'owner';
      subscriptionTier = memberData?.subscriptionTier || 'free';
    }

    // Calculate entitlements based on subscription tier
    const entitlements = this.calculateEntitlements(subscriptionTier);

    return {
      platform_ready: true,
      platform_context: {
        user_id: userProfile?.uid,
        account_id: userProfile?.defaultBusinessId,
        role,
        subscription_tier: subscriptionTier,
        entitlement_source: 'subscription',
        entitlements,
      },
      profile: userProfile,
    };
  }

  private calculateEntitlements(subscriptionTier: string) {
    // Return entitlements based on subscription tier
    const baseEntitlements = {
      can_generate_ads: true,
      can_render_final: false,
      can_regenerate_scene: false,
      max_duration_sec: 30,
    };

    switch (subscriptionTier) {
      case 'pro':
        return {
          ...baseEntitlements,
          can_render_final: true,
          can_regenerate_scene: true,
          max_duration_sec: 60,
        };
      case 'free':
      default:
        return baseEntitlements;
    }
  }
}
