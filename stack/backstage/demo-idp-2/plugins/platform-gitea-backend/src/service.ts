import {
  BackstageCredentials,
  LoggerService,
  RootConfigService,
} from '@backstage/backend-plugin-api';
import { readPlatformGiteaConfig } from './config';
import { GiteaClient } from './giteaClient';
import { mockPullRequests, mockWorkflowRuns } from './mockData';

export interface PlatformGiteaService {
  health(): Promise<object>;
  listPullRequests(owner: string, repo: string, state: string): Promise<any[]>;
  getPullRequest(owner: string, repo: string, index: string): Promise<any>;
  listWorkflowRuns(owner: string, repo: string): Promise<any[]>;
  createPullRequest(options: {
    owner: string;
    repo: string;
    title: string;
    body?: string;
    head: string;
    base: string;
    credentials: BackstageCredentials;
  }): Promise<any>;
  mergePullRequest(options: {
    owner: string;
    repo: string;
    index: string;
    mergeStyle?: string;
    credentials: BackstageCredentials;
  }): Promise<any>;
  approvePullRequest(options: {
    owner: string;
    repo: string;
    index: string;
    reason: string;
    credentials: BackstageCredentials;
  }): Promise<any>;
  requestChangesPullRequest(options: {
    owner: string;
    repo: string;
    index: string;
    reason: string;
    credentials: BackstageCredentials;
  }): Promise<any>;
  createBootstrapPullRequest(options: {
    appName: string;
    imageRepository: string;
    manifestsPath?: string;
    credentials: BackstageCredentials;
  }): Promise<any>;
  createCanaryPullRequest(options: {
    appName: string;
    imageTag: string;
    imageFilePath?: string;
    credentials: BackstageCredentials;
  }): Promise<any>;
  createCatalogIndexPullRequest(options: {
    repoUrl: string;
    catalogInfoPath?: string;
    catalogIndexPath?: string;
    branchName?: string;
    credentials: BackstageCredentials;
  }): Promise<any>;
}

function actionsDisabledDecision() {
  return {
    allowed: false,
    reason: 'platformGitea.actionsEnabled is false',
  };
}

function canMergePullRequest(pullRequest: any, workflowRuns: any[]) {
  if (pullRequest?.has_conflicts) {
    return { allowed: false, reason: 'pull request has conflicts' };
  }

  const failedRun = workflowRuns.find(run =>
    ['failure', 'failed', 'cancelled'].includes(
      String(run.conclusion ?? run.status ?? '').toLowerCase(),
    ),
  );

  if (failedRun) {
    return {
      allowed: false,
      reason: `workflow run ${failedRun.id} is not green`,
    };
  }

  return { allowed: true, reason: 'pull request can be merged' };
}

function normalizePullRequest(pullRequest: any) {
  return {
    ...pullRequest,
    index: pullRequest.index ?? pullRequest.number,
  };
}

function activeReviews(reviews: any[]) {
  return reviews.filter(review => !review.dismissed && !review.stale);
}

function reviewStatusFromReviews(reviews: any[]) {
  const active = activeReviews(reviews);
  const approvedBy = active
    .filter(review => review.state === 'APPROVED')
    .map(review => review.user?.login)
    .filter(Boolean);
  const changesRequestedBy = active
    .filter(review => review.state === 'REQUEST_CHANGES')
    .map(review => review.user?.login)
    .filter(Boolean);

  return {
    approved: approvedBy.length > 0,
    changesRequested: changesRequestedBy.length > 0,
    approvedBy,
    changesRequestedBy,
  };
}

function normalizePullRequestWithReviews(pullRequest: any, reviews: any[]) {
  return {
    ...normalizePullRequest(pullRequest),
    reviewStatus: reviewStatusFromReviews(reviews),
  };
}

function backstageUserFromCredentials(credentials: BackstageCredentials) {
  const principal = credentials.principal as {
    type?: string;
    userEntityRef?: string;
  };

  if (principal?.type === 'user' && principal.userEntityRef) {
    return principal.userEntityRef;
  }

  return 'unknown';
}

function reviewBody(reason: string, credentials: BackstageCredentials) {
  return `${reason}\n\nBackstage user: ${backstageUserFromCredentials(
    credentials,
  )}`;
}

function parseGiteaRepoUrl(repoUrl: string) {
  const url = new URL(repoUrl.includes('://') ? repoUrl : `http://${repoUrl}`);
  const owner =
    url.searchParams.get('owner') ?? url.searchParams.get('organization');
  const repo = url.searchParams.get('repo');

  if (!owner || !repo) {
    throw new Error(`Invalid repoUrl. Expected owner and repo in ${repoUrl}`);
  }

  return {
    host: url.host,
    owner,
    repo,
  };
}

function trimSlashes(value: string) {
  return value.replace(/^\/+|\/+$/g, '');
}

function branchSafe(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9._-]+/g, '-');
}

function appendCatalogTarget(indexContent: string, target: string) {
  if (indexContent.includes(target)) {
    return {
      changed: false,
      content: indexContent,
    };
  }

  if (!/^\s*targets:\s*$/m.test(indexContent)) {
    throw new Error('Catalog index does not contain spec.targets');
  }

  const content = indexContent.endsWith('\n')
    ? indexContent
    : `${indexContent}\n`;

  return {
    changed: true,
    content: `${content}    - ${target}\n`,
  };
}

export function createPlatformGiteaService(options: {
  config: RootConfigService;
  logger: LoggerService;
}): PlatformGiteaService {
  const cfg = readPlatformGiteaConfig(options.config);
  const gitea = new GiteaClient({
    baseUrl: cfg.baseUrl,
    token: cfg.token,
  });

  return {
    async health() {
      return {
        status: 'ok',
        service: 'platform-gitea-backend',
        mockMode: cfg.mockMode,
        actionsEnabled: cfg.actionsEnabled,
      };
    },

    async listPullRequests(owner, repo, state) {
      if (cfg.mockMode) {
        return mockPullRequests
          .filter(pr => state === 'all' || pr.state === state)
          .map(normalizePullRequest);
      }
      const response = (await gitea.listPulls(owner, repo, state)) as any[];
      return Promise.all(
        response.map(async pullRequest => {
          const normalizedPullRequest = normalizePullRequest(pullRequest);

          try {
            const reviews = (await gitea.listPullReviews(
              owner,
              repo,
              String(normalizedPullRequest.index),
            )) as any[];
            return normalizePullRequestWithReviews(pullRequest, reviews);
          } catch (e) {
            options.logger.warn('Gitea pull request reviews unavailable', {
              owner,
              repo,
              index: normalizedPullRequest.index,
              error: String(e),
            });
            return normalizedPullRequest;
          }
        }),
      );
    },

    async getPullRequest(owner, repo, index) {
      if (cfg.mockMode) {
        return normalizePullRequest(
          mockPullRequests.find(pr => String(pr.index) === String(index)) ??
            mockPullRequests[0],
        );
      }
      const pullRequest = await gitea.getPull(owner, repo, index);
      const reviews = (await gitea.listPullReviews(
        owner,
        repo,
        index,
      )) as any[];
      return normalizePullRequestWithReviews(pullRequest, reviews);
    },

    async listWorkflowRuns(owner, repo) {
      if (cfg.mockMode) {
        return mockWorkflowRuns;
      }

      try {
        const response = await gitea.listWorkflowRuns(owner, repo);
        if (Array.isArray(response)) {
          return response;
        }
        return response.workflow_runs ?? response.items ?? [];
      } catch (e) {
        if (String(e).includes('Gitea API 404')) {
          options.logger.warn(
            'Gitea Actions workflow runs endpoint not found',
            {
              owner,
              repo,
            },
          );
          return [];
        }

        throw e;
      }
    },

    async createPullRequest(request) {
      if (!cfg.actionsEnabled) {
        return { created: false, decision: actionsDisabledDecision() };
      }

      if (cfg.mockMode) {
        return {
          created: true,
          mode: 'mock',
          title: request.title,
          html_url: `${cfg.baseUrl}/${request.owner}/${request.repo}/pulls/101`,
        };
      }

      return gitea.createPull(request);
    },

    async mergePullRequest(request) {
      if (!cfg.actionsEnabled) {
        return { merged: false, decision: actionsDisabledDecision() };
      }

      const pullRequest = await this.getPullRequest(
        request.owner,
        request.repo,
        request.index,
      );
      const workflowRuns = await this.listWorkflowRuns(
        request.owner,
        request.repo,
      );
      const decision = canMergePullRequest(pullRequest, workflowRuns);

      if (!decision.allowed) {
        return { merged: false, decision };
      }

      if (cfg.mockMode) {
        return { merged: true, mode: 'mock', decision };
      }

      return {
        merged: true,
        decision,
        result: await gitea.mergePull(
          request.owner,
          request.repo,
          request.index,
          request.mergeStyle ?? 'merge',
        ),
      };
    },

    async approvePullRequest(request) {
      if (!cfg.actionsEnabled) {
        return { approved: false, decision: actionsDisabledDecision() };
      }

      if (cfg.mockMode) {
        return {
          approved: true,
          mode: 'mock',
          reason: request.reason,
          decision: {
            allowed: true,
            reason: 'pull request approved in mock mode',
          },
        };
      }

      const reviews = (await gitea.listPullReviews(
        request.owner,
        request.repo,
        request.index,
      )) as any[];
      const reviewStatus = reviewStatusFromReviews(reviews);

      if (reviewStatus.approved) {
        return {
          approved: false,
          decision: {
            allowed: false,
            reason: `pull request already approved by ${reviewStatus.approvedBy.join(
              ', ',
            )}`,
          },
          reviewStatus,
        };
      }

      return {
        approved: true,
        decision: { allowed: true, reason: 'pull request approved' },
        reviewStatus,
        result: await gitea.createPullReview({
          owner: request.owner,
          repo: request.repo,
          index: request.index,
          event: 'APPROVED',
          body: reviewBody(request.reason, request.credentials),
        }),
      };
    },

    async requestChangesPullRequest(request) {
      if (!cfg.actionsEnabled) {
        return { changesRequested: false, decision: actionsDisabledDecision() };
      }

      if (cfg.mockMode) {
        return {
          changesRequested: true,
          mode: 'mock',
          reason: request.reason,
          decision: {
            allowed: true,
            reason: 'pull request changes requested in mock mode',
          },
        };
      }

      const reviews = (await gitea.listPullReviews(
        request.owner,
        request.repo,
        request.index,
      )) as any[];
      const reviewStatus = reviewStatusFromReviews(reviews);

      if (reviewStatus.changesRequested) {
        return {
          changesRequested: false,
          decision: {
            allowed: false,
            reason: `pull request already has requested changes by ${reviewStatus.changesRequestedBy.join(
              ', ',
            )}`,
          },
          reviewStatus,
        };
      }

      return {
        changesRequested: true,
        decision: { allowed: true, reason: 'pull request changes requested' },
        reviewStatus,
        result: await gitea.createPullReview({
          owner: request.owner,
          repo: request.repo,
          index: request.index,
          event: 'REQUEST_CHANGES',
          body: reviewBody(request.reason, request.credentials),
        }),
      };
    },

    async createBootstrapPullRequest(request) {
      if (!cfg.actionsEnabled) {
        return { created: false, decision: actionsDisabledDecision() };
      }

      const branch = `bootstrap/${request.appName}`;
      const manifestsPath =
        request.manifestsPath ?? `apps/${request.appName}/kustomization.yaml`;
      const title = `chore: bootstrap ${request.appName}`;

      if (cfg.mockMode) {
        return {
          created: true,
          mode: 'mock',
          branch,
          manifestsPath,
          pullRequest: {
            title,
            html_url: `${cfg.baseUrl}/${cfg.gitopsOwner}/${cfg.gitopsRepo}/pulls/102`,
          },
        };
      }

      return gitea.createPull({
        owner: cfg.gitopsOwner,
        repo: cfg.gitopsRepo,
        title,
        body: `Bootstrap GitOps manifests for ${request.appName} using ${request.imageRepository}.`,
        head: branch,
        base: cfg.gitopsBaseBranch,
      });
    },

    async createCanaryPullRequest(request) {
      if (!cfg.actionsEnabled) {
        return { created: false, decision: actionsDisabledDecision() };
      }

      const branch = `canary/${request.appName}-${request.imageTag}`;
      const imageFilePath =
        request.imageFilePath ?? `apps/${request.appName}/kustomization.yaml`;
      const title = `chore: deploy ${request.appName} ${request.imageTag} canary`;

      if (cfg.mockMode) {
        return {
          created: true,
          mode: 'mock',
          branch,
          imageFilePath,
          pullRequest: {
            title,
            html_url: `${cfg.baseUrl}/${cfg.gitopsOwner}/${cfg.gitopsRepo}/pulls/103`,
          },
        };
      }

      const file = await gitea.getFile(
        cfg.gitopsOwner,
        cfg.gitopsRepo,
        imageFilePath,
        cfg.gitopsBaseBranch,
      );
      const current = Buffer.from(file.content, 'base64').toString('utf8');
      const updated = current.replace(
        /newTag:\s*[^\n]+/g,
        `newTag: ${request.imageTag}`,
      );

      await gitea.updateFile({
        owner: cfg.gitopsOwner,
        repo: cfg.gitopsRepo,
        filepath: imageFilePath,
        content: updated,
        sha: file.sha,
        branch: cfg.gitopsBaseBranch,
        newBranch: branch,
        message: title,
      });

      return gitea.createPull({
        owner: cfg.gitopsOwner,
        repo: cfg.gitopsRepo,
        title,
        body: 'PR creado desde Backstage para iniciar despliegue canario via GitOps.',
        head: branch,
        base: cfg.gitopsBaseBranch,
      });
    },

    async createCatalogIndexPullRequest(request) {
      if (!cfg.actionsEnabled) {
        return { created: false, decision: actionsDisabledDecision() };
      }

      const repo = parseGiteaRepoUrl(request.repoUrl);
      const catalogInfoPath = trimSlashes(
        request.catalogInfoPath ?? 'catalog-info.yaml',
      );
      const catalogIndexPath =
        request.catalogIndexPath ?? cfg.gitopsCatalogIndexPath;
      const catalogTarget = `${cfg.baseUrl}/${repo.owner}/${repo.repo}/src/branch/main/${catalogInfoPath}`;
      const branch =
        request.branchName ??
        `catalog/add-${branchSafe(repo.repo)}-${Date.now()}`;
      const title = `catalog: add ${repo.repo}`;

      if (cfg.mockMode) {
        return {
          created: true,
          mode: 'mock',
          branch,
          catalogTarget,
          pullRequest: {
            title,
            html_url: `${cfg.baseUrl}/${cfg.gitopsOwner}/${cfg.gitopsRepo}/pulls/104`,
          },
        };
      }

      const file = await gitea.getFile(
        cfg.gitopsOwner,
        cfg.gitopsRepo,
        catalogIndexPath,
        cfg.gitopsBaseBranch,
      );
      const current = Buffer.from(
        String(file.content).replace(/\s/g, ''),
        'base64',
      ).toString('utf8');
      const updated = appendCatalogTarget(current, catalogTarget);

      if (!updated.changed) {
        return {
          created: false,
          branch,
          catalogTarget,
          decision: {
            allowed: true,
            reason: 'catalog target already exists in index',
          },
        };
      }

      await gitea.updateFile({
        owner: cfg.gitopsOwner,
        repo: cfg.gitopsRepo,
        filepath: catalogIndexPath,
        content: updated.content,
        sha: file.sha,
        branch: cfg.gitopsBaseBranch,
        newBranch: branch,
        message: title,
      });

      const pullRequest = await gitea.createPull({
        owner: cfg.gitopsOwner,
        repo: cfg.gitopsRepo,
        title,
        body: [
          `Agrega el catalog-info.yaml de ${repo.owner}/${repo.repo} al indice central de Backstage.`,
          '',
          `Catalog target: ${catalogTarget}`,
          `Backstage user: ${backstageUserFromCredentials(
            request.credentials,
          )}`,
        ].join('\n'),
        head: branch,
        base: cfg.gitopsBaseBranch,
      });

      return {
        created: true,
        branch,
        catalogTarget,
        catalogIndexPath,
        pullRequest,
      };
    },
  };
}
