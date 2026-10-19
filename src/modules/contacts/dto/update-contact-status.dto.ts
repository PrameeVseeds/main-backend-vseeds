import { IsString } from 'class-validator';

export class UpdateContactStatusDto {
  @IsString()
  status: string;
}
