import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AppConfigService } from '@/config/app-config.service';
import { UsersModule } from '@/modules/users/users.module';
import { AuthCookiesService } from './services/auth-cookies.service';
import { ACCESS_TTL_SECONDS } from './constants/auth.constants';
import { AuthController } from './auth.controller';
import { AuthService } from './services/auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { PasswordService } from './services/password.service';
import { SessionsRepository } from './repositories/sessions.repository';
import { TokensService } from './services/tokens.service';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        secret: config.get('JWT_SECRET'),
        signOptions: { algorithm: 'HS256', expiresIn: ACCESS_TTL_SECONDS },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthCookiesService, JwtStrategy, PasswordService, SessionsRepository, TokensService],
})
export class AuthModule {}
