import { defaultTo } from "lodash-es";

function readEnv(name, defaultValue) {
    return defaultTo(process.env[name], defaultValue);
}

const getConfig = () => ({
    port: readEnv("TRON_PORT", 6000),
    bind: readEnv("TRON_BIND", "localhost"),
    storagePath: readEnv("TRON_STORAGE_PATH"),
    apiHost: readEnv("TRON_API_HOST"),
    apiHeader: readEnv("TRON_API_HEADER", "TRON-PRO-API-KEY"),
    apiKey: readEnv("TRON_API_KEY"),
    mongodbUrl: readEnv("TRON_MONGODB_URL"),
    mongodbName: readEnv("TRON_MONGODB_NAME"),
    logFile: readEnv("TRON_LOGFILE"),
    keyPath: readEnv("TRON_KEYPATH"),
    crtPath: readEnv("TRON_CRTPATH")
});

export { getConfig };
