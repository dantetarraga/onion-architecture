import { IsString, MinLength } from 'class-validator';

export class FacebookLoginDto {
  @IsString()
  @MinLength(10)
  accessToken!: string;
}
