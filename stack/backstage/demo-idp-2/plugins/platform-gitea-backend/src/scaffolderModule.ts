import {
  coreServices,
  createBackendModule,
} from '@backstage/backend-plugin-api';
import { scaffolderActionsExtensionPoint } from '@backstage/plugin-scaffolder-node';
import { createCatalogIndexPullRequestAction } from './scaffolderActions';
import { createPlatformGiteaService } from './service';

export const platformGiteaScaffolderModule = createBackendModule({
  pluginId: 'scaffolder',
  moduleId: 'platform-gitea',
  register(env) {
    env.registerInit({
      deps: {
        config: coreServices.rootConfig,
        logger: coreServices.logger,
        scaffolder: scaffolderActionsExtensionPoint,
      },
      async init({ config, logger, scaffolder }) {
        const service = createPlatformGiteaService({ config, logger });
        scaffolder.addActions(
          createCatalogIndexPullRequestAction({ service }),
        );
      },
    });
  },
});

export default platformGiteaScaffolderModule;
