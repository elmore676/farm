import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import { corsMiddleware } from './config/cors';
import { apiLimiter } from './config/rateLimit';
import { swaggerSpec } from './config/swagger';
import routes from './routes';
import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';
import { requestLoggerStream } from './config/logger';

export const createApp = () => {
  const app = express();

  app.use(helmet());
  app.use(corsMiddleware);
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan('combined', { stream: requestLoggerStream }));
  app.use(apiLimiter);

  app.use('/api/v1', routes);

  if (process.env.NODE_ENV !== 'production') {
    app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  }

  app.use(notFound);
  app.use(errorHandler);

  return app;
};
