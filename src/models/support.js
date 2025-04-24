import { Schema } from "mongoose";
import { httpError, isValidString } from "../utils.js";
import AES from "crypto-js/aes.js";
import encoder from "crypto-js/enc-utf8.js";
/**
 * Encrypted privateKey
 */
export const EncryptedSchema = new Schema({
    cipherText: {
        type: String,
        required: true
    }
}, { _id: false });
/**
 * Account sub-document schema for models
 */
export const AccountSchema = new Schema({
    address: {
        type: String,
        required: true
    },
    privateKey: {
        type: EncryptedSchema,
        required: true
    }
}, { _id: false });
export const TransferEventSchema = new Schema({
    webhook: {
        type: String,
        required: true
    }
}, { _id: false });
export const TokenTransferEventSchema = new Schema({
    contract: {
        type: String,
        required: true
    },
    webhook: {
        type: String,
        required: true
    }
}, { _id: false });
/**
 * Default DB collation
 */
export const defaultCollation = {
    locale: "en",
    numericOrdering: true
};
/**
 * Creates a new account using TronWeb.
 */
export async function createAccount(tronWeb) {
    const { address, privateKey } = await tronWeb.createAccount();
    return { address: address.base58, privateKey };
}
/**
 * Encrypts an account using AES encryption algorithm.
 */
export function encryptAccount(account, password) {
    if (!isValidString(password)) {
        throw httpError("Invalid password.");
    }
    const cipherText = AES.encrypt(account.privateKey, password);
    return {
        address: account.address,
        privateKey: {
            cipherText: cipherText.toString()
        }
    };
}
/**
 * Decrypts an encrypted account using the given password.
 */
export function decryptAccount(account, password) {
    if (!isValidString(password)) {
        throw httpError("Invalid password.");
    }
    const decrypted = AES.decrypt(account.privateKey.cipherText, password);
    const privateKey = decrypted.toString(encoder);
    if (!isValidString(privateKey)) {
        throw httpError("Decryption failed. The password may be incorrect.");
    }
    return { address: account.address, privateKey };
}
export function isValidAccount(value) {
    return (isValidString(value.address) &&
        isValidString(value.privateKey));
}
