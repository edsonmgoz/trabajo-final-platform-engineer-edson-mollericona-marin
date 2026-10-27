export class GiteaClient {
  private readonly baseUrl: string;
  private readonly token: string;

  constructor(options: { baseUrl: string; token: string }) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.token = options.token;
  }

  async request(path: string, options: RequestInit = {}) {
    const headers = new Headers(options.headers);
    headers.set('Accept', 'application/json');
    headers.set('Content-Type', 'application/json');

    if (this.token) {
      headers.set('Authorization', `token ${this.token}`);
    }

    const response = await fetch(`${this.baseUrl}/api/v1${path}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Gitea API ${response.status}: ${text}`);
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      return response.json();
    }

    return response.text();
  }

  private encodePath(filepath: string) {
    return filepath.split('/').map(encodeURIComponent).join('/');
  }

  listPulls(owner: string, repo: string, state = 'open') {
    return this.request(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(
        repo,
      )}/pulls?state=${encodeURIComponent(state)}`,
    );
  }

  getPull(owner: string, repo: string, index: string) {
    return this.request(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(
        repo,
      )}/pulls/${encodeURIComponent(index)}`,
    );
  }

  createPull(options: {
    owner: string;
    repo: string;
    title: string;
    body?: string;
    head: string;
    base: string;
  }) {
    return this.request(
      `/repos/${encodeURIComponent(options.owner)}/${encodeURIComponent(
        options.repo,
      )}/pulls`,
      {
        method: 'POST',
        body: JSON.stringify({
          title: options.title,
          body: options.body ?? '',
          head: options.head,
          base: options.base,
        }),
      },
    );
  }

  mergePull(owner: string, repo: string, index: string, mergeStyle = 'merge') {
    return this.request(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(
        repo,
      )}/pulls/${encodeURIComponent(index)}/merge`,
      {
        method: 'POST',
        body: JSON.stringify({
          Do: mergeStyle,
          MergeTitleField: `Merge PR #${index}`,
          MergeMessageField: 'Merged from Backstage platform-gitea-backend',
          force_merge: false,
        }),
      },
    );
  }

  createPullReview(options: {
    owner: string;
    repo: string;
    index: string;
    event: 'APPROVED' | 'REQUEST_CHANGES';
    body: string;
  }) {
    return this.request(
      `/repos/${encodeURIComponent(options.owner)}/${encodeURIComponent(
        options.repo,
      )}/pulls/${encodeURIComponent(options.index)}/reviews`,
      {
        method: 'POST',
        body: JSON.stringify({
          event: options.event,
          body: options.body,
        }),
      },
    );
  }

  listPullReviews(owner: string, repo: string, index: string) {
    return this.request(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(
        repo,
      )}/pulls/${encodeURIComponent(index)}/reviews`,
    );
  }

  listWorkflowRuns(owner: string, repo: string) {
    return this.request(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(
        repo,
      )}/actions/runs?limit=20`,
    );
  }

  getFile(owner: string, repo: string, filepath: string, ref = 'main') {
    return this.request(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(
        repo,
      )}/contents/${this.encodePath(filepath)}?ref=${encodeURIComponent(ref)}`,
    );
  }

  updateFile(options: {
    owner: string;
    repo: string;
    filepath: string;
    content: string;
    sha: string;
    branch: string;
    newBranch: string;
    message: string;
  }) {
    return this.request(
      `/repos/${encodeURIComponent(options.owner)}/${encodeURIComponent(
        options.repo,
      )}/contents/${this.encodePath(options.filepath)}`,
      {
        method: 'PUT',
        body: JSON.stringify({
          content: Buffer.from(options.content, 'utf8').toString('base64'),
          sha: options.sha,
          branch: options.branch,
          new_branch: options.newBranch,
          message: options.message,
        }),
      },
    );
  }
}
