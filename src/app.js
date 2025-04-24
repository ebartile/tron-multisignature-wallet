import path from "path";
import fs from "fs";
import https from "https";
import { SSL_OP_NO_TLSv1 } from "constants";
import express from "express";
import graceful from "node-graceful";
import http from "http";
import morgan from "morgan";
import log from "npmlog";
import { setupRoutes } from "./routes.js";
import { createTronWeb, injectHelper } from "./tronweb.js";
import { getConfig } from "./config.js";
import { checkPreconditions, isValidString } from "./utils.js";
import { createStorage } from "./storage.js";
import { startEvents } from "./events.js";
/**
 * Set up the logging middleware provided by morgan
 */
function setupLogging(app, config) {
    let middleware = morgan("combined");
    if (config.logFile) {
        const logPath = path.join(config.storagePath, config.logFile);
        middleware = morgan("combined", {
            stream: fs.createWriteStream(logPath, { flags: "a" })
        });
    }
    app.use(middleware);
}
/**
 * Create an HTTP server configured for accepting HTTPS connections
 */
async function createHttpsServer(app, config) {
    const fullPath = (sub) => path.join(config.storagePath, sub);
    const keyPromise = fs.promises.readFile(fullPath(config.keyPath), "utf8");
    const crtPromise = fs.promises.readFile(fullPath(config.crtPath), "utf8");
    const [key, cert] = await Promise.all([keyPromise, crtPromise]);
    return https.createServer({ secureOptions: SSL_OP_NO_TLSv1, key, cert }, app);
}
/**
 * Create an HTTP server configured for accepting plain old HTTP connections
 */
function createHttpServer(app) {
    return http.createServer(app);
}
/**
 * Create a startup function which will run with server initialization
 */
function startup(config) {
    const baseUri = getBaseUri(config);
    return function () {
        log.info("SERVER", "Tron-API running");
        log.info("SERVER", `URL: ${baseUri}`);
    };
}
/**
 * Helper function to determine whether we should run the server over TLS or not
 */
function isHttps(config) {
    return isValidString(config.keyPath) && isValidString(config.crtPath);
}
/**
 * Create either HTTP or HTTPS server
 */
async function createServer(config, app) {
    return isHttps(config)
        ? await createHttpsServer(app, config)
        : createHttpServer(app);
}
/**
 * Get Base URI
 */
function getBaseUri(config) {
    const protocol = isHttps(config) ? "https" : "http";
    return `${protocol}://${config.bind}:${config.port}`;
}
/**
 * Start application and its dependencies
 */
async function startApp(config, tronWeb, storage) {
    const expressApp = express();
    setupLogging(expressApp, config);
    await startEvents(expressApp, tronWeb, storage);
    injectHelper(expressApp, tronWeb, storage);
    setupRoutes(expressApp, config);
    return expressApp.use(function (req, res) {
        res.status(404).send("Unknown API request.");
    });
}
const config = getConfig();
checkPreconditions(config);
const tronWeb = createTronWeb(config);
const storage = createStorage(config);
await tronWeb.loadChainParameters();
await storage.loadDatabase(tronWeb);
const app = await startApp(config, tronWeb, storage);
const server = await createServer(config, app);
const { port, bind } = config;
server.listen(port, bind, startup(config));
graceful.captureExceptions = true;
graceful.exitOnDouble = false;
graceful.captureRejections = true;
graceful.on("exit", (signal, error) => {
    server.close(() => log.info("SERVER", "Closed"));
    if (error)
        log.error("SERVER", error);
});
