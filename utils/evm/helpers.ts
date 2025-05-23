// import { ethers } from "ethers"

// export const evmHelpers = {
//   toWei: (value: string, units: ethers.BigNumberish) => ethers.utils.parseUnits(value, units),
//   // This converts a string representation from a value to a number of units, based on the number of decimals passed in
//   toDecimal: (value: string, decimals: number) => ethers.utils.parseUnits(value, decimals),
//   hexlify: ethers.utils.hexlify,
//   hexStripZeros: ethers.utils.hexStripZeros,
//   bigNumberify: ethers.BigNumber.from,
//   hexToNumberString: (num: number) =>
//     ethers.utils.formatUnits(ethers.BigNumber.from(num), "wei").replace(".0", ""),
//   toChecksumAddress: ethers.utils.getAddress,
//   fromWei: (num: ethers.BigNumber, units: ethers.BigNumberish) => {
//     return ethers.utils.formatUnits(ethers.BigNumber.from(num), units).replace(/\.0$/, "")
//   },
//   // This converts a string representation from a unit value to a higher base
//   fromDecimal: (num: string, decimals: number, precision?: number) => {
//     const stringResult = ethers.utils
//       .formatUnits(ethers.BigNumber.from(num), decimals)
//       .replace(/\.0$/, "")
//     if (precision === undefined) {
//       return stringResult
//     } else {
//       return parseFloat(stringResult).toFixed(precision)
//     }
//   },
//   isInfiniteKeys: (value: string) => {
//     return ethers.BigNumber.from(value).eq(ethers.constants.MaxUint256)
//   },
//   isInfiniteDuration: (value: string) => {
//     return ethers.BigNumber.from(value).eq(ethers.constants.MaxUint256)
//   },
//   toNumber: (value: string) => {
//     return ethers.BigNumber.from(value).toNumber()
//   },
//   toRpcResultNumber: (value: number) => {
//     const num = ethers.utils.hexlify(ethers.BigNumber.from(value))
//     return ethers.utils.hexZeroPad(num, 32)
//   },
//   toRpcResultString: (str: string) => {
//     return str
//   },
//   utf8ToHex: (str: string) => ethers.utils.hexlify(str.length ? ethers.utils.toUtf8Bytes(str) : 0),
//   sha3: ethers.utils.keccak256,
//   verifyMessage: ethers.utils.verifyMessage,

//   randomHex: (length: number) => {
//     const randomBytes = ethers.utils.randomBytes(length)
//     const randomHex = ethers.utils.hexlify(randomBytes)
//     return randomHex
//   },
// }
