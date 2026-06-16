import { PartialType } from '@nestjs/swagger';
import { CreateLogBookV5Dto } from './create-log-book-v5.dto';

export class UpdateLogBookV5Dto extends PartialType(CreateLogBookV5Dto) {}
