const fs = require("fs");
const path = require("path");

exports.main = async (event) => {
  const { poolId } = event || {};
  const dir = path.join(__dirname, "pools");
  if (poolId) {
    const file = path.join(dir, `${poolId}.json`);
    if (!fs.existsSync(file)) return { ok: false, message: "not found" };
    return { ok: true, data: JSON.parse(fs.readFileSync(file, "utf8")) };
  }
  const list = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => {
    const p = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    return { poolId: p.poolId, name: p.name, sceneType: p.sceneType, cost: p.cost };
  });
  return { ok: true, data: list };
};
