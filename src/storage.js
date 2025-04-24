import path from "path";
import fs from "fs";
import { mkdirp } from "mkdirp";
import { globSync } from "glob";
import mongoose from "mongoose";
import WalletSchema from "./models/wallet.js";
import AddressSchema from "./models/address.js";
import ConfigSchema from "./models/config.js";

class Storage {
    constructor(config) {
        this.mongoose = null;
        this.Wallet = null;
        this.Address = null;
        this.Config = null;
        this.config = config;
    }
    exists(filename) {
        return fs.existsSync(this.path(filename));
    }
    save(filename, content) {
        const filePath = this.path(filename);
        mkdirp.sync(path.dirname(filePath));
        fs.writeFileSync(filePath, JSON.stringify(content), "utf-8");
    }
    load(filename) {
        const filePath = this.path(filename);
        return JSON.parse(fs.readFileSync(filePath, "utf8"));
    }
    files(pattern) {
        return globSync(pattern, {
            cwd: this.config.storagePath
        });
    }
    deleteDirectory(directory, recursive = false) {
        fs.rmdirSync(this.path(directory), { recursive });
    }
    delete(filename) {
        fs.unlinkSync(this.path(filename));
    }
    path(subPath) {
        return path.join(this.config.storagePath, subPath);
    }
    async loadDatabase(tronWeb) {
        if (this.mongoose === null) {
            this.mongoose = await mongoose.connect(this.config.mongodbUrl, {
                appName: this.config.mongodbName,
                dbName: this.config.mongodbName,
                autoIndex: false
            });
            this.Wallet = await WalletSchema(this.mongoose, tronWeb);
            this.Address = await AddressSchema(this.mongoose, tronWeb);
            this.Config = await ConfigSchema(this.mongoose, tronWeb);
        }
    }
}
/**
 * Create an instance of storage
 */
function createStorage(config) {
    return new Storage(config);
}
export { createStorage };
