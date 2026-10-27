import { createApp } from '@backstage/frontend-defaults';
import catalogPlugin from '@backstage/plugin-catalog/alpha';
import catalogGraphPlugin from '@backstage/plugin-catalog-graph/alpha';
import kubernetesPlugin from '@backstage/plugin-kubernetes/alpha';
import { argoCdModule } from "./modules/argocd";
import giteaPlugin from "@internal/plugin-platform-gitea";
import { prometheusModule } from './modules/prometheus';
import dockerPlugin from '@internal/plugin-platform-docker';
import { navModule } from './modules/nav';
import { homeModule } from './modules/home';

export default createApp({
  features: [
    catalogPlugin, 
    catalogGraphPlugin, 
    argoCdModule,
    kubernetesPlugin, 
    giteaPlugin, 
    prometheusModule, 
    dockerPlugin,
    navModule, 
    homeModule],
});
