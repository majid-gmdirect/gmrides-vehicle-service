import { PartialType } from '@nestjs/swagger';
import { CreatePermissionLetterDto } from './create-permission-letter.dto';

export class UpdatePermissionLetterDto extends PartialType(CreatePermissionLetterDto) {}

