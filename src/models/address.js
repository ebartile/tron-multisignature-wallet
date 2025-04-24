import { Schema } from "mongoose";
import { AccountSchema, decryptAccount, defaultCollation } from "./support.js";
async function AddressSchema(connection, tronWeb) {
    const schema = new Schema({
        wallet_id: {
            type: String,
            required: true
        },
        address: {
            type: String,
            required: true,
            unique: true
        },
        account: {
            type: AccountSchema,
            required: true
        }
    }, {
        timestamps: true,
        collation: defaultCollation,
        methods: {
            decryptAccount(password) {
                return decryptAccount(this.account, password);
            }
        }
    });
    schema.index({ wallet_id: 1, address: 1 });
    const model = connection.model("Address", schema);
    await model.ensureIndexes();
    return model;
}
export default AddressSchema;
