import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AiModule } from './ai/ai.module';
import { validate } from './config/env.validation';
import { SaynaModule } from './sayna/sayna.module';
import { SaynaExceptionFilter, AllExceptionsFilter } from './common/filters';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
      envFilePath: '.env',
      cache: true,
    }),
    AiModule,
    SaynaModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Global exception filters (order matters - more specific first)
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_FILTER,
      useClass: SaynaExceptionFilter,
    },
  ],
})
export class AppModule {}
