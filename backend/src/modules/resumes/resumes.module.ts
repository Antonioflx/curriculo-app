import { Module } from '@nestjs/common';
import { TagsModule } from '@/modules/tags/tags.module';
import { ResumesRepository } from './repositories/resumes.repository';
import { ResumesController } from './resumes.controller';
import { ResumesService } from './services/resumes.service';

@Module({
  imports: [TagsModule],
  controllers: [ResumesController],
  providers: [ResumesRepository, ResumesService],
  exports: [ResumesService],
})
export class ResumesModule {}
