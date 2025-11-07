import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import AmmImpl from "@meteora-ag/dynamic-amm-sdk";

async function checkLockFees(
  connection: Connection,
  poolAddress: PublicKey,
  owner: PublicKey
) {
  // init AMM instance
  const amm = await AmmImpl.create(connection as any, poolAddress);

  // get user's lock escrow info
  const lockEscrow = await amm.getUserLockEscrow(owner);

  if (!lockEscrow) {
    console.log("No lock escrow found for this user");
    return;
  }

  // check if there are unclaimed fees
  const unclaimedFees = lockEscrow.fee.unClaimed;

  if (unclaimedFees?.lp?.isZero()) {
    console.log("No unclaimed fees available");
    return;
  }

  console.log("Unclaimed fees:");
  console.log(`Token A: ${unclaimedFees.tokenA.toString()}`);
  console.log(`Token B: ${unclaimedFees.tokenB.toString()}`);

  console.log("Claimed fees:");
  console.log(`Token A: ${lockEscrow.fee.claimed.tokenA.toString()}`);
  console.log(`Token B: ${lockEscrow.fee.claimed.tokenB.toString()}`);
}

async function main() {
  try {
    const poolAddress = new PublicKey("YOUR_POOL_ADDRESS");

    const owner = new PublicKey("YOUR_WALLET_ADDRESS");
    const connection = new Connection(
      "https://api.mainnet-beta.solana.com",
      "confirmed"
    );

    await checkLockFees(connection, poolAddress, owner);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

main();
