import { Connection, PublicKey } from "@solana/web3.js";
import DLMMPool, { getPriceOfBinByBinId } from "@meteora-ag/dlmm";

async function main() {
  console.log("Getting active ID and price...");

  const connection = new Connection(
    "https://api.mainnet-beta.solana.com",
    "confirmed"
  );

  const poolAddress = new PublicKey("YOUR_POOL_ADDRESS");
  const dlmmPool = await DLMMPool.create(connection, poolAddress);
  console.log("DLMM pool initialized successfully");

  console.log("Fetching active bin information...");
  const activeBin = await dlmmPool.getActiveBin();
  console.log("Active bin ID:", activeBin.binId.toString());
  console.log("Active bin price per token:", activeBin.pricePerToken);

  const binId = 69;
  const binStep = dlmmPool.lbPair.binStep;
  const pricePerLamport = getPriceOfBinByBinId(binId, binStep);
  const tokenXDecimals = dlmmPool.tokenX.mint.decimals;
  const tokenYDecimals = dlmmPool.tokenY.mint.decimals;
  const pricePerToken = pricePerLamport.mul(
    10 ** (tokenXDecimals - tokenYDecimals)
  );

  console.log(`\nBin ID ${binId}:`);
  console.log("Price per lamport:", pricePerLamport.toString());
  console.log("Price per token:", pricePerToken.toString());
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
