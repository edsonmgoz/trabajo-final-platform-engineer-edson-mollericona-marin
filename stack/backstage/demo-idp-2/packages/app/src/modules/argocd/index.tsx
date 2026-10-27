import { Grid } from '@material-ui/core';
import { EntityContentBlueprint } from '@backstage/plugin-catalog-react/alpha';
import {
  compatWrapper,
  convertLegacyPlugin,
} from '@backstage/core-compat-api';
import {
  argocdPlugin,
  EntityArgoCDHistoryCard,
  EntityArgoCDOverviewCard,
} from '@roadiehq/backstage-plugin-argo-cd';

function ArgoCdContent() {
  return (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <EntityArgoCDOverviewCard />
      </Grid>
      <Grid item xs={12}>
        <EntityArgoCDHistoryCard />
      </Grid>
    </Grid>
  );
}

const argoCdContent = EntityContentBlueprint.make({
  name: 'gitops',
  params: {
    path: '/argocd',
    title: 'ArgoCD',
    group: 'gitops',
    filter: 'kind:component',
    loader: async () => compatWrapper(<ArgoCdContent />),
  },
});

export const argoCdModule: ReturnType<typeof convertLegacyPlugin> =
  convertLegacyPlugin(argocdPlugin, {
    extensions: [argoCdContent],
  });
