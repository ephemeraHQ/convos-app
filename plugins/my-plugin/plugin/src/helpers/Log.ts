export class Log {
  static log(str: string) {
    console.log(`\texpo-notification-service-extension-plugin: ${str}`)
  }

  static error(str: string) {
    console.error(`\texpo-notification-service-extension-plugin: ${str}`)
  }
}
