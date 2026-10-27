import { RootConfigService } from '@backstage/backend-plugin-api';

export interface PlatformGiteaConfig {
  mockMode: boolean;
  actionsEnabled: boolean;
  baseUrl: string;
  token: string;
  gitopsOwner: string;
  gitopsRepo: string;
  gitopsBaseBranch: string;
  gitopsCatalogIndexPath: string;
}

export function readPlatformGiteaConfig(config: RootConfigService): PlatformGiteaConfig {
  const root = config.getOptionalConfig('platformGitea');
  const gitea = root?.getOptionalConfig('gitea');
  const gitops = root?.getOptionalConfig('gitops');

  return {
    mockMode: root?.getOptionalBoolean('mockMode') ?? true,
    actionsEnabled: root?.getOptionalBoolean('actionsEnabled') ?? false,
    baseUrl: gitea?.getOptionalString('baseUrl') ?? 'http://gitea.local',
    token: gitea?.getOptionalString('token') ?? '',
    gitopsOwner: gitops?.getOptionalString('owner') ?? 'root',
    gitopsRepo: gitops?.getOptionalString('repo') ?? 'repo-infra',
    gitopsBaseBranch: gitops?.getOptionalString('baseBranch') ?? 'main',
    gitopsCatalogIndexPath:
      gitops?.getOptionalString('catalogIndexPath') ??
      'backstage/catalog/index.yaml',
  };
}
