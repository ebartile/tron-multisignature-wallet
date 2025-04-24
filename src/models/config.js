import { Schema } from "mongoose";
import { defaultCollation } from "./support.js";
async function ConfigSchema(connection, tronWeb) {
    const schema = new Schema({
        lastBlock: { type: Number }
    }, {
        timestamps: true,
        collation: defaultCollation
    });
    const model = connection.model("Config", schema);
    await model.ensureIndexes();
    return model;
}
export default ConfigSchema;
