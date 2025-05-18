import { Module } from '@nestjs/common';
import { AppGateway } from './app.gateway'; // Make sure this path is correct

@Module({
  imports: [],
  controllers: [], // No controllers needed for this simple app
  providers: [AppGateway], // <<< CRUCIAL: AppGateway MUST be here
})
export class AppModule {}
