import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { createRouter } from './router';
import { createPlatformGiteaService } from './service';

export const platformGiteaPlugin = createBackendPlugin({
  pluginId: 'platform-gitea',
  register(env) {
    env.registerInit({
      deps: {
        config: coreServices.rootConfig,
        httpAuth: coreServices.httpAuth,
        httpRouter: coreServices.httpRouter,
        logger: coreServices.logger,
      },
      async init({ config, httpAuth, httpRouter, logger }) {
        const service = createPlatformGiteaService({ config, logger });

        httpRouter.addAuthPolicy({
          path: '/health',
          allow: 'unauthenticated',
        });

        httpRouter.use(
          await createRouter({
            httpAuth,
            logger,
            service,
          }),
        );
      },
    });
  },
});
