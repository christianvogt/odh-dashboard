import httpProxy from '@fastify/http-proxy';
import { KubeFastifyInstance, Plugin } from '../../../types';
import { checkRequestLimitExceeded, getParam, notFoundError, setParam } from '../../../utils/proxy';
import { getDashboardConfig } from '../../../utils/resourceUtils';
import { getDirectCallOptions } from '../../../utils/directCallUtils';
import { getAccessToken } from '../../../utils/directCallUtils';

// TODO this cannot be hardcoded
// const pluginsUpstreams: Record<string, undefined | string> = {
//   modelRegistry: 'http://localhost:9000',
// };

export default async (fastify: KubeFastifyInstance): Promise<void> =>
  fastify.register(httpProxy, {
    upstream: '',
    rewritePrefix: '',
    prefix: ':plugin',
    replyOptions: {
      // preHandler must set the `upstream` param
      getUpstream: (request) => getParam(request, 'upstream'),
    },
    preHandler: (request, reply, done) => {
      (async () => {
        if (checkRequestLimitExceeded(request, fastify, reply)) {
          return;
        }

        const plugin = getParam(request, 'plugin');
        const dashboardConfig = getDashboardConfig();
        console.log('dashboardConfig', dashboardConfig);
        const pluginConfig: Plugin | undefined = dashboardConfig.spec.plugins?.find(
          (p) => p.alias === plugin,
        );

        if (!pluginConfig) {
          done(notFoundError('Plugin', plugin, undefined, 'plugin unavailable'));
          return;
        }

        if (pluginConfig.authorize) {
          const requestOptions = await getDirectCallOptions(fastify, request, '');
          const token = getAccessToken(requestOptions);
          request.headers.authorization = `Bearer ${token}`;
        }

        const upstream = pluginConfig.serviceUrl;
        setParam(request, 'upstream', upstream);
        fastify.log.info(`Proxy ${request.method} plugin request ${request.url} to ${upstream}`);
        done();
      })();
    },
  });
