/**
 * Expo config plugin for copying NSE to XCode
 */

import { ConfigPlugin } from '@expo/config-plugins';
import { NSEPluginProps } from '../types/types';
import { withServiceExtensionIos } from './withServiceExtensionIos';
import { validatePluginProps } from '../support/helpers';

const withServiceExtension: ConfigPlugin<NSEPluginProps> = (config, props) => {
  // if props are undefined, throw error
  if (!props) {
    throw new Error(
      'You are trying to use the Expo NSE plugin without any props. Property "mode" is required. Please see https://github.com/nikwebr/expo-notification-service-extension-plugin for more info.'
    );
  }

  validatePluginProps(props);

  config = withServiceExtensionIos(config, props);

  return config;
};

export default withServiceExtension;
