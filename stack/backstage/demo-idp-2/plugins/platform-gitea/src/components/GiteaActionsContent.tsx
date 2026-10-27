import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  ButtonGroup,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@material-ui/core';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import OpenInNewIcon from '@material-ui/icons/OpenInNew';
import RateReviewIcon from '@material-ui/icons/RateReview';
import RefreshIcon from '@material-ui/icons/Refresh';
import VisibilityIcon from '@material-ui/icons/Visibility';
import {
  InfoCard,
  Link,
  Progress,
  Table,
  TableColumn,
  WarningPanel,
} from '@backstage/core-components';
import {
  discoveryApiRef,
  fetchApiRef,
  useApi,
} from '@backstage/core-plugin-api';
import { useEntity } from '@backstage/plugin-catalog-react';

type ContentTab = 'pull-requests' | 'workflow-runs';
type PullRequestState = 'open' | 'closed' | 'all';
type PullRequestAction = 'approve' | 'request_changes';

type ReviewStatus = {
  approved?: boolean;
  changesRequested?: boolean;
  approvedBy?: string[];
  changesRequestedBy?: string[];
};

type GiteaRepo = {
  owner: string;
  repo: string;
};

type PullRequest = {
  index: number;
  title: string;
  state: string;
  body?: string;
  html_url?: string;
  has_conflicts?: boolean;
  mergeable?: boolean;
  merged?: boolean;
  user?: {
    login?: string;
  };
  head?: {
    ref?: string;
  };
  base?: {
    ref?: string;
  };
  reviewStatus?: ReviewStatus;
  created_at?: string;
  updated_at?: string;
};

type WorkflowRun = {
  id: number | string;
  name?: string;
  status?: string;
  conclusion?: string;
  event?: string;
  head_branch?: string;
  html_url?: string;
  created_at?: string;
  updated_at?: string;
};

type PlatformGiteaHealth = {
  mockMode?: boolean;
  actionsEnabled?: boolean;
};

function parseRepoFromSourceLocation(
  sourceLocation?: string,
): GiteaRepo | undefined {
  if (!sourceLocation?.startsWith('url:')) {
    return undefined;
  }

  try {
    const url = new URL(sourceLocation.slice('url:'.length));
    const [owner, repo] = url.pathname.split('/').filter(Boolean);

    if (!owner || !repo) {
      return undefined;
    }

    return {
      owner,
      repo: repo.replace(/\.git$/, ''),
    };
  } catch {
    return undefined;
  }
}

function parseRepoFromProjectSlug(projectSlug?: string): GiteaRepo | undefined {
  const [owner, repo] = projectSlug?.split('/').filter(Boolean) ?? [];

  if (!owner || !repo) {
    return undefined;
  }

  return {
    owner,
    repo: repo.replace(/\.git$/, ''),
  };
}

function getEntityGiteaRepo(
  entity: ReturnType<typeof useEntity>['entity'],
): GiteaRepo | undefined {
  const annotations = entity.metadata.annotations ?? {};

  return (
    parseRepoFromProjectSlug(annotations['gitea.com/project-slug']) ??
    parseRepoFromSourceLocation(annotations['backstage.io/source-location'])
  );
}

function formatDate(value?: string) {
  if (!value) {
    return '-';
  }

  return new Date(value).toLocaleString();
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function StatusChip({ value }: { value?: string }) {
  const normalized = String(value ?? 'unknown').toLowerCase();
  const color = ['success', 'completed', 'open'].includes(normalized)
    ? 'primary'
    : ['failure', 'failed', 'cancelled', 'closed'].includes(normalized)
    ? 'secondary'
    : 'default';

  return <Chip size="small" label={value ?? 'unknown'} color={color} />;
}

function ReviewStatusChips({ status }: { status?: ReviewStatus }) {
  if (status?.approved) {
    return (
      <Chip
        size="small"
        color="primary"
        label={`Approved by ${status.approvedBy?.join(', ') ?? 'reviewer'}`}
      />
    );
  }

  if (status?.changesRequested) {
    return (
      <Chip
        size="small"
        color="secondary"
        label={`Changes requested by ${
          status.changesRequestedBy?.join(', ') ?? 'reviewer'
        }`}
      />
    );
  }

  return <Chip size="small" label="Pending review" />;
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value?: string | number;
}) {
  return (
    <Grid item xs={12} md={6}>
      <Typography variant="caption" color="textSecondary">
        {label}
      </Typography>
      <Typography variant="body2">{value ?? '-'}</Typography>
    </Grid>
  );
}

function PullRequestDetailDialog({
  pullRequest,
  onClose,
}: {
  pullRequest?: PullRequest;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={Boolean(pullRequest)}
      onClose={onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        {pullRequest ? `Pull Request #${pullRequest.index}` : 'Pull Request'}
      </DialogTitle>
      <DialogContent dividers>
        {pullRequest && (
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Typography variant="h6">{pullRequest.title}</Typography>
            </Grid>
            <DetailRow label="State" value={pullRequest.state} />
            <DetailRow label="Author" value={pullRequest.user?.login} />
            <DetailRow label="Head" value={pullRequest.head?.ref} />
            <DetailRow label="Base" value={pullRequest.base?.ref} />
            <DetailRow
              label="Mergeable"
              value={String(pullRequest.mergeable ?? '-')}
            />
            <DetailRow
              label="Conflicts"
              value={String(pullRequest.has_conflicts ?? '-')}
            />
            <DetailRow
              label="Created"
              value={formatDate(pullRequest.created_at)}
            />
            <DetailRow
              label="Updated"
              value={formatDate(pullRequest.updated_at)}
            />
            {pullRequest.body && (
              <Grid item xs={12}>
                <Typography variant="caption" color="textSecondary">
                  Description
                </Typography>
                <Typography variant="body2">{pullRequest.body}</Typography>
              </Grid>
            )}
          </Grid>
        )}
      </DialogContent>
      <DialogActions>
        {pullRequest?.html_url && (
          <Button
            href={pullRequest.html_url}
            target="_blank"
            rel="noopener noreferrer"
            startIcon={<OpenInNewIcon />}
          >
            Open in Gitea
          </Button>
        )}
        <Button onClick={onClose} color="primary">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function PullRequestActionDialog({
  action,
  pullRequest,
  reason,
  loading,
  onReasonChange,
  onClose,
  onConfirm,
}: {
  action?: PullRequestAction;
  pullRequest?: PullRequest;
  reason: string;
  loading: boolean;
  onReasonChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const actionLabel = action === 'approve' ? 'Approve' : 'Request change';

  return (
    <Dialog
      open={Boolean(action && pullRequest)}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        {pullRequest ? `${actionLabel} PR #${pullRequest.index}` : actionLabel}
      </DialogTitle>
      <DialogContent dividers>
        {pullRequest && (
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Typography variant="subtitle1">{pullRequest.title}</Typography>
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Reason"
                value={reason}
                onChange={event => onReasonChange(event.target.value)}
                variant="outlined"
                multiline
                rows={4}
                fullWidth
                required
                disabled={loading}
              />
            </Grid>
          </Grid>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          color="primary"
          variant="contained"
          disabled={loading || reason.trim() === ''}
          onClick={onConfirm}
        >
          {actionLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function GiteaActionsContent() {
  const { entity } = useEntity();
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);
  const repo = useMemo(() => getEntityGiteaRepo(entity), [entity]);
  const [activeTab, setActiveTab] = useState<ContentTab>('pull-requests');
  const [pullRequestState, setPullRequestState] =
    useState<PullRequestState>('open');
  const [health, setHealth] = useState<PlatformGiteaHealth>();
  const [pullRequests, setPullRequests] = useState<PullRequest[]>([]);
  const [workflowRuns, setWorkflowRuns] = useState<WorkflowRun[]>([]);
  const [selectedPullRequest, setSelectedPullRequest] = useState<PullRequest>();
  const [actionDialog, setActionDialog] = useState<{
    action: PullRequestAction;
    pullRequest: PullRequest;
  }>();
  const [actionReason, setActionReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [workflowRunsError, setWorkflowRunsError] = useState<string>();

  const fetchJson = useCallback(
    async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
      const baseUrl = await discoveryApi.getBaseUrl('platform-gitea');
      const response = await fetchApi.fetch(`${baseUrl}${path}`, init);
      const text = await response.text();
      const payload = text ? JSON.parse(text) : {};

      if (!response.ok) {
        throw new Error(
          payload?.error?.message ?? payload?.decision?.reason ?? text,
        );
      }

      return payload as T;
    },
    [discoveryApi, fetchApi],
  );

  const postJson = useCallback(
    async <T,>(path: string, payload: object): Promise<T> =>
      fetchJson<T>(path, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }),
    [fetchJson],
  );

  const loadData = useCallback(async () => {
    if (!repo) {
      return;
    }

    setLoading(true);
    setError(undefined);
    setWorkflowRunsError(undefined);

    try {
      const [healthResponse, pullsResponse, workflowRunsResponse] =
        await Promise.allSettled([
          fetchJson<PlatformGiteaHealth>('/health'),
          fetchJson<{ items?: PullRequest[] }>(
            `/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(
              repo.repo,
            )}/pulls?state=${pullRequestState}`,
          ),
          fetchJson<{ items?: WorkflowRun[] }>(
            `/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(
              repo.repo,
            )}/actions/runs`,
          ),
        ]);

      if (healthResponse.status === 'fulfilled') {
        setHealth(healthResponse.value);
      }

      if (pullsResponse.status === 'fulfilled') {
        setPullRequests(pullsResponse.value.items ?? []);
      } else {
        throw new Error(
          `Pull Requests request failed: ${errorMessage(pullsResponse.reason)}`,
        );
      }

      if (workflowRunsResponse.status === 'fulfilled') {
        setWorkflowRuns(workflowRunsResponse.value.items ?? []);
      } else {
        setWorkflowRuns([]);
        setWorkflowRunsError(errorMessage(workflowRunsResponse.reason));
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [fetchJson, pullRequestState, repo]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openPullRequestDetail = useCallback(
    async (pullRequest: PullRequest) => {
      if (!repo) {
        return;
      }

      setDetailLoading(true);
      setError(undefined);

      try {
        const detail = await fetchJson<PullRequest>(
          `/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(
            repo.repo,
          )}/pulls/${pullRequest.index}`,
        );
        setSelectedPullRequest(detail);
      } catch (e) {
        setError(errorMessage(e));
      } finally {
        setDetailLoading(false);
      }
    },
    [fetchJson, repo],
  );

  const openPullRequestAction = useCallback(
    (action: PullRequestAction, pullRequest: PullRequest) => {
      setActionDialog({ action, pullRequest });
      setActionReason('');
    },
    [],
  );

  const performPullRequestAction = useCallback(async () => {
    if (!repo || !actionDialog) {
      return;
    }

    setActionLoading(true);
    setError(undefined);

    try {
      const actionPath =
        actionDialog.action === 'request_changes'
          ? 'request-changes'
          : actionDialog.action;

      await postJson(
        `/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(
          repo.repo,
        )}/pulls/${actionDialog.pullRequest.index}/${actionPath}`,
        { reason: actionReason.trim() },
      );
      setActionDialog(undefined);
      setActionReason('');
      await loadData();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setActionLoading(false);
    }
  }, [actionDialog, actionReason, loadData, postJson, repo]);

  const pullRequestColumns: TableColumn<PullRequest>[] = [
    {
      title: '#',
      field: 'index',
      width: '5%',
    },
    {
      title: 'Title',
      render: pullRequest =>
        pullRequest.html_url ? (
          <Link to={pullRequest.html_url}>{pullRequest.title}</Link>
        ) : (
          pullRequest.title
        ),
    },
    {
      title: 'Author',
      render: pullRequest => pullRequest.user?.login ?? '-',
    },
    {
      title: 'Branch',
      render: pullRequest =>
        `${pullRequest.head?.ref ?? '-'} -> ${pullRequest.base?.ref ?? '-'}`,
    },
    {
      title: 'State',
      render: pullRequest => <StatusChip value={pullRequest.state} />,
    },
    {
      title: 'Review',
      render: pullRequest => (
        <ReviewStatusChips status={pullRequest.reviewStatus} />
      ),
    },
    {
      title: 'Updated',
      render: pullRequest => formatDate(pullRequest.updated_at),
    },
    {
      title: 'Detail',
      sorting: false,
      render: pullRequest => (
        <Button
          size="small"
          startIcon={<VisibilityIcon />}
          disabled={detailLoading}
          onClick={() => openPullRequestDetail(pullRequest)}
        >
          Detail
        </Button>
      ),
    },
    {
      title: 'Actions',
      sorting: false,
      render: pullRequest => {
        const baseDisabled =
          pullRequest.state !== 'open' ||
          !health?.actionsEnabled ||
          actionLoading;
        const approveDisabled =
          baseDisabled || Boolean(pullRequest.reviewStatus?.approved);
        const requestChangeDisabled =
          baseDisabled || Boolean(pullRequest.reviewStatus?.changesRequested);

        return (
          <Grid container spacing={1} wrap="nowrap" alignItems="center">
            <Grid item>
              <Tooltip
                title={
                  pullRequest.reviewStatus?.approved
                    ? 'Pull request already approved'
                    : 'Approve pull request'
                }
              >
                <span>
                  <IconButton
                    aria-label="Approve pull request"
                    size="small"
                    color="primary"
                    disabled={approveDisabled}
                    onClick={() =>
                      openPullRequestAction('approve', pullRequest)
                    }
                  >
                    <CheckCircleIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </Grid>
            <Grid item>
              <Tooltip
                title={
                  pullRequest.reviewStatus?.changesRequested
                    ? 'Changes already requested'
                    : 'Request change'
                }
              >
                <span>
                  <IconButton
                    aria-label="Request change"
                    size="small"
                    color="secondary"
                    disabled={requestChangeDisabled}
                    onClick={() =>
                      openPullRequestAction('request_changes', pullRequest)
                    }
                  >
                    <RateReviewIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </Grid>
          </Grid>
        );
      },
    },
  ];

  const workflowRunColumns: TableColumn<WorkflowRun>[] = [
    {
      title: 'ID',
      field: 'id',
      width: '10%',
    },
    {
      title: 'Name',
      render: run =>
        run.html_url ? (
          <Link to={run.html_url}>{run.name ?? run.id}</Link>
        ) : (
          run.name
        ),
    },
    {
      title: 'Status',
      render: run => <StatusChip value={run.conclusion ?? run.status} />,
    },
    {
      title: 'Event',
      render: run => run.event ?? '-',
    },
    {
      title: 'Branch',
      render: run => run.head_branch ?? '-',
    },
    {
      title: 'Updated',
      render: run => formatDate(run.updated_at ?? run.created_at),
    },
  ];

  if (!repo) {
    return (
      <WarningPanel
        severity="info"
        title="Gitea repository not found"
        message="Add gitea.com/project-slug or backstage.io/source-location to this entity."
      />
    );
  }

  return (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <InfoCard
          title={`Gitea - ${repo.owner}/${repo.repo}`}
          subheader="Pull Requests and Workflow Runs"
        >
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12}>
              <Tabs
                value={activeTab}
                indicatorColor="primary"
                textColor="primary"
                onChange={(_, value: ContentTab) => setActiveTab(value)}
              >
                <Tab label="Pull Requests" value="pull-requests" />
                <Tab label="Workflow Runs" value="workflow-runs" />
              </Tabs>
            </Grid>
            <Grid item>
              <Button
                size="small"
                startIcon={<RefreshIcon />}
                onClick={loadData}
                disabled={loading}
              >
                Refresh
              </Button>
            </Grid>
            {health?.mockMode && (
              <Grid item>
                <Chip size="small" label="mock mode" />
              </Grid>
            )}
            {health && !health.actionsEnabled && (
              <Grid item>
                <Chip size="small" label="actions disabled" />
              </Grid>
            )}
          </Grid>
        </InfoCard>
      </Grid>
      {error && (
        <Grid item xs={12}>
          <WarningPanel
            severity="error"
            title="Gitea request failed"
            message={error}
          />
        </Grid>
      )}
      {workflowRunsError && (
        <Grid item xs={12}>
          <WarningPanel
            severity="warning"
            title="Workflow runs unavailable"
            message={workflowRunsError}
          />
        </Grid>
      )}
      {loading ? (
        <Grid item xs={12}>
          <Progress />
        </Grid>
      ) : (
        <>
          {activeTab === 'pull-requests' && (
            <>
              <Grid item xs={12}>
                <ButtonGroup size="small" color="primary">
                  {(['open', 'closed', 'all'] as PullRequestState[]).map(
                    option => (
                      <Button
                        key={option}
                        variant={
                          pullRequestState === option ? 'contained' : 'outlined'
                        }
                        onClick={() => setPullRequestState(option)}
                      >
                        {option}
                      </Button>
                    ),
                  )}
                </ButtonGroup>
              </Grid>
              <Grid item xs={12}>
                <Table
                  title="Pull Requests"
                  columns={pullRequestColumns}
                  data={pullRequests}
                  options={{
                    paging: false,
                    search: false,
                    padding: 'dense',
                  }}
                />
              </Grid>
            </>
          )}
          {activeTab === 'workflow-runs' && (
            <Grid item xs={12}>
              <Table
                title="Workflow Runs"
                columns={workflowRunColumns}
                data={workflowRuns}
                options={{
                  paging: false,
                  search: false,
                  padding: 'dense',
                }}
              />
            </Grid>
          )}
        </>
      )}
      <PullRequestDetailDialog
        pullRequest={selectedPullRequest}
        onClose={() => setSelectedPullRequest(undefined)}
      />
      <PullRequestActionDialog
        action={actionDialog?.action}
        pullRequest={actionDialog?.pullRequest}
        reason={actionReason}
        loading={actionLoading}
        onReasonChange={setActionReason}
        onClose={() => setActionDialog(undefined)}
        onConfirm={performPullRequestAction}
      />
    </Grid>
  );
}
