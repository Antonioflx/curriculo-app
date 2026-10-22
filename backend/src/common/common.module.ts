import { Global, Module } from '@nestjs/common';
import { EventLogger } from './logging/event-logger';

@Global()
@Module({
  providers: [EventLogger],
  exports: [EventLogger],
})
export class CommonModule {}
