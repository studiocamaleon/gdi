import { Injectable } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { CurrentAuth } from '../auth/auth.types';

@Injectable()
export class TenantsService {
  constructor(private readonly authService: AuthService) {}

  getCurrent(auth: CurrentAuth) {
    return this.authService.getCurrentContext(auth);
  }

  switchTenant(auth: CurrentAuth, tenantId: string) {
    return this.authService.switchTenant(auth, tenantId);
  }
}
