import { createFrontendPlugin } from '@backstage/frontend-plugin-api';
import { EntityContentBlueprint } from '@backstage/plugin-catalog-react/alpha';
import { GiteaActionsContent } from './components/GiteaActionsContent';

const giteaActionsContent = EntityContentBlueprint.make({
  name: 'git-actions',
  params: {
    path: '/gitactions',
    title: 'Gitea',
    group: 'development',
    filter: 'kind:component',
    loader: async () => <GiteaActionsContent />,
  },
});

export const giteaPlugin: ReturnType<typeof createFrontendPlugin> =
  createFrontendPlugin({
    pluginId: 'gitea',
    extensions: [giteaActionsContent],
  });
