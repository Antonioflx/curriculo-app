import { IsEmail, IsUrl, ValidateIf } from 'class-validator';
import { Nested, NestedList, Text, TextList } from '@/common/decorators/validation.decorators';
import { RESUME_CONTENT_LIMITS as L } from '@/common/constants/resume-content.limits';

/** Schema único do `content` do currículo (docs/produto.md). Todo texto tem limite (`L`). */

export class LinkDto {
  @Text(L.header.linkLabel)
  label: string;

  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  @Text(L.header.linkUrl)
  url: string;
}

export class HeaderDto {
  @Text(L.header.name)
  name: string;

  @Text(L.header.headline)
  headline: string;

  @Text(L.header.location)
  location: string;

  @Text(L.header.phone)
  phone: string;

  @IsEmail()
  @Text(L.header.email)
  email: string;

  @NestedList(LinkDto, L.header.links)
  links: LinkDto[];
}

export class ExperienceDto {
  @Text(L.experiences.company)
  company: string;

  @Text(L.experiences.role)
  role: string;

  @Text(L.experiences.date)
  start: string;

  /** `null` = emprego atual. */
  @ValidateIf((experience: ExperienceDto) => experience.end !== null)
  @Text(L.experiences.date)
  end: string | null;

  @Text(L.experiences.context)
  context: string;

  @TextList(L.experiences.bullets, L.experiences.bullet)
  bullets: string[];
}

export class SkillGroupDto {
  @Text(L.skills.category)
  category: string;

  @TextList(L.skills.items, L.skills.item)
  items: string[];
}

export class EducationDto {
  @Text(L.education.course)
  course: string;

  @Text(L.education.institution)
  institution: string;

  @Text(L.education.date)
  start: string;

  @Text(L.education.date)
  end: string;
}

export class LanguageDto {
  @Text(L.languages.name)
  name: string;

  @Text(L.languages.level)
  level: string;
}

export class ResumeContentDto {
  @Nested(HeaderDto)
  header: HeaderDto;

  @Text(L.summary)
  summary: string;

  @NestedList(ExperienceDto, L.experiences.max)
  experiences: ExperienceDto[];

  @NestedList(SkillGroupDto, L.skills.max)
  skills: SkillGroupDto[];

  @NestedList(EducationDto, L.education.max)
  education: EducationDto[];

  @NestedList(LanguageDto, L.languages.max)
  languages: LanguageDto[];
}
