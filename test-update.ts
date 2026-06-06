import { db } from "./lib/dbAdapter";

async function test() {
  try {
    const list = await db.permissions.list({});
    if (list.records.length > 0) {
      const p = list.records[0];
      console.log("Found permission:", p._id);
      
      const res = await db.permissions.update(p._id, { parentStatus: "allowed" });
      console.log("Update success:", res);
    } else {
      console.log("No permissions found to test with.");
    }
  } catch (err) {
    console.error("Test failed:", err);
  }
}

test();
