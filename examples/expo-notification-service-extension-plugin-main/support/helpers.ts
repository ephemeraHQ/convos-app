import { NSE_PLUGIN_PROPS } from "../types/types";

export function validatePluginProps(props: any): void {
  // check the type of each property
  if (typeof props.mode !== "string") {
    throw new Error("NSE Expo Plugin: 'mode' must be a string.");
  }

  if (typeof props.iosNSEFilePath !== "string") {
    throw new Error("NSE Expo Plugin: 'iosNSEFilePath' must be a string.");
  }

  if (props.filtering && typeof props.filtering !== "boolean") {
    throw new Error("NSE Expo Plugin: 'filtering' must be a boolean.");
  }

  if (props.devTeam && typeof props.devTeam !== "string") {
    throw new Error("NSE Expo Plugin: 'devTeam' must be a string.");
  }

  if (props.iPhoneDeploymentTarget && typeof props.iPhoneDeploymentTarget !== "string") {
    throw new Error("NSE Expo Plugin: 'iPhoneDeploymentTarget' must be a string.");
  }

  // check for extra properties
  const inputProps = Object.keys(props);

  for (const prop of inputProps) {
    if (!NSE_PLUGIN_PROPS.includes(prop)) {
      throw new Error(`NSE Expo Plugin: You have provided an invalid property "${prop}" to the NSE Expo plugin.`);
    }
  }
}
