import { db } from "./lib/dbAdapter";
async function getCols() {
    const list = await db.permissions.list({});
    if (list.records.length > 0) {
        console.log("Columns:", Object.keys(list.records[0]));
    }
}
getCols();
