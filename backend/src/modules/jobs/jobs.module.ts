import { Module } from '@nestjs/common';
import { AiModule } from '@/modules/ai/ai.module';
import { JobsController } from './jobs.controller';
import { JobsRepository } from './repositories/jobs.repository';
import { JobsService } from './services/jobs.service';

@Module({
  imports: [AiModule],
  controllers: [JobsController],
  providers: [JobsRepository, JobsService],
  exports: [JobsService],
})
export class JobsModule {}
