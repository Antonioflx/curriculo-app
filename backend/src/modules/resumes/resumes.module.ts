import { Module } from '@nestjs/common';
import { AiModule } from '@/modules/ai/ai.module';
import { TagsModule } from '@/modules/tags/tags.module';
import { ResumesRepository } from './repositories/resumes.repository';
import { ResumesController } from './resumes.controller';
import { ResumesService } from './services/resumes.service';

@Module({
  imports: [AiModule, TagsModule],
  controllers: [ResumesController],
  providers: [ResumesRepository, ResumesService],
  exports: [ResumesService],
})
export class ResumesModule {}
