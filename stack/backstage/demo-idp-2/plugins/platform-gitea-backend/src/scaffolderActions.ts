import { InputError } from '@backstage/errors';
import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import { PlatformGiteaService } from './service';

export function createCatalogIndexPullRequestAction(options: {
  service: PlatformGiteaService;
}) {
  return createTemplateAction({
    id: 'platform-gitea:create-catalog-index-pr',
    description:
      'Creates a Gitea pull request that adds a catalog-info.yaml target to the central Backstage catalog index.',
    schema: {
      input: {
        repoUrl: z =>
          z.string({
            description: 'Scaffolder repoUrl of the service repository',
          }),
        catalogInfoPath: z =>
          z
            .string({
              description:
                'Path to catalog-info.yaml inside the generated service repository',
            })
            .optional(),
        catalogIndexPath: z =>
          z
            .string({
              description:
                'Path to the central Backstage catalog index in the GitOps repository',
            })
            .optional(),
        branchName: z =>
          z
            .string({
              description: 'Optional branch name for the GitOps pull request',
            })
            .optional(),
      },
      output: {
        pullRequestUrl: z =>
          z
            .string({
              description: 'URL of the created Gitea pull request',
            })
            .optional(),
        catalogTarget: z =>
          z.string({
            description: 'Catalog target added to the index',
          }),
        branchName: z =>
          z.string({
            description: 'Branch created in the GitOps repository',
          }),
      },
    },
    async handler(ctx) {
      const result = await options.service.createCatalogIndexPullRequest({
        repoUrl: ctx.input.repoUrl,
        catalogInfoPath: ctx.input.catalogInfoPath,
        catalogIndexPath: ctx.input.catalogIndexPath,
        branchName: ctx.input.branchName,
        credentials: await ctx.getInitiatorCredentials(),
      });

      if (result.decision && !result.decision.allowed) {
        throw new InputError(result.decision.reason);
      }

      ctx.output('pullRequestUrl', result.pullRequest?.html_url);
      ctx.output('catalogTarget', result.catalogTarget);
      ctx.output('branchName', result.branch);
    },
  });
}
