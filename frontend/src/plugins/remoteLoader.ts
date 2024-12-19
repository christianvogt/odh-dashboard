import { fetchDashboardConfig } from '~/services/dashboardConfigService';

// const fetchDashboardConfig = () =>
//   Promise.resolve({
//     spec: {
//       plugins: [
//         {
//           alias: 'modelRegistry',
//           serviceUrl: 'http://localhost:9000',
//           frontendUrl: 'http://localhost:9000/remoteEntry.js',
//         },
//       ],
//     },
//   });

// yaml:

// plugins:
// - alias: modelRegistry
//   authorize: false
//   frontendUrl: 'http://localhost:9000/remoteEntry.js'
//   serviceUrl: 'http://localhost:9000'

const remoteLoader = (scope: string): Promise<unknown> =>
  new Promise((resolve, reject) => {
    if (!(scope in window)) {
      const remoteScript = document.querySelector<HTMLScriptElement>(
        `[data-webpack-mf="${scope}"]`,
      );

      const onload = async () => {
        // resolve promise so marking remote as loaded
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        //@ts-ignore
        resolve(window[scope]);
      };

      if (remoteScript) {
        remoteScript.onload = onload;
        remoteScript.onerror = reject;
      } else {
        fetchDashboardConfig().then((dashboardConfig) => {
          const pluginConfig = dashboardConfig.spec.plugins?.find((p) => p.alias === scope);
          const pluginUrl = pluginConfig?.frontendUrl;
          if (!pluginUrl) {
            reject(new Error(`Plugin ${scope} not found.`));
            return;
          }

          const script = document.createElement('script');
          script.setAttribute('data-webpack-mf', scope);
          script.async = true;
          script.type = 'text/javascript';
          script.src = pluginUrl;
          script.onload = onload;
          script.onerror = () => {
            document.head.removeChild(script);
            reject(new Error(`[${scope}] error loading remote: ${pluginUrl}`));
          };

          document.head.appendChild(script);
        });
      }
    } else {
      // remote already loaded
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      //@ts-ignore
      resolve(window[scope]);
    }
  });

export default remoteLoader;
