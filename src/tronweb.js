import { TronWeb } from "tronweb";
import axios from "axios";
import { estimateBandwidth, httpError, isTransferContract, pluck, timeout } from "./utils.js";
import { isNumber } from "lodash-es";
import Token from "./token.js";
axios.defaults.headers.common["Content-Type"] = "application/json";
axios.defaults.headers.common["Accept"] = "application/json";
/**
 * Creates an instance of TronWeb.
 */
export function createTronWeb(config) {
    const instance = new TronWeb({
        headers: { [config.apiHeader]: config.apiKey },
        fullHost: config.apiHost
    });
    instance.request = axios.create({
        baseURL: config.apiHost
    });
    instance.loadChainParameters = async function () {
        const data = await instance.trx.getChainParameters();
        instance.chainParameters = pluck(data, "value", "key");
    };
    instance.onReceipt = async function (hash, action, config) {
        const options = Object.assign({ delay: 3000, maxAttempts: 20, confirmed: true }, config);
        const runner = async (attempt = 1) => {
            if (attempt >= options.maxAttempts) {
                throw new Error(`Exceeded attempts: ${hash}`);
            }
            const info = !options.confirmed
                ? await instance.trx.getUnconfirmedTransactionInfo(hash)
                : await instance.trx.getTransactionInfo(hash);
            if (!isNumber(info.blockNumber)) {
                await timeout(options.delay);
                return await runner(attempt + 1);
            }
            if (info.result && info.result === "FAILED") {
                const reason = instance.toUtf8(info.resMessage);
                throw new Error(`Failed [${hash}]: ${reason}`);
            }
            return await action(info);
        };
        return await runner();
    };
    instance.getBlockNumber = async function () {
        const block = await instance.trx.getCurrentBlock();
        return block.block_header.raw_data.number;
    };
    instance.calculateTransferFee = async function (from, to, amount) {
        const Builder = instance.transactionBuilder;
        const transaction = await Builder.sendTrx(to, amount, from);
        const availableBandwidth = await instance.trx.getBandwidth(from);
        const targetAccount = await instance.trx.getAccount(to);
        const bandwidth = estimateBandwidth(transaction);
        const { getTransactionFee: transactionFee, getCreateNewAccountFeeInSystemContract: newAccountSystemFee, getCreateAccountFee: newAccountFee } = instance.chainParameters;
        if (!Boolean(targetAccount.create_time)) {
            return newAccountSystemFee + newAccountFee;
        }
        if (availableBandwidth < bandwidth) {
            return bandwidth * transactionFee;
        }
        else {
            return 0;
        }
    };
    instance.estimateEnergy = async (contract, functionSelector, options) => {
        var _a, _b;
        const triggerOptions = Object.assign(Object.assign({}, options), { _isConstant: true });
        const response = await instance.transactionBuilder.triggerSmartContract(contract, functionSelector, triggerOptions, (_a = options.parameters) !== null && _a !== void 0 ? _a : [], options.from);
        if (!((_b = response.result) === null || _b === void 0 ? void 0 : _b.result) || !response.energy_used) {
            throw httpError("Failed to estimate energy.", 500);
        }
        const energyRate = instance.chainParameters.getEnergyFee;
        return {
            energy_used: response.energy_used,
            energy_fee: response.energy_used * energyRate,
            transaction: response.transaction
        };
    };
    instance.calculateSmartContractFee = async (contract, functionSelector, options) => {
        let bandwidthFee = 0;
        const response = await instance.estimateEnergy(contract, functionSelector, options);
        const limitOffset = response.energy_fee <= 268000000 ? 6 : 7;
        const bandwidth = estimateBandwidth(response.transaction) + limitOffset;
        const availableBandwidth = await instance.trx.getBandwidth(options.from);
        if (availableBandwidth < bandwidth) {
            bandwidthFee = bandwidth * instance.chainParameters.getTransactionFee;
        }
        return {
            energy: response.energy_fee,
            bandwidth: bandwidthFee,
            total: response.energy_fee + bandwidthFee
        };
    };
    instance.sendTransfer = async function (address, amount, privateKey) {
        return await instance.trx
            .sendTransaction(address, amount, { privateKey })
            .then((i) => i.transaction.txID);
    };
    instance.getTransfer = async function (hash) {
        const transaction = await instance.trx.getTransaction(hash);
        if (!isTransferContract(transaction)) {
            throw httpError("Unknown transaction type.");
        }
        const contract = transaction.raw_data.contract[0];
        const fromHex = instance.address.fromHex;
        const info = await instance.trx.getUnconfirmedTransactionInfo(hash);
        const parameter = contract.parameter.value;
        const response = {
            hash: transaction.txID,
            from: fromHex(parameter.owner_address),
            to: fromHex(parameter.to_address),
            value: parameter.amount,
            timestamp: null,
            confirmations: null,
            blockNumber: null
        };
        if (info === null || info === void 0 ? void 0 : info.blockNumber) {
            const current = await instance.getBlockNumber();
            response.timestamp = info.blockTimeStamp;
            response.confirmations = current - info.blockNumber;
            response.blockNumber = info.blockNumber;
        }
        return response;
    };
    instance.isBase58Address = function (address) {
        if (!instance.isAddress(address))
            return false;
        return instance.address.fromHex(address) === address;
    };
    return instance;
}
/**
 * Injects helper functions into the given app
 */
export function injectHelper(app, tronWeb, storage) {
    app.use(function (req, res, next) {
        req.storage = storage;
        req.tronWeb = tronWeb;
        req.checkAvailability = async function () {
            if (!(await tronWeb.fullNode.isConnected())) {
                throw httpError("Node is unavailable.", 500);
            }
        };
        req.useToken = function (address) {
            return new Token(address, tronWeb);
        };
        return next();
    });
}
