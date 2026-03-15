// internal.decorator.ts
import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { Public } from './public.decorator';
import { InternalApiGuard } from './internal-api.guard';

export function InternalRoute() {
  return applyDecorators(
    Public(),
    ApiExcludeEndpoint(),
    UseGuards(InternalApiGuard),
  );
}
