/**
 * react-native-bootsplash was causing issues with expo fingerprint runtime version
 * and we were not even using the lib correctly anyway. Will reuse once we need it for Android.
 */

// import RNBootSplash from "react-native-bootsplash"

// export function preventSplashScreenAutoHide() {
//   // RNBootSplash keeps the splash screen visible by default until hide() is called
//   return Promise.resolve()
// }

// export const hideSplashScreen = async () => {
//   await RNBootSplash.hide({ fade: true })
// }
