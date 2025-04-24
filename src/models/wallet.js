// noinspection ES6RedundantAwait
import { Schema } from "mongoose";
import { v4 as createUuid } from "uuid";
import { AccountSchema, createAccount, decryptAccount, defaultCollation, encryptAccount, isValidAccount, TokenTransferEventSchema, TransferEventSchema } from "./support.js";
import { httpError } from "../utils.js";
async function WalletSchema(connection, tronWeb) {
    const schema = new Schema({
        _id: {
            type: String,
            default: () => createUuid()
        },
        address: {
            type: String,
            required: true,
            unique: true
        },
        account: {
            type: AccountSchema,
            required: true
        },
        events: {
            transfer: {
                type: TransferEventSchema,
                required: false
            },
            tokenTransfer: {
                type: [TokenTransferEventSchema],
                default: () => []
            }
        }
    }, {
        timestamps: true,
        collation: defaultCollation,
        statics: {
            async findOrFail(id) {
                const result = await this.findById(id);
                if (result !== null)
                    return result;
                throw httpError(`Wallet [${id}] not found.`, 404);
            },
            async generate(password) {
                const account = await createAccount(tronWeb);
                return await this.create({
                    account: encryptAccount(account, password),
                    address: account.address
                });
            }
        },
        methods: {
            async findAddress(address) {
                return await connection
                    .model("Address")
                    .findOne({ wallet_id: this._id, address });
            },
            async findAddressOrFail(address) {
                const result = await this.findAddress(address);
                if (result !== null)
                    return result;
                throw httpError(`Address [${address}] not found.`, 404);
            },
            async hasAddress(address) {
                return await connection
                    .model("Address")
                    .exists({ wallet_id: this._id, address })
                    .then((o) => o !== null);
            },
            async isInternalAddress(address) {
                return (this.address === address ||
                    (await this.hasAddress(address)));
            },
            async generateAddress(password) {
                if (!isValidAccount(this.decryptAccount(password))) {
                    throw httpError(`Wallet [${this._id}] account is corrupt.`, 500);
                }
                const account = await createAccount(tronWeb);
                return await connection.model("Address").create({
                    wallet_id: this._id,
                    account: encryptAccount(account, password),
                    address: account.address
                });
            },
            async setTransferEvent(webhook) {
                this.events.transfer = { webhook };
                return await this.save();
            },
            async setTokenTransferEvent(contract, webhook) {
                if (!tronWeb.isBase58Address(contract)) {
                    throw httpError("Invalid address.");
                }
                const index = this.events.tokenTransfer.findIndex((event) => event.contract === contract);
                const event = { contract, webhook };
                if (index >= 0) {
                    this.events.tokenTransfer.set(index, event);
                }
                else {
                    this.events.tokenTransfer.push(event);
                }
                return await this.save();
            },
            decryptAccount(password) {
                return decryptAccount(this.account, password);
            }
        }
    });
    const model = connection.model("Wallet", schema);
    await model.ensureIndexes();
    return model;
}
export default WalletSchema;
