// src/openapi/spec.ts
// OpenAPI 3.0 spec served via swagger-ui-express.
// Loaded lazily so missing the optional dev-dependency doesn't crash startup.
import type { Express } from 'express';

export async function setupSwagger(app: Express): Promise<void> {
  // Lazy imports — only needed in dev/docs
  const [swaggerUi, { default: swaggerDocument }] = await Promise.all([
    import('swagger-ui-express'),
    import('./swagger.json', { assert: { type: 'json' } }),
  ]);
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
}
