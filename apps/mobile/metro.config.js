const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// @react-three/fiber/native requires `three`, which resolves to the deprecated
// CommonJS entry in three@0.187. That entry calls Node's `process.emitWarning`,
// which does not exist in Expo Go. Resolve the bare package to the ESM build
// instead; Metro can transform it and it avoids the Node-only shim entirely.
const threeEsmPath = path.resolve(path.dirname(require.resolve('three')), 'three.module.js');

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'three') {
    return context.resolveRequest(context, threeEsmPath, platform);
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
