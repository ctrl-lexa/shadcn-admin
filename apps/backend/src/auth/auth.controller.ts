import { Controller, Post, Body, UseGuards, Get, Request } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register new user' })
  @ApiResponse({ status: 201, description: 'User successfully registered' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 409, description: 'User already exists' })
  async register(@Body() dto: RegisterDto) {
    // TODO: Get tenantId from registration flow or subdomain
    // For now, hardcoded - will be replaced with proper tenant creation
    const tenantId = 'temp-tenant-id';
    return this.authService.register(dto, tenantId);
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Login user' })
  @ApiResponse({
    status: 200,
    description: 'User successfully logged in',
    schema: {
      example: {
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        user: {
          id: 'uuid',
          username: 'john_doe',
          email: 'john@example.com',
          role: { name: 'ADMIN' },
          permissions: ['users.read', 'users.create'],
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() dto: LoginDto, @Request() req: any) {
    const ipAddress = req.ip || req.connection?.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return this.authService.login(dto, ipAddress, userAgent);
  }

  @Public()
  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refresh(@CurrentUser() user: any, @Body() dto: RefreshTokenDto, @Request() req: any) {
    const ipAddress = req.ip || req.connection?.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return this.authService.refreshToken(user.userId, dto.refreshToken, ipAddress, userAgent);
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @ApiOperation({ summary: 'Logout user' })
  @ApiResponse({ status: 200, description: 'User logged out successfully' })
  async logout(@CurrentUser() user: any, @Body() dto: RefreshTokenDto, @Request() req: any) {
    const ipAddress = req.ip || req.connection?.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return this.authService.logout(user.userId, dto.refreshToken, ipAddress, userAgent);
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({
    status: 200,
    description: 'Current user profile',
    schema: {
      example: {
        user: {
          userId: 'uuid',
          username: 'john_doe',
          email: 'john@example.com',
          tenantId: 'tenant-uuid',
          outletId: 'outlet-uuid',
          role: { id: 'role-uuid', name: 'ADMIN' },
          permissions: ['users.read', 'users.create', 'products.read'],
        },
      },
    },
  })
  async getProfile(@CurrentUser() user: any) {
    return { user };
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  @ApiOperation({ summary: 'Change user password' })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid current password' })
  async changePassword(
    @CurrentUser() user: any, 
    @Body() dto: ChangePasswordDto,
    @Request() req: any,
  ) {
    const ipAddress = req.ip || req.connection?.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return this.authService.changePassword(
      user.userId,
      dto.currentPassword,
      dto.newPassword,
      ipAddress,
      userAgent,
    );
  }
}
