"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Log = void 0;
class Log {
    static log(str) {
        console.log(`\tnotification-service-extension: ${str}`);
    }
    static error(str) {
        console.error(`\tnotification-service-extension: ${str}`);
    }
}
exports.Log = Log;
