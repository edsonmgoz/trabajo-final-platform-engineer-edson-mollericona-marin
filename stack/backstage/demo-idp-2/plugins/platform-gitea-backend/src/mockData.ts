export const mockPullRequests = [
  {
    index: 42,
    title: 'chore: deploy demo-java 1.2.3',
    state: 'open',
    mergeable: true,
    has_conflicts: false,
    html_url: 'http://gitea.local/platform/gitops-apps/pulls/42',
    user: { login: 'backstage-bot' },
    head: { ref: 'deploy/demo-java-1.2.3' },
    base: { ref: 'main' },
  },
  {
    index: 41,
    title: 'docs: update service catalog metadata',
    state: 'closed',
    mergeable: true,
    has_conflicts: false,
    html_url: 'http://gitea.local/platform/gitops-apps/pulls/41',
    user: { login: 'developer' },
    head: { ref: 'docs/catalog-metadata' },
    base: { ref: 'main' },
  },
];

export const mockWorkflowRuns = [
  {
    id: 1001,
    name: 'build-image',
    status: 'success',
    conclusion: 'success',
    html_url: 'http://gitea.local/platform/demo-java/actions/runs/1001',
  },
];
