import DLMM, { derivePosition } from "@meteora-ag/dlmm";
import { Connection, PublicKey } from "@solana/web3.js";
import BN from "bn.js";

async function main() {
  console.log("Deriving position...");

  const connection = new Connection(
    "https://api.mainnet-beta.solana.com",
    "confirmed"
  );

  const dlmmPool = await DLMM.create(
    connection,
    new PublicKey("YOUR_LB_PAIR_ADDRESS")
  );

  const pricePerLamport = DLMM.getPricePerLamport(9, 9, 1 / 0.75);
  console.log("Price per lamport:", pricePerLamport);

  const binId = DLMM.getBinIdFromPrice(pricePerLamport, 25, false);
  console.log("Bin ID:", binId);

  const position = derivePosition(
    dlmmPool.pubkey,
    new PublicKey("YOUR_BASE_ADDRESS"),
    new BN(binId),
    new BN(1),
    dlmmPool.program.programId
  );
  console.log(position);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
