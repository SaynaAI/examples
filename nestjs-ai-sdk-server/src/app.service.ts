import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'NestJS AI SDK Server - Use POST /start to begin a voice session';
  }
}
