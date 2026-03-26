import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RolesGuard } from './roles.guard';
import { FirebaseAuthGuard } from './firebase-auth.guard';
import { FirebaseModule } from '../firebase/firebase.module';

@Module({
  imports: [FirebaseModule],
  providers: [AuthService, RolesGuard, FirebaseAuthGuard],
  exports: [AuthService, RolesGuard, FirebaseAuthGuard],
})
export class AuthModule {}
