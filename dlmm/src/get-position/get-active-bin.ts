import { Connection, PublicKey } from "@solana/web3.js";
import DLMMPool from "@meteora-ag/dlmm";
import * as dotenv from "dotenv";

dotenv.config();

async function getActiveBin() {
  console.log("Fetching active bin information...");

  const connection = new Connection(
    "https://api.mainnet-beta.solana.com",
    "confirmed"
  );

  // Initialize DLMM pool
  const poolAddress = new PublicKey(
    "5rCf1DM8LjKTw4YqhnoLcngyZYeNnQqztScTogYHAS6"
  ); // SOL-USDC pool on mainnet
  const dlmmPool = await DLMMPool.create(connection, poolAddress);
  console.log("DLMM pool initialized successfully");

  // Get active bin information
  const activeBin = await dlmmPool.getActiveBin();
  const activeBinPriceLamport = activeBin.price;
  const activeBinPricePerToken = dlmmPool.fromPricePerLamport(
    Number(activeBin.price)
  );

  console.log("Active bin ID:", activeBin.binId.toString());
  console.log("Active bin price (lamports):", activeBinPriceLamport.toString());
  console.log("Active bin price (per token):", activeBinPricePerToken);

  return {
    activeBin,
    activeBinPriceLamport,
    activeBinPricePerToken,
  };
}

getActiveBin().catch((error) => {
  console.error("Error fetching active bin:", error);
  console.error(
    "Error details:",
    error instanceof Error ? error.message : String(error)
  );
  process.exit(1);
});
