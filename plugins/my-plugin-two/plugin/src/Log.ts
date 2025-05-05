export class Log {
  static log(str: string) {
    console.log(`\tmy-plugin-two: ${str}`)
  }

  static error(str: string) {
    console.error(`\tmy-plugin-two: ${str}`)
  }
}
