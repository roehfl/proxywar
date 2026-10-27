import { runCommand } from "./run-command";

const [command, configPath, ...rest] = process.argv.slice(2);
const outIndex = rest.indexOf("--out");
const outDir = outIndex >= 0 ? rest[outIndex + 1] : undefined;
if (command !== "run" || configPath === undefined || (outIndex >= 0 && outDir === undefined)) {
  console.error("usage: npm run sim -- run <config.json> [--out <dir>]");
  process.exit(1);
}
const { record, outDir: written } = await runCommand(configPath, outDir);
const winner = record.config.seats[record.result.winner].name;
console.log(`${record.result.reason} · 승자 ${winner} · ${record.turns.length}턴 → ${written}`);
