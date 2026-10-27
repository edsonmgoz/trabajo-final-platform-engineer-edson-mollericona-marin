import { useState } from 'react';
import {
  Button,
  ButtonGroup,
  Grid,
  Tab,
  Tabs,
} from '@material-ui/core';
import { useEntity } from '@backstage/plugin-catalog-react';
import { EntityContentBlueprint } from '@backstage/plugin-catalog-react/alpha';
import {
  compatWrapper,
  convertLegacyPlugin,
} from '@backstage/core-compat-api';
import {
  backstagePluginPrometheusPlugin,
  EntityPrometheusAlertCard,
  PrometheusGraph,
} from '@roadiehq/backstage-plugin-prometheus';

const stepSeconds = 60;

const rangeOptions = [
  { key: '10m', label: '10m', range: { minutes: 10 } },
  { key: '15m', label: '15m', range: { minutes: 15 } },
  { key: '30m', label: '30m', range: { minutes: 30 } },
  { key: '1h', label: '1h', range: { hours: 1 } },
  { key: '3h', label: '3h', range: { hours: 3 } },
] as const;

type MetricsSubTab = 'traffic' | 'errors' | 'saturation' | 'alerts';

function serviceNameFromEntity(entity: ReturnType<typeof useEntity>['entity']) {
  return (
    entity.metadata.annotations?.['backstage.io/kubernetes-id'] ??
    entity.metadata.name
  );
}

function namespaceFromEntity(entity: ReturnType<typeof useEntity>['entity']) {
  return (
    entity.metadata.annotations?.['backstage.io/kubernetes-namespace'] ??
    'default'
  );
}

function GoldenMetricsCard() {
  const { entity } = useEntity();
  const service = serviceNameFromEntity(entity);
  const ns = namespaceFromEntity(entity);
  const podRegex = `${service}.*`;
  const [selectedRangeKey, setSelectedRangeKey] = useState('1h');
  const [selectedSubTab, setSelectedSubTab] =
    useState<MetricsSubTab>('traffic');
  const selectedRange =
    rangeOptions.find(option => option.key === selectedRangeKey) ??
    rangeOptions[3];

  const latencyP95 = `
histogram_quantile(
  0.95,
  sum by (destination_service_name, le) (
    rate(istio_request_duration_milliseconds_bucket{
      reporter="destination",
      destination_service_name=~"${service}.*"
    }[5m])
  )
)`.replace(/\s+/g, ' ');

  const tps = `
sum by (destination_service_name) (
  rate(istio_requests_total{
    reporter="destination",
    destination_service_name=~"${service}.*"
  }[5m])
)`.replace(/\s+/g, ' ');

  const errorRateByCode = `
sum by (destination_service_name, response_code) (
  rate(istio_requests_total{
    reporter="destination",
    destination_service_name=~"${service}.*",
    response_code=~"4..|5.."
  }[5m])
)`.replace(/\s+/g, ' ');

  const cpuSaturation = `
sum by (pod) (
  rate(container_cpu_usage_seconds_total{
    namespace="${ns}",
    pod=~"${podRegex}",
    container!="",
    image!=""
  }[5m])
)
/
sum by (pod) (
  kube_pod_container_resource_requests{
    namespace="${ns}",
    pod=~"${podRegex}",
    resource="cpu"
  }
)`.replace(/\s+/g, ' ');

  return (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <ButtonGroup size="small" color="primary">
          {rangeOptions.map(option => (
            <Button
              key={option.key}
              variant={selectedRange.key === option.key ? 'contained' : 'outlined'}
              onClick={() => setSelectedRangeKey(option.key)}
            >
              {option.label}
            </Button>
          ))}
        </ButtonGroup>
      </Grid>
      <Grid item xs={12}>
        <Tabs
          value={selectedSubTab}
          indicatorColor="primary"
          textColor="primary"
          onChange={(_, value: MetricsSubTab) => setSelectedSubTab(value)}
        >
          <Tab label="Traffic" value="traffic" />
          <Tab label="Errors" value="errors" />
          <Tab label="Saturation" value="saturation" />
        </Tabs>
      </Grid>
      {selectedSubTab === 'traffic' && (
        <>
          <Grid item xs={12} md={6}>
            <PrometheusGraph
              key={`latency-${selectedRange.key}`}
              title={`Latency p95 - ${service}`}
              query={latencyP95}
              range={selectedRange.range}
              step={stepSeconds}
              graphType="line"
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <PrometheusGraph
              key={`tps-${selectedRange.key}`}
              title={`TPS - ${service}`}
              query={tps}
              range={selectedRange.range}
              step={stepSeconds}
              graphType="line"
            />
          </Grid>
        </>
      )}
      {selectedSubTab === 'errors' && (
        <Grid item xs={12}>
          <PrometheusGraph
            key={`errors-${selectedRange.key}`}
            title={`Error rate by code - ${service}`}
            query={errorRateByCode}
            range={selectedRange.range}
            step={stepSeconds}
            dimension="response_code"
            graphType="line"
          />
        </Grid>
      )}
      {selectedSubTab === 'saturation' && (
        <Grid item xs={12}>
          <PrometheusGraph
            key={`cpu-saturation-${selectedRange.key}`}
            title={`CPU saturation - ${service}`}
            query={cpuSaturation}
            range={selectedRange.range}
            step={stepSeconds}
            graphType="area"
          />
        </Grid>
      )}
      {selectedSubTab === 'alerts' && (
        <Grid item xs={12}>
          <EntityPrometheusAlertCard
            showLabels
            showAnnotations
            showInactiveAlerts
          />
        </Grid>
      )}
    </Grid>
  );
}

function MetricsContent() {
  return (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <GoldenMetricsCard />
      </Grid>
    </Grid>
  );
}

const prometheusMetricsContent = EntityContentBlueprint.make({
  name: 'metrics',
  params: {
    path: '/metrics',
    title: 'Metrics',
    group: 'observability',
    filter: 'kind:component',
    loader: async () => compatWrapper(<MetricsContent />),
  },
});

export const prometheusModule: ReturnType<typeof convertLegacyPlugin> = convertLegacyPlugin(
  backstagePluginPrometheusPlugin,
  {
    extensions: [prometheusMetricsContent],
  },
);
