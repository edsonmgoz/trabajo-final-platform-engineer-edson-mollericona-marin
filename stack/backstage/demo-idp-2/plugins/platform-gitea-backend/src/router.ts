import { HttpAuthService, LoggerService } from '@backstage/backend-plugin-api';
import { InputError } from '@backstage/errors';
import express from 'express';
import Router from 'express-promise-router';
import { PlatformGiteaService } from './service';

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new InputError(`${field} is required`);
  }
  return value.trim();
}

function isActionsDisabled(result: any) {
  return result?.decision?.reason === 'platformGitea.actionsEnabled is false';
}

export async function createRouter(options: {
  httpAuth: HttpAuthService;
  logger: LoggerService;
  service: PlatformGiteaService;
}): Promise<express.Router> {
  const { httpAuth, logger, service } = options;
  const router = Router();

  router.use(express.json({ limit: '1mb' }));

  router.get('/health', async (_req, res) => {
    res.json(await service.health());
  });

  router.get('/repos/:owner/:repo/pulls', async (req, res) => {
    res.json({
      items: await service.listPullRequests(
        req.params.owner,
        req.params.repo,
        String(req.query.state ?? 'open'),
      ),
    });
  });

  router.get('/repos/:owner/:repo/pulls/:index', async (req, res) => {
    res.json(
      await service.getPullRequest(
        req.params.owner,
        req.params.repo,
        req.params.index,
      ),
    );
  });

  router.get('/repos/:owner/:repo/actions/runs', async (req, res) => {
    res.json({
      items: await service.listWorkflowRuns(req.params.owner, req.params.repo),
    });
  });

  router.post('/repos/:owner/:repo/pulls', async (req, res) => {
    const credentials = await httpAuth.credentials(req, { allow: ['user'] });
    const result = await service.createPullRequest({
      owner: req.params.owner,
      repo: req.params.repo,
      title: requireString(req.body?.title, 'title'),
      body: req.body?.body,
      head: requireString(req.body?.head, 'head'),
      base: requireString(req.body?.base, 'base'),
      credentials,
    });

    logger.info('platform-gitea pull request created', {
      owner: req.params.owner,
      repo: req.params.repo,
      title: req.body?.title,
    });

    if (result.decision && !result.decision.allowed) {
      res.status(isActionsDisabled(result) ? 403 : 409).json(result);
      return;
    }

    res.status(201).json(result);
  });

  router.post('/repos/:owner/:repo/pulls/:index/merge', async (req, res) => {
    const credentials = await httpAuth.credentials(req, { allow: ['user'] });
    const result = await service.mergePullRequest({
      owner: req.params.owner,
      repo: req.params.repo,
      index: req.params.index,
      mergeStyle: req.body?.mergeStyle,
      credentials,
    });

    logger.info('platform-gitea merge request evaluated', {
      owner: req.params.owner,
      repo: req.params.repo,
      index: req.params.index,
      allowed: result.decision.allowed,
    });

    if (!result.decision.allowed) {
      res.status(isActionsDisabled(result) ? 403 : 409).json(result);
      return;
    }

    res.json(result);
  });

  router.post('/repos/:owner/:repo/pulls/:index/approve', async (req, res) => {
    const credentials = await httpAuth.credentials(req, { allow: ['user'] });
    const result = await service.approvePullRequest({
      owner: req.params.owner,
      repo: req.params.repo,
      index: req.params.index,
      reason: requireString(req.body?.reason, 'reason'),
      credentials,
    });

    logger.info('platform-gitea approve request evaluated', {
      owner: req.params.owner,
      repo: req.params.repo,
      index: req.params.index,
      allowed: result.decision.allowed,
    });

    if (!result.decision.allowed) {
      res.status(isActionsDisabled(result) ? 403 : 409).json(result);
      return;
    }

    res.json(result);
  });

  router.post(
    '/repos/:owner/:repo/pulls/:index/request-changes',
    async (req, res) => {
      const credentials = await httpAuth.credentials(req, { allow: ['user'] });
      const result = await service.requestChangesPullRequest({
        owner: req.params.owner,
        repo: req.params.repo,
        index: req.params.index,
        reason: requireString(req.body?.reason, 'reason'),
        credentials,
      });

      logger.info('platform-gitea request changes request evaluated', {
        owner: req.params.owner,
        repo: req.params.repo,
        index: req.params.index,
        allowed: result.decision.allowed,
      });

      if (!result.decision.allowed) {
        res.status(isActionsDisabled(result) ? 403 : 409).json(result);
        return;
      }

      res.json(result);
    },
  );

  router.post('/gitops/bootstrap-project', async (req, res) => {
    const credentials = await httpAuth.credentials(req, { allow: ['user'] });
    const result = await service.createBootstrapPullRequest({
      appName: requireString(req.body?.appName, 'appName'),
      imageRepository: requireString(
        req.body?.imageRepository,
        'imageRepository',
      ),
      manifestsPath: req.body?.manifestsPath,
      credentials,
    });

    if (result.decision && !result.decision.allowed) {
      res.status(isActionsDisabled(result) ? 403 : 409).json(result);
      return;
    }

    res.status(201).json(result);
  });

  router.post('/gitops/canary', async (req, res) => {
    const credentials = await httpAuth.credentials(req, { allow: ['user'] });
    const result = await service.createCanaryPullRequest({
      appName: requireString(req.body?.appName, 'appName'),
      imageTag: requireString(req.body?.imageTag, 'imageTag'),
      imageFilePath: req.body?.imageFilePath,
      credentials,
    });

    if (result.decision && !result.decision.allowed) {
      res.status(isActionsDisabled(result) ? 403 : 409).json(result);
      return;
    }

    res.status(201).json(result);
  });

  return router;
}
