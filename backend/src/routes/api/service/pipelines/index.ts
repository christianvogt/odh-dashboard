import { DSPipelineKind } from '../../../../types';
import { proxyService } from '../proxy';

export default proxyService<DSPipelineKind>(
  {
    apiGroup: 'datasciencepipelinesapplications.opendatahub.io',
    apiVersion: 'v1alpha1',
    kind: 'DataSciencepipelinesApplication',
    plural: 'datasciencepipelinesapplications',
  },
  {
    port: 8443,
    prefix: 'ds-pipeline-',
  },
  {
    host: process.env.DS_PIPELINE_DSPA_SERVICE_HOST,
    port: process.env.DS_PIPELINE_DSPA_SERVICE_PORT,
  },
  (resource) =>
    !!resource.status?.conditions?.find((c) => c.type === 'APIServerReady' && c.status === 'True'),
);
