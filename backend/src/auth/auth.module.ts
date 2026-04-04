import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RolesGuard } from './roles.guard';
import { FirebaseAuthGuard } from './firebase-auth.guard';
import { BusinessOwnershipGuard } from './business-ownership.guard';
import { FirebaseModule } from '../firebase/firebase.module';

@Module({
  imports: [FirebaseModule],
  providers: [
    AuthService,
    RolesGuard,
    FirebaseAuthGuard,
    BusinessOwnershipGuard,
  ],
  exports: [AuthService, RolesGuard, FirebaseAuthGuard, BusinessOwnershipGuard],
})
export class AuthModule {}
