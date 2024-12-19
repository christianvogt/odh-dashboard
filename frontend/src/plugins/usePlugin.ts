import React from 'react';
import useFetchState from '~/utilities/useFetchState';

type PluginNames = 'modelRegistry';

const usePlugin = (name: PluginNames) => {
  const fetchPlugin = React.useCallback(async () => {
    await fetch(`/api/plugins/${name}`);
  }, [name]);
  return useFetchState(fetchPlugin, undefined);
};

export default usePlugin;
