import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RolesGuard } from './roles.guard';
import { FirebaseModule } from '../firebase/firebase.module';

@Module({
  imports: [FirebaseModule],
  providers: [AuthService, RolesGuard],
  exports: [AuthService, RolesGuard],
})
export class AuthModule {}
