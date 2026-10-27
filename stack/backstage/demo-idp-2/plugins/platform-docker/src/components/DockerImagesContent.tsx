import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  ButtonGroup,
  Chip,
  Grid,
  IconButton,
  Tooltip,
} from "@material-ui/core";
import NavigateBeforeIcon from "@material-ui/icons/NavigateBefore";
import NavigateNextIcon from "@material-ui/icons/NavigateNext";
import OpenInNewIcon from "@material-ui/icons/OpenInNew";
import RefreshIcon from "@material-ui/icons/Refresh";
import {
  InfoCard,
  Link,
  Progress,
  Table,
  TableColumn,
  WarningPanel,
} from "@backstage/core-components";
import {
  discoveryApiRef,
  fetchApiRef,
  useApi,
} from "@backstage/core-plugin-api";
import { useEntity } from "@backstage/plugin-catalog-react";

type DockerRepository = {
  namespace: string;
  name: string;
};

type DockerTagImage = {
  architecture?: string;
  os?: string;
  variant?: string;
  size?: number;
  digest?: string;
};

type DockerTag = {
  name: string;
  tag_status?: string;
  full_size?: number;
  last_updated?: string;
  tag_last_pushed?: string;
  images?: DockerTagImage[];
};

type DockerTagsResponse = {
  count?: number;
  next?: string | null;
  previous?: string | null;
  results?: DockerTag[];
};

const pageSizeOptions = [10, 25, 50];

function parseDockerRepository(value?: string): DockerRepository | undefined {
  const parts = value?.split("/").filter(Boolean) ?? [];

  if (parts.length === 1) {
    return { namespace: "library", name: parts[0] };
  }

  if (parts.length === 2) {
    return { namespace: parts[0], name: parts[1] };
  }

  return undefined;
}

function dockerHubUrl(repository: DockerRepository, tag?: string) {
  const base =
    repository.namespace === "library"
      ? `https://hub.docker.com/_/${repository.name}`
      : `https://hub.docker.com/r/${repository.namespace}/${repository.name}`;

  return tag ? `${base}/tags?name=${encodeURIComponent(tag)}` : `${base}/tags`;
}

function formatDate(value?: string) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString();
}

function formatBytes(value?: number) {
  if (!value) {
    return "-";
  }

  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function platforms(tag: DockerTag) {
  const values = tag.images
    ?.map((image) =>
      [image.os, image.architecture, image.variant].filter(Boolean).join("/")
    )
    .filter(Boolean);

  return [...new Set(values)].join(", ") || "-";
}

function statusColor(value?: string): "default" | "primary" | "secondary" {
  const normalized = String(value ?? "").toLowerCase();

  if (["active", "success"].includes(normalized)) {
    return "primary";
  }

  if (["inactive", "failure", "failed"].includes(normalized)) {
    return "secondary";
  }

  return "default";
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function getDockerRepositoryFromEntity(
  entity: ReturnType<typeof useEntity>["entity"]
) {
  return parseDockerRepository(
    entity.metadata.annotations?.["docker.com/repository"]
  );
}

export function DockerImagesContent() {
  const { entity } = useEntity();
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);
  const repository = useMemo(
    () => getDockerRepositoryFromEntity(entity),
    [entity]
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [tags, setTags] = useState<DockerTag[]>([]);
  const [count, setCount] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [hasPreviousPage, setHasPreviousPage] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  const loadTags = useCallback(async () => {
    if (!repository) {
      return;
    }

    setLoading(true);
    setError(undefined);

    try {
      const proxyBaseUrl = await discoveryApi.getBaseUrl("proxy");
      const response = await fetchApi.fetch(
        `${proxyBaseUrl}/docker/v2/repositories/${encodeURIComponent(
          repository.namespace
        )}/${encodeURIComponent(
          repository.name
        )}/tags?page_size=${pageSize}&page=${page}`
      );
      const text = await response.text();
      const payload = text ? (JSON.parse(text) as DockerTagsResponse) : {};

      if (!response.ok) {
        throw new Error(text || `Docker Hub API ${response.status}`);
      }

      setTags(payload.results ?? []);
      setCount(payload.count ?? 0);
      setHasNextPage(Boolean(payload.next));
      setHasPreviousPage(Boolean(payload.previous));
    } catch (e) {
      setTags([]);
      setCount(0);
      setHasNextPage(false);
      setHasPreviousPage(false);
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [discoveryApi, fetchApi, page, pageSize, repository]);

  useEffect(() => {
    loadTags();
  }, [loadTags]);

  const columns: TableColumn<DockerTag>[] = [
    {
      title: "Tag",
      render: (tag) => (
        <Link to={repository ? dockerHubUrl(repository, tag.name) : "#"}>
          {tag.name}
        </Link>
      ),
    },
    {
      title: "Status",
      render: (tag) => (
        <Chip
          size="small"
          label={tag.tag_status ?? "unknown"}
          color={statusColor(tag.tag_status)}
        />
      ),
    },
    {
      title: "Platforms",
      render: (tag) => platforms(tag),
    },
    {
      title: "Size",
      render: (tag) => formatBytes(tag.full_size),
    },
    {
      title: "Last pushed",
      render: (tag) => formatDate(tag.tag_last_pushed ?? tag.last_updated),
    },
  ];

  if (!repository) {
    return (
      <WarningPanel title="Missing Docker repository annotation">
        Add docker.com/repository to this component.
      </WarningPanel>
    );
  }

  return (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <InfoCard
          title={`${repository.namespace}/${repository.name}`}
          action={
            <Tooltip title="Open Docker Hub">
              <IconButton
                size="small"
                href={dockerHubUrl(repository)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <OpenInNewIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          }
        >
          <Grid container spacing={2} alignItems="center">
            <Grid item>
              <ButtonGroup size="small" color="primary">
                {pageSizeOptions.map((option) => (
                  <Button
                    key={option}
                    variant={pageSize === option ? "contained" : "outlined"}
                    onClick={() => {
                      setPage(1);
                      setPageSize(option);
                    }}
                  >
                    {option}
                  </Button>
                ))}
              </ButtonGroup>
            </Grid>
            <Grid item>
              <Tooltip title="Previous page">
                <span>
                  <IconButton
                    size="small"
                    disabled={loading || !hasPreviousPage}
                    onClick={() =>
                      setPage((current) => Math.max(1, current - 1))
                    }
                  >
                    <NavigateBeforeIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Next page">
                <span>
                  <IconButton
                    size="small"
                    disabled={loading || !hasNextPage}
                    onClick={() => setPage((current) => current + 1)}
                  >
                    <NavigateNextIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Refresh">
                <span>
                  <IconButton
                    size="small"
                    disabled={loading}
                    onClick={loadTags}
                  >
                    <RefreshIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </Grid>
          </Grid>
        </InfoCard>
      </Grid>
      {error && (
        <Grid item xs={12}>
          <WarningPanel title="Docker tags request failed">
            {error}
          </WarningPanel>
        </Grid>
      )}
      {loading ? (
        <Grid item xs={12}>
          <Progress />
        </Grid>
      ) : (
        <Grid item xs={12}>
          <Table
            title={`Tags (${count})`}
            columns={columns}
            data={tags}
            options={{
              paging: false,
              search: false,
              padding: "dense",
            }}
          />
        </Grid>
      )}
    </Grid>
  );
}
