import { CpAmm } from "@meteora-ag/cp-amm-sdk";
import { Connection, PublicKey } from "@solana/web3.js";

async function checkUserPosition() {
  const connection = new Connection(
    "https://api.mainnet-beta.solana.com",
    "confirmed"
  );
  const cpAmm = new CpAmm(connection);
  try {
    const user = new PublicKey("YOUR_USER_ADDRESS");
    const poolAddress = new PublicKey("YOUR_POOL_ADDRESS");
    const positions = await cpAmm.getUserPositionByPool(poolAddress, user);
    console.log(positions);
  } catch (error) {
    console.error("Fatal error in main function:", error);
    process.exit(1);
  }
}

checkUserPosition().catch((error) => {
  console.error("Fatal error in main function:", error);
  process.exit(1);
});
