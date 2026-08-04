import { Global, Module } from '@nestjs/common';
import { MongoDbService } from './mongo.service';

@Global()
@Module({
  providers: [MongoDbService],
  exports: [MongoDbService],
})
export class MongoModule {}
