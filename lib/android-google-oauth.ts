/** @deprecated Use `@/lib/native-oauth` */
export {
  parseNativeOAuthCallback,
  startNativeGoogleOAuth as startAndroidGoogleOAuth,
  completeNativeOAuthFromDeepLink as completeAndroidGoogleOAuthFromDeepLink,
  type NativeOAuthCallbackParams,
} from "@/lib/native-oauth";
