import { createBackendFeatureLoader } from '@backstage/backend-plugin-api';
import { platformGiteaPlugin } from './plugin';
import { platformGiteaScaffolderModule } from './scaffolderModule';

export { platformGiteaPlugin } from './plugin';
export { platformGiteaScaffolderModule } from './scaffolderModule';

export default createBackendFeatureLoader({
  async loader() {
    return [platformGiteaPlugin, platformGiteaScaffolderModule];
  },
});
