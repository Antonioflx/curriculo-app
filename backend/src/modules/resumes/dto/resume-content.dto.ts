import { IsEmail, IsUrl, ValidateIf } from 'class-validator';
import { Nested, NestedList, Text, TextList } from '@/common/decorators/validation.decorators';

/** Schema único do `content` do currículo (docs/produto.md). Todo texto tem limite de tamanho. */

export class LinkDto {
  @Text(50)
  label: string;

  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  @Text(300)
  url: string;
}

export class HeaderDto {
  @Text(100)
  name: string;

  @Text(150)
  headline: string;

  @Text(100)
  location: string;

  @Text(30)
  phone: string;

  @IsEmail()
  @Text(254)
  email: string;

  @NestedList(LinkDto, 10)
  links: LinkDto[];
}

export class ExperienceDto {
  @Text(100)
  company: string;

  @Text(100)
  role: string;

  @Text(20)
  start: string;

  /** `null` = emprego atual. */
  @ValidateIf((experience: ExperienceDto) => experience.end !== null)
  @Text(20)
  end: string | null;

  @Text(500)
  context: string;

  @TextList(15, 400)
  bullets: string[];
}

export class SkillGroupDto {
  @Text(60)
  category: string;

  @TextList(40, 60)
  items: string[];
}

export class EducationDto {
  @Text(120)
  course: string;

  @Text(120)
  institution: string;

  @Text(20)
  start: string;

  @Text(20)
  end: string;
}

export class LanguageDto {
  @Text(50)
  name: string;

  @Text(50)
  level: string;
}

export class ResumeContentDto {
  @Nested(HeaderDto)
  header: HeaderDto;

  @Text(1500)
  summary: string;

  @NestedList(ExperienceDto, 20)
  experiences: ExperienceDto[];

  @NestedList(SkillGroupDto, 15)
  skills: SkillGroupDto[];

  @NestedList(EducationDto, 10)
  education: EducationDto[];

  @NestedList(LanguageDto, 10)
  languages: LanguageDto[];
}
