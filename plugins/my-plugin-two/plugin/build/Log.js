"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Log = void 0;
class Log {
    static log(str) {
        console.log(`\tmy-plugin-two: ${str}`);
    }
    static error(str) {
        console.error(`\tmy-plugin-two: ${str}`);
    }
}
exports.Log = Log;
