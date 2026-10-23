import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Public } from '@/common/decorators/public.decorator';
import { EmailThrottlerGuard } from '@/common/guards/email-throttler.guard';
import type { AppRequest, AuthUser } from '@/common/types/app-request';
import { UserResponseDto } from '@/modules/users/dto/user-response.dto';
import { UsersService } from '@/modules/users/services/users.service';
import { AuthCookiesService } from './services/auth-cookies.service';
import { invalidSession, REFRESH_COOKIE } from './constants/auth.constants';
import type { RequestMeta } from './types/auth.types';
import { AuthService } from './services/auth.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

const AUTH_IP_LIMIT = { default: { limit: 10, ttl: 60_000 } };

function metaFrom(req: AppRequest): RequestMeta {
  return { ip: req.ip, userAgent: req.get('user-agent')?.slice(0, 255), requestId: req.id };
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
    private readonly cookies: AuthCookiesService,
  ) {}

  @Public()
  @Throttle(AUTH_IP_LIMIT)
  @UseGuards(EmailThrottlerGuard)
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Req() req: AppRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const { user, tokens } = await this.auth.register(dto, metaFrom(req));
    this.cookies.set(res, tokens);
    return { user: UserResponseDto.from(user) };
  }

  @Public()
  @Throttle(AUTH_IP_LIMIT)
  @UseGuards(EmailThrottlerGuard)
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() req: AppRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const { user, tokens } = await this.auth.login(dto, metaFrom(req));
    this.cookies.set(res, tokens);
    return { user: UserResponseDto.from(user) };
  }

  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('refresh')
  async refresh(@Req() req: AppRequest, @Res({ passthrough: true }) res: Response): Promise<void> {
    const refreshToken = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    try {
      if (!refreshToken) throw invalidSession();
      this.cookies.set(res, await this.auth.refresh(refreshToken, metaFrom(req)));
    } catch (error) {
      this.cookies.clear(res);
      throw error;
    }
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  async logout(
    @CurrentUser() user: AuthUser,
    @Req() req: AppRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.logout(user, metaFrom(req));
    this.cookies.clear(res);
  }

  @Get('me')
  async me(@CurrentUser() user: AuthUser): Promise<AuthResponseDto> {
    return { user: UserResponseDto.from(await this.users.getById(user.userId)) };
  }
}
