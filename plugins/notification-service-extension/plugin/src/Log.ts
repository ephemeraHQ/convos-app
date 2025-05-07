export class Log {
  static log(str: string) {
    console.log(`\tnotification-service-extension: ${str}`)
  }

  static error(str: string) {
    console.error(`\tnotification-service-extension: ${str}`)
  }
}
