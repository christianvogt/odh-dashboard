import { TrustyAIKind } from '../../../../types';
import { proxyService } from '../proxy';

export default proxyService<TrustyAIKind>(
  {
    apiGroup: 'trustyai.opendatahub.io',
    apiVersion: 'v1alpha1',
    kind: 'TrustyAIService',
    plural: 'trustyaiservices',
  },
  {
    port: 8443,
    suffix: '-tls',
  },
  {
    host: process.env.TRUSTYAI_TAIS_SERVICE_HOST,
    port: process.env.TRUSTYAI_TAIS_SERVICE_PORT,
  },
  (resource) =>
    !!resource.status?.conditions?.find((c) => c.type === 'Available' && c.status === 'True'),
);
