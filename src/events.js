import axios from "axios";
import axiosRetry, { isRetryableError } from "axios-retry";
import { flatten, get, has, includes, isFunction, isNil, isNumber, keyBy, map, tap } from "lodash-es";
import { formatError, isTransferContract, isTriggerSmartContract, timeout } from "./utils.js";
import graceful from "node-graceful";
import Token from "./token.js";
import log from "npmlog";
const client = axios.create();
axiosRetry(client, {
    shouldResetTimeout: true,
    retries: 15,
    retryDelay: (count) => {
        return Math.pow(2, count) * 1000;
    },
    retryCondition: (error) => {
        return isRetryableError(error);
    }
});
client.interceptors.request.use(function (config) {
    config.headers["Content-Type"] = "application/json";
    config.headers["Accept"] = "application/json";
    return config;
});
class BlockListener {
    constructor(tronWeb, storage) {
        this.handlers = {};
        this.blockTimer = 3000;
        this.blockRange = 10;
        this.tronWeb = tronWeb;
        this.storage = storage;
    }
    /**
     * Initializes the block listener
     */
    async initialize() {
        this.lastBlock = await this.tronWeb.getBlockNumber();
        const wallets = await this.storage.Wallet.find();
        wallets.forEach((wallet) => {
            this.registerHandler(wallet);
        });
    }
    /**
     * Registers a new handler for a given wallet.
     */
    registerHandler(wallet) {
        this.handlers[wallet._id] = new BlockHandler(wallet, this.tronWeb);
    }
    /**
     * Starts the listener.
     */
    async start() {
        if (isFunction(this.stop)) {
            this.lastBlock = await this.stop();
        }
        if (isNumber(this.lastBlock)) {
            this.stop = this.listen(this.lastBlock);
        }
    }
    /**
     * Listens for blocks starting from a specific block number.
     */
    listen(fromBlock) {
        let shouldListen = true;
        const listener = (async () => {
            let lastBlock = fromBlock;
            log.info("EVENTS", `Started block listener at: ${lastBlock}`);
            while (shouldListen) {
                try {
                    const nextBlock = lastBlock + 1;
                    const blocks = await this.getBlocks(nextBlock, nextBlock + this.blockRange);
                    this.processBlocks(blocks);
                    lastBlock = this.getLatestBlock(blocks, lastBlock);
                }
                catch (error) {
                    log.error("EVENTS", formatError(error));
                }
                finally {
                    await timeout(this.blockTimer);
                }
            }
            return lastBlock;
        })();
        return async function () {
            shouldListen = false;
            return tap(await listener, function (lastBlock) {
                log.info("EVENTS", `Stopped block listener at: ${lastBlock}`);
            });
        };
    }
    /**
     * Process the given blocks to scan for transfers and token transfers.
     */
    processBlocks(blocks) {
        const transactions = flatten(map(blocks, "transactions"));
        this.processTransfers(transactions.filter((transaction) => {
            return isTransferContract(transaction);
        }));
        this.processTokenTransfers(transactions.filter((transaction) => {
            var _a;
            if (!isTriggerSmartContract(transaction))
                return;
            const contract = transaction.raw_data.contract[0];
            const method = (_a = contract.parameter.value.data) === null || _a === void 0 ? void 0 : _a.slice(0, 8);
            return includes(["23b872dd", "a9059cbb"], method);
        }));
    }
    /**
     * Process transfer transactions
     */
    processTransfers(transactions) {
        const transfers = transactions.map((transaction) => {
            const fromHex = this.tronWeb.address.fromHex;
            const contract = transaction.raw_data.contract[0];
            const parameter = contract.parameter.value;
            return {
                hash: transaction.txID,
                from: fromHex(parameter.owner_address),
                to: fromHex(parameter.to_address),
                value: parameter.amount
            };
        });
        for (const handler of Object.values(this.handlers)) {
            handler.handleTransfers(transfers).catch((error) => {
                log.error("HANDLER", formatError(error));
            });
        }
    }
    /**
     * Process token transfer transactions
     */
    processTokenTransfers(transactions) {
        const transfers = transactions.map((transaction) => {
            var _a;
            const fromHex = this.tronWeb.address.fromHex;
            const contract = transaction.raw_data.contract[0];
            const parameter = contract.parameter.value;
            const address = parameter.contract_address;
            const token = new Token(address, this.tronWeb);
            const input = token.decodeTransferInput(parameter.data);
            const from = (_a = input.from) !== null && _a !== void 0 ? _a : parameter.owner_address;
            return {
                hash: transaction.txID,
                from: fromHex(from),
                to: fromHex(input.to),
                contract: fromHex(address),
                value: input.value
            };
        });
        for (const handler of Object.values(this.handlers)) {
            handler.handleTokenTransfers(transfers).catch((error) => {
                log.error("HANDLER", formatError(error));
            });
        }
    }
    /**
     * Retrieves a range of blocks from the Tron blockchain.
     */
    async getBlocks(start, stop) {
        return await this.tronWeb.trx.getBlockRange(start, stop);
    }
    /**
     * Retrieves the latest block number from an array of blocks
     */
    getLatestBlock(blocks, current) {
        return blocks.reduce((latest, { block_header }) => {
            return Math.max(latest, block_header.raw_data.number);
        }, current);
    }
}
class BlockHandler {
    constructor(wallet, tronWeb) {
        this.wallet = wallet;
        this.tronWeb = tronWeb;
    }
    /**
     * Handles transfers from the given transactions.
     */
    async handleTransfers(transfers) {
        const event = this.getTransferEvent();
        if (isNil(event))
            return;
        for (const transfer of transfers) {
            try {
                if (await this.includesAddress(transfer.to)) {
                    this.broadcast(event.webhook, transfer);
                }
            }
            catch (error) {
                log.error("HANDLER", formatError(error));
            }
        }
    }
    /**
     * Handles token transfers from the given transactions.
     */
    async handleTokenTransfers(transfers) {
        const events = this.getTokenTransferEvents();
        const filteredTransfers = transfers.filter((transfer) => {
            return has(events, transfer.contract);
        });
        for (const transfer of filteredTransfers) {
            try {
                if (await this.includesAddress(transfer.to)) {
                    const event = get(events, transfer.contract);
                    this.broadcast(event.webhook, transfer);
                }
            }
            catch (error) {
                log.error("HANDLER", formatError(error));
            }
        }
    }
    /**
     * Checks if the address is included in the wallet.
     */
    async includesAddress(address) {
        return await this.wallet.hasAddress(address);
    }
    /**
     * Returns the transfer event for the wallet.
     */
    getTransferEvent() {
        var _a;
        return (_a = this.wallet.events) === null || _a === void 0 ? void 0 : _a.transfer;
    }
    /**
     * Retrieves the transfer events of tokens.
     */
    getTokenTransferEvents() {
        var _a;
        return keyBy((_a = this.wallet.events) === null || _a === void 0 ? void 0 : _a.tokenTransfer, "contract");
    }
    /**
     * Broadcasts the data to the given URL after the confirmation of the transaction hash.
     */
    broadcast(url, data) {
        this.tronWeb
            .onReceipt(data.hash, async () => {
            return await client.post(url, data);
        })
            .then(() => log.info("BROADCAST", `Sent ${data.hash} to ${url}`))
            .catch((error) => log.error("BROADCAST", formatError(error)));
    }
}
/**
 * Starts listening to the blockchain events
 */
export async function startEvents(app, tronWeb, storage) {
    const listener = new BlockListener(tronWeb, storage);
    await listener.initialize();
    await listener.start();
    graceful.on("exit", async () => {
        if (listener.stop) {
            await listener.stop();
        }
    });
    app.use(function (req, res, next) {
        req.registerBlockHandler = function (wallet) {
            listener.registerHandler(wallet);
        };
        return next();
    });
}
