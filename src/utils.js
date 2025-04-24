import fs from "fs";
import { isString, keyBy, map, mapValues, tap } from "lodash-es";
/**
 * Promise timeout
 */
export function timeout(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
/**
 * Check if value is string and not empty
 */
export function isValidString(value) {
    return isString(value) && value.length > 0;
}
/**
 * Check environment and other preconditions
 */
export function checkPreconditions(config) {
    if (!isValidString(config.storagePath) ||
        !fs.existsSync(config.storagePath)) {
        throw new Error("You need to specify a valid storage path.");
    }
    if (!isValidString(config.apiHost)) {
        throw new Error("You need to specify API Host");
    }
    if (!isValidString(config.apiHeader)) {
        throw new Error("You need to specify API Header");
    }
    if (!isValidString(config.apiKey)) {
        throw new Error("You need to specify API Key");
    }
    if (!isValidString(config.mongodbUrl) || !isValidString(config.mongodbName)) {
        throw new Error("You need to specify valid MongoDB details.");
    }
}
/**
 * Creates an HTTP error with a given message and code.
 */
export function httpError(message, code = 400) {
    const error = new Error(message);
    return tap(error, (error) => (error.status = code));
}
/**
 * Format error message
 */
export function formatError(error) {
    return error instanceof Error ? error.message : error;
}
export function pluck(data, value, key) {
    return key ? mapValues(keyBy(data, key), value) : map(data, value);
}
/**
 * Checks if a given transaction is a transfer contract.
 */
export function isTransferContract(transaction) {
    var _a, _b;
    return ((_b = (_a = transaction === null || transaction === void 0 ? void 0 : transaction.raw_data) === null || _a === void 0 ? void 0 : _a.contract[0]) === null || _b === void 0 ? void 0 : _b.type) === "TransferContract";
}
/**
 * Checks if a given transaction is a trigger smart contract.
 */
export function isTriggerSmartContract(transaction) {
    var _a, _b;
    return ((_b = (_a = transaction === null || transaction === void 0 ? void 0 : transaction.raw_data) === null || _a === void 0 ? void 0 : _a.contract[0]) === null || _b === void 0 ? void 0 : _b.type) === "TriggerSmartContract";
}
/**
 * Get null address
 */
export function nullAddress() {
    return "T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb";
}
/**
 * Estimate the bandwidth required for a transaction.
 */
export function estimateBandwidth(transaction) {
    let SIGNATURE_SIZE = 67;
    let DATA_HEX_PROTOBUF_EXTRA = 3;
    let MAX_RESULT_SIZE_IN_TX = 64;
    let length = MAX_RESULT_SIZE_IN_TX +
        transaction.raw_data_hex.length / 2 +
        DATA_HEX_PROTOBUF_EXTRA;
    return length + SIGNATURE_SIZE;
}
/**
 * Builds the parameters for contract.
 */
export function buildParameters(method, values) {
    if (values.length !== method.inputs.length) {
        throw new Error("Invalid values provided.");
    }
    return method.inputs.map((input, i) => ({
        type: input.type,
        value: values[i]
    }));
}
/**
 * Converts Ethereum address to a corresponding Tron hexadecimal address.
 */
export function toTronHexAddress(address) {
    return address.replace(/^(0x)/, "41").toLowerCase();
}
