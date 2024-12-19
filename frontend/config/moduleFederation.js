// const { ModuleFederationPlugin } = require('@module-federation/enhanced/webpack');
const ModuleFederationPlugin = require('webpack').container.ModuleFederationPlugin;
const {
  NativeFederationTypeScriptHost,
} = require('@module-federation/native-federation-typescript/webpack');

const getRemoteLoaderPromise = (scope) => {
  return `promise new Promise((resolve, reject) => {
    let intervalId;

    const waitForHostToLoadAndExecuteRemoteLoader = () => {
      if (!window.odh) {
        return;
      }

      clearInterval(intervalId);

      window.odh.get('./remoteLoader').then((factory) => {
        const remoteLoader = factory();

        remoteLoader.default('${scope}').then(resolve).catch(reject);
      });
    }

    intervalId = setInterval(waitForHostToLoadAndExecuteRemoteLoader, 10);
  })`;
};

const deps = require('../package.json').dependencies;

const moduleFederationConfig = (isNativeFederationTypeScriptHost = false) => ({
  name: 'odh',
  filename: 'remoteEntry.js',
  remotes: isNativeFederationTypeScriptHost ? {
    '@mf/model-registry': 'modelRegistry@http://localhost:9000/remoteEntry.js',
  } : {
    // '@mf/model-registry': 'modelRegistry@http://localhost:9000/remoteEntry.js',
    '@mf/model-registry': getRemoteLoaderPromise('modelRegistry')
  },
  shared: {
    react: { singleton: true, eager: true, requiredVersion: deps.react },
    'react-dom': { singleton: true, eager: true, requiredVersion: deps['react-dom'] },
    'react-router': { singleton: true, eager: true, requiredVersion: deps['react-router'] },
    'react-router-dom': { singleton: true, eager: true, requiredVersion: deps['react-router-dom'] },
    // TODO list all shared dependencies here
  },
  exposes: {
    './api': './src/plugins/api',
    './remoteLoader': './src/plugins/remoteLoader',
  }
});

module.exports = {
  moduleFederationPlugins: [
    new ModuleFederationPlugin(moduleFederationConfig()),
    NativeFederationTypeScriptHost({ moduleFederationConfig: moduleFederationConfig(true) }),
  ],
};
