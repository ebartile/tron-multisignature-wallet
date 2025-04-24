import { buildParameters, httpError, isTriggerSmartContract, isValidString, nullAddress, toTronHexAddress } from "./utils.js";
import { cloneDeep, defaultTo, includes, isNumber, isString, isUndefined, toLower } from "lodash-es";
import { decodeLog, decodeParameters } from "web3-eth-abi";
export default class Token {
    constructor(address, tronWeb) {
        this.contract = tronWeb.contract(abi, address);
    }
    get address() {
        const address = this.contract.address;
        return this.tronWeb.address.fromHex(address);
    }
    get tronWeb() {
        return this.contract.tronWeb;
    }
    get hexAddress() {
        return this.tronWeb.address.toHex(this.address);
    }
    async totalSupply() {
        return await this.contract
            .totalSupply()
            .call({ from: nullAddress() })
            .then((result) => result.toString());
    }
    async balanceOf(address) {
        return await this.contract
            .balanceOf(address)
            .call({ from: nullAddress() })
            .then(({ balance }) => balance.toString());
    }
    async transfer(account, to, amount, options = {}) {
        if (isUndefined(options.feeLimit)) {
            const from = account.address;
            const response = await this.estimateTransferEnergy(from, to, amount);
            options.feeLimit = response.energy_fee;
        }
        return (await this.contract
            .transfer(to, amount)
            .send(options, account.privateKey));
    }
    async getTransfer(hash) {
        return await this.buildTransfer(hash);
    }
    async getVerifiedTransfer(hash) {
        const response = await this.buildTransfer(hash);
        const info = await this.tronWeb.trx.getUnconfirmedTransactionInfo(hash);
        if (!isNumber(info.blockNumber)) {
            throw httpError("Transfer not confirmed.");
        }
        if (info.receipt.result !== "SUCCESS") {
            throw httpError("Token transfer failed.");
        }
        const events = this.decodeTransferEvents(info.log);
        const fromHex = this.tronWeb.address.fromHex;
        const match = (event) => fromHex(event.from) === response.from &&
            fromHex(event.to) === response.to;
        const transferEvent = events.find(match);
        if (typeof transferEvent !== "object") {
            throw httpError("Transfer event not found.", 404);
        }
        else {
            response.value = transferEvent.value;
        }
        const current = await this.tronWeb.getBlockNumber();
        response.timestamp = info.blockTimeStamp;
        response.confirmations = current - info.blockNumber;
        response.blockNumber = info.blockNumber;
        return response;
    }
    async calculateTransferFee(from, to, amount) {
        const method = this.getMethod("transfer");
        const parameters = buildParameters(method, [to, amount]);
        return await this.tronWeb.calculateSmartContractFee(this.address, method.functionSelector, { parameters, from });
    }
    async estimateTransferEnergy(from, to, amount) {
        const method = this.getMethod("transfer");
        const parameters = buildParameters(method, [to, amount]);
        return await this.tronWeb.estimateEnergy(this.address, method.functionSelector, { parameters, from });
    }
    decodeTransferInput(input) {
        const methodHash = input.slice(0, 8);
        const method = this.getMethod(methodHash);
        const params = "0x" + input.slice(8);
        if (!method || !includes(["transfer", "transferFrom"], method.name)) {
            throw httpError("Unrecognized parameter.");
        }
        const decoded = decodeParameters(method.inputs, params);
        const result = {
            value: decoded._value.toString(),
            to: toTronHexAddress(decoded._to)
        };
        if (isString(decoded._from)) {
            result.from = toTronHexAddress(decoded._from);
        }
        return result;
    }
    decodeTransferEvents(logs) {
        const method = this.getMethod("Transfer");
        const isTransferEvent = (topic) => {
            return isString(topic) && topic.startsWith(method.signature);
        };
        const isTokenAddress = (address) => {
            return "41" + address === this.hexAddress;
        };
        return cloneDeep(logs !== null && logs !== void 0 ? logs : [])
            .filter((log) => isTransferEvent(log.topics.shift()))
            .filter((log) => isTokenAddress(log.address))
            .map((log) => {
            const topics = log.topics.map((topic) => {
                return "0x" + topic;
            });
            return decodeLog(method.inputs, "0x" + log.data, topics);
        })
            .map((content) => ({
            from: toTronHexAddress(content.from),
            to: toTronHexAddress(content.to),
            value: content.value.toString()
        }));
    }
    async hasValidContract() {
        var _a;
        const contract = await this.tronWeb.trx.getContract(this.address);
        return isTokenContract(defaultTo((_a = contract.abi) === null || _a === void 0 ? void 0 : _a.entrys, []));
    }
    async buildTransfer(hash) {
        var _a;
        const transaction = await this.tronWeb.trx.getTransaction(hash);
        if (!isTriggerSmartContract(transaction)) {
            throw httpError("Unknown transaction type.");
        }
        const fromHex = this.tronWeb.address.fromHex;
        const contract = transaction.raw_data.contract[0];
        const parameter = contract.parameter.value;
        if (this.hexAddress !== parameter.contract_address) {
            throw httpError("Unknown contract address.");
        }
        if (!isValidString(parameter.data)) {
            throw httpError("Invalid transfer parameter.");
        }
        const input = this.decodeTransferInput(parameter.data);
        const from = (_a = input.from) !== null && _a !== void 0 ? _a : parameter.owner_address;
        return {
            hash: transaction.txID,
            from: fromHex(from),
            to: fromHex(input.to),
            value: input.value,
            contract: this.address,
            timestamp: null,
            confirmations: null,
            blockNumber: null
        };
    }
    getMethod(name) {
        return this.contract.methodInstances[name];
    }
}
function isTokenContract(contractAbi) {
    const methods = abi
        .filter((item) => toLower(item.type) === "function")
        .map((item) => item.name);
    const contractMethods = contractAbi
        .filter((item) => toLower(item.type) === "function")
        .map((item) => item.name);
    return methods.every((method) => {
        return contractMethods.includes(method);
    });
}
const abi = [
    {
        constant: true,
        inputs: [],
        name: "name",
        outputs: [{ name: "", type: "string" }],
        payable: false,
        stateMutability: "view",
        type: "function"
    },
    {
        constant: true,
        inputs: [],
        name: "decimals",
        outputs: [{ name: "", type: "uint8" }],
        payable: false,
        stateMutability: "view",
        type: "function"
    },
    {
        constant: true,
        inputs: [],
        name: "symbol",
        outputs: [{ name: "", type: "string" }],
        payable: false,
        stateMutability: "view",
        type: "function"
    },
    {
        constant: true,
        inputs: [],
        name: "totalSupply",
        outputs: [{ name: "", type: "uint256" }],
        payable: false,
        stateMutability: "view",
        type: "function"
    },
    {
        constant: true,
        inputs: [{ name: "_owner", type: "address" }],
        name: "balanceOf",
        outputs: [{ name: "balance", type: "uint256" }],
        payable: false,
        stateMutability: "view",
        type: "function"
    },
    {
        constant: false,
        inputs: [
            { name: "_to", type: "address" },
            { name: "_value", type: "uint256" }
        ],
        name: "transfer",
        outputs: [{ name: "", type: "bool" }],
        payable: false,
        stateMutability: "nonpayable",
        type: "function"
    },
    {
        constant: false,
        inputs: [
            { name: "_from", type: "address" },
            { name: "_to", type: "address" },
            { name: "_value", type: "uint256" }
        ],
        name: "transferFrom",
        outputs: [{ name: "", type: "bool" }],
        payable: false,
        stateMutability: "nonpayable",
        type: "function"
    },
    {
        anonymous: false,
        inputs: [
            { indexed: true, name: "from", type: "address" },
            { indexed: true, name: "to", type: "address" },
            { indexed: false, name: "value", type: "uint256" }
        ],
        name: "Transfer",
        type: "event"
    }
];
