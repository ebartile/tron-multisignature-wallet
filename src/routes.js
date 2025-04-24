import bodyParser from "body-parser";
import { checkSchema, validationResult } from "express-validator";
import { assign, isEmpty, keyBy, mapValues } from "lodash-es";
import { formatError, httpError } from "./utils.js";
import log from "npmlog";
//-----------------------
// BEGIN REQUEST HANDLERS
//-----------------------
const ping = {
    handle: async function (req) {
        return { status: "tron-api is running." };
    }
};
const createWallet = {
    handle: async function (req) {
        await req.checkAvailability();
        const Wallet = req.storage.Wallet;
        const password = req.body.password;
        const wallet = await Wallet.generate(password);
        return { id: wallet._id, address: wallet.address };
    },
    schema: {
        password: {
            isString: true,
            isLength: { options: { min: 10 } },
            notEmpty: true
        }
    }
};
const createWalletAddress = {
    handle: async function (req) {
        await req.checkAvailability();
        const uuid = req.params.id;
        const password = req.body.password;
        const Wallet = req.storage.Wallet;
        const wallet = (await Wallet.findOrFail(uuid));
        const address = await wallet.generateAddress(password);
        return { address: address.address };
    },
    schema: {
        password: { isString: true, notEmpty: true }
    }
};
const getWallet = {
    handle: async function (req) {
        await req.checkAvailability();
        const uuid = req.params.id;
        const Wallet = req.storage.Wallet;
        const wallet = await Wallet.findOrFail(uuid);
        return { id: wallet._id, address: wallet.address };
    }
};
const getWalletTransfer = {
    handle: async function (req) {
        await req.checkAvailability();
        const hash = req.params.hash;
        const uuid = req.params.id;
        const Wallet = req.storage.Wallet;
        const wallet = (await Wallet.findOrFail(uuid));
        const transfer = await req.tronWeb.getTransfer(hash);
        if (wallet.address === transfer.from) {
            return assign({ type: "send" }, transfer);
        }
        else if (await wallet.hasAddress(transfer.to)) {
            return assign({ type: "receive" }, transfer);
        }
        throw httpError("Unrecognized transfer.");
    }
};
const consolidateBalance = {
    handle: async function (req) {
        await req.checkAvailability();
        const trx = req.tronWeb.trx;
        const BigNumber = req.tronWeb.BigNumber;
        const uuid = req.params.id;
        const password = req.body.password;
        const address = req.body.address;
        const Wallet = req.storage.Wallet;
        const wallet = (await Wallet.findOrFail(uuid));
        const source = await wallet.findAddressOrFail(address);
        const walletAccount = wallet.decryptAccount(password);
        const sourceAccount = source.decryptAccount(password);
        const balance = BigNumber(await trx.getUnconfirmedBalance(sourceAccount.address));
        if (balance.isLessThanOrEqualTo(0)) {
            throw httpError("There is nothing to consolidate.", 409);
        }
        const transferFee = await req.tronWeb.calculateTransferFee(sourceAccount.address, walletAccount.address, balance.toNumber());
        const transferable = balance.minus(transferFee);
        if (transferable.isLessThanOrEqualTo(0)) {
            throw httpError("Charges exceeds the available balance.", 403);
        }
        const hash = await req.tronWeb.sendTransfer(walletAccount.address, transferable.toNumber(), sourceAccount.privateKey);
        return await req.tronWeb.getTransfer(hash);
    },
    schema: {
        address: { isString: true, notEmpty: true },
        password: { isString: true, notEmpty: true }
    }
};
const sendBalance = {
    handle: async function (req) {
        await req.checkAvailability();
        const trx = req.tronWeb.trx;
        const BigNumber = req.tronWeb.BigNumber;
        const uuid = req.params.id;
        const password = req.body.password;
        const value = BigNumber(req.body.value);
        const address = req.body.address;
        const Wallet = req.storage.Wallet;
        if (!value.isGreaterThan(0)) {
            throw httpError("Invalid amount.");
        }
        if (!req.tronWeb.isBase58Address(address)) {
            throw httpError("Invalid address.");
        }
        const wallet = (await Wallet.findOrFail(uuid));
        const walletAccount = wallet.decryptAccount(password);
        if (await wallet.isInternalAddress(address)) {
            throw httpError("Internal transfer is prohibited.", 403);
        }
        const balance = BigNumber(await trx.getUnconfirmedBalance(walletAccount.address));
        if (balance.isLessThan(value)) {
            throw httpError("Balance is not sufficient.", 403);
        }
        const transferFee = await req.tronWeb.calculateTransferFee(walletAccount.address, address, value.toNumber());
        if (balance.isLessThan(value.plus(transferFee))) {
            throw httpError("Charges exceeds the available balance.", 403);
        }
        const hash = await req.tronWeb.sendTransfer(address, value.toNumber(), walletAccount.privateKey);
        const transfer = await req.tronWeb.getTransfer(hash);
        return assign({ type: "send" }, transfer);
    },
    schema: {
        address: { isString: true, notEmpty: true },
        password: { isString: true, notEmpty: true },
        value: { isString: true, notEmpty: true }
    }
};
const createTransferEvent = {
    handle: async function (req) {
        await req.checkAvailability();
        const uuid = req.body.wallet;
        const webhook = req.body.url;
        const Wallet = req.storage.Wallet;
        const wallet = (await Wallet.findOrFail(uuid));
        await wallet.setTransferEvent(webhook);
        req.registerBlockHandler(wallet);
    },
    schema: {
        wallet: { isString: true, notEmpty: true },
        url: { isString: true, isURL: true }
    }
};
const getTransfer = {
    handle: async function (req) {
        await req.checkAvailability();
        const hash = req.params.hash;
        return await req.tronWeb.getTransfer(hash);
    }
};
const getWalletTokenTransfer = {
    handle: async function (req) {
        await req.checkAvailability();
        const uuid = req.params.id;
        const contract = req.params.contract;
        const hash = req.params.hash;
        const Wallet = req.storage.Wallet;
        if (!req.tronWeb.isBase58Address(contract)) {
            throw httpError("Invalid contract address.");
        }
        const token = req.useToken(contract);
        const transfer = await token.getVerifiedTransfer(hash);
        const wallet = (await Wallet.findOrFail(uuid));
        if (wallet.address === transfer.from) {
            return assign({ type: "send" }, transfer);
        }
        else if (await wallet.hasAddress(transfer.to)) {
            return assign({ type: "receive" }, transfer);
        }
        throw httpError("Unrecognized transfer.");
    }
};
const consolidateTokenBalance = {
    handle: async function (req) {
        await req.checkAvailability();
        const trx = req.tronWeb.trx;
        const BigNumber = req.tronWeb.BigNumber;
        const uuid = req.params.id;
        const contract = req.params.contract;
        const address = req.body.address;
        const password = req.body.password;
        const Wallet = req.storage.Wallet;
        if (!req.tronWeb.isBase58Address(contract)) {
            throw httpError("Invalid contract address.");
        }
        const token = req.useToken(contract);
        const wallet = (await Wallet.findOrFail(uuid));
        const source = await wallet.findAddressOrFail(address);
        const walletAccount = wallet.decryptAccount(password);
        const sourceAccount = source.decryptAccount(password);
        const tokenBalance = BigNumber(await token.balanceOf(sourceAccount.address));
        if (tokenBalance.isLessThanOrEqualTo(0)) {
            throw httpError("There is nothing to consolidate.", 409);
        }
        const tokenTransferFee = await token.calculateTransferFee(sourceAccount.address, walletAccount.address, tokenBalance.toString());
        const sourceBalance = BigNumber(await trx.getUnconfirmedBalance(sourceAccount.address));
        const executeTransfer = async function () {
            const hash = await token.transfer(sourceAccount, walletAccount.address, tokenBalance.toString(), { feeLimit: tokenTransferFee.energy });
            return await token.getTransfer(hash);
        };
        if (sourceBalance.isGreaterThanOrEqualTo(tokenTransferFee.total)) {
            return await executeTransfer();
        }
        const walletBalance = BigNumber(await trx.getUnconfirmedBalance(walletAccount.address));
        const difference = BigNumber(tokenTransferFee.total).minus(sourceBalance);
        const transferFee = await req.tronWeb.calculateTransferFee(walletAccount.address, sourceAccount.address, difference.toNumber());
        if (walletBalance.isLessThan(difference.plus(transferFee))) {
            throw httpError("Wallet balance is not enough.", 403);
        }
        const hash = await req.tronWeb.sendTransfer(sourceAccount.address, difference.toNumber(), walletAccount.privateKey);
        return await req.tronWeb.onReceipt(hash, executeTransfer, {
            confirmed: false
        });
    },
    schema: {
        address: { isString: true, notEmpty: true },
        password: { isString: true, notEmpty: true }
    }
};
const sendTokenBalance = {
    handle: async function (req) {
        await req.checkAvailability();
        const trx = req.tronWeb.trx;
        const BigNumber = req.tronWeb.BigNumber;
        const uuid = req.params.id;
        const contract = req.params.contract;
        const address = req.body.address;
        const value = BigNumber(req.body.value);
        const password = req.body.password;
        const Wallet = req.storage.Wallet;
        if (!value.isGreaterThan(0)) {
            throw httpError("Invalid amount.");
        }
        if (!req.tronWeb.isBase58Address(contract)) {
            throw httpError("Invalid contract address.");
        }
        if (!req.tronWeb.isBase58Address(address)) {
            throw httpError("Invalid address.");
        }
        const token = req.useToken(contract);
        const wallet = (await Wallet.findOrFail(uuid));
        const walletAccount = wallet.decryptAccount(password);
        if (await wallet.isInternalAddress(address)) {
            throw httpError("Internal transfer is prohibited.", 403);
        }
        const tokenBalance = BigNumber(await token.balanceOf(walletAccount.address));
        if (tokenBalance.isLessThan(value)) {
            throw httpError("Balance is not sufficient.", 403);
        }
        const tokenTransferFee = await token.calculateTransferFee(walletAccount.address, address, value.toString());
        const balance = BigNumber(await trx.getUnconfirmedBalance(walletAccount.address));
        if (balance.isLessThan(tokenTransferFee.total)) {
            throw httpError("Charges exceeds the available balance.", 403);
        }
        const hash = await token.transfer(walletAccount, address, value.toString(), { feeLimit: tokenTransferFee.energy });
        const transfer = await token.getTransfer(hash);
        return assign({ type: "send" }, transfer);
    },
    schema: {
        address: { isString: true, notEmpty: true },
        password: { isString: true, notEmpty: true },
        value: { isString: true, notEmpty: true }
    }
};
const createTokenTransferEvent = {
    handle: async function (req) {
        await req.checkAvailability();
        const uuid = req.body.wallet;
        const webhook = req.body.url;
        const contract = req.body.contract;
        const Wallet = req.storage.Wallet;
        if (!req.tronWeb.isBase58Address(contract)) {
            throw httpError("Invalid contract address.");
        }
        const wallet = (await Wallet.findOrFail(uuid));
        await wallet.setTokenTransferEvent(contract, webhook);
        req.registerBlockHandler(wallet);
    },
    schema: {
        wallet: { isString: true, notEmpty: true },
        contract: { isString: true, notEmpty: true },
        url: { isString: true, isURL: true }
    }
};
const getTokenTransfer = {
    handle: async function (req) {
        await req.checkAvailability();
        const hash = req.params.hash;
        const contract = req.params.contract;
        if (!req.tronWeb.isBase58Address(contract)) {
            throw httpError("Invalid contract address.");
        }
        const token = req.useToken(contract);
        return await token.getVerifiedTransfer(hash);
    }
};
const getTokenStatus = {
    handle: async function (req) {
        await req.checkAvailability();
        const contract = req.params.contract;
        if (!req.tronWeb.isBase58Address(contract)) {
            throw httpError("Invalid contract address.");
        }
        const token = req.useToken(contract);
        return { status: await token.hasValidContract() };
    }
};
const getFeePrice = {
    handle: async function (req) {
        const { getTransactionFee: transactionFee, getCreateNewAccountFeeInSystemContract: newAccountSystemFee, getCreateAccountFee: newAccountFee, getEnergyFee: energyFee } = req.tronWeb.chainParameters;
        const createAccountFee = newAccountFee + newAccountSystemFee;
        return {
            energy: energyFee,
            bandwidth: transactionFee,
            account: createAccountFee
        };
    }
};
/**
 * Execute a handler function asynchronously.
 *
 * @param {Function} handler - The handler function to execute.
 * @param {Object} req - The request object passed to the handler function.
 * @param {Object} res - The response object passed to the handler function.
 */
const execute = async (handler, req, res) => {
    var _a;
    try {
        const result = await handler(req);
        if (result) {
            res.status(200).send(result);
        }
        else {
            res.sendStatus(204);
        }
    }
    catch (err) {
        let error;
        if (typeof err !== "string") {
            error = err instanceof Error ? err : new Error(JSON.stringify(err));
        }
        else {
            error = new Error(err);
        }
        const status = (_a = error.status) !== null && _a !== void 0 ? _a : 500;
        res.status(status).send({
            message: error.message
        });
        if (status >= 500 && status <= 599) {
            log.error("API", formatError(error));
        }
    }
};
/**
 * Request Handler
 */
function requestHandler(handler) {
    return async function (req, res) {
        if (!isEmpty(handler.schema)) {
            await checkSchema(handler.schema).run(req);
        }
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const data = keyBy(errors.array(), "param");
            res.status(422).send({
                errors: mapValues(data, "msg")
            });
        }
        else {
            await execute(handler.handle, req, res);
        }
    };
}
function setupRoutes(app, config) {
    app.use(bodyParser.json());
    app.get("/ping", requestHandler(ping));
    app.post("/wallets", requestHandler(createWallet));
    app.post("/wallets/:id/addresses", requestHandler(createWalletAddress));
    app.get("/wallets/:id", requestHandler(getWallet));
    app.get("/wallets/:id/transfers/:hash", requestHandler(getWalletTransfer));
    app.post("/wallets/:id/consolidate", requestHandler(consolidateBalance));
    app.post("/wallets/:id/send", requestHandler(sendBalance));
    app.post("/events/transfer", requestHandler(createTransferEvent));
    app.get("/transfers/:hash", requestHandler(getTransfer));
    app.get("/wallets/:id/tokens/:contract/transfers/:hash", requestHandler(getWalletTokenTransfer));
    app.post("/wallets/:id/tokens/:contract/consolidate", requestHandler(consolidateTokenBalance));
    app.post("/wallets/:id/tokens/:contract/send", requestHandler(sendTokenBalance));
    app.post("/events/token-transfer", requestHandler(createTokenTransferEvent));
    app.get("/tokens/:contract/transfers/:hash", requestHandler(getTokenTransfer));
    app.get("/tokens/:contract/status", requestHandler(getTokenStatus));
    app.get("/fee-price", requestHandler(getFeePrice));
}
export { setupRoutes };
