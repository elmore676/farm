import swaggerJsdoc from 'swagger-jsdoc';
import { env } from './env';

export const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.1',
    info: {
      title: 'AquaFlow API',
      version: '1.0.0',
      description: 'API documentation for AquaFlow aquaculture management',
    },
    servers: [{ url: `http://localhost:${env.PORT}/api/v1` }],
  },
  apis: ['./src/controllers/**/*.ts'],
});
