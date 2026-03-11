import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { CurrentAuth } from './auth.types';

export const CurrentSession = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentAuth => {
    const request = ctx.switchToHttp().getRequest<{ auth: CurrentAuth }>();
    return request.auth;
  },
);
