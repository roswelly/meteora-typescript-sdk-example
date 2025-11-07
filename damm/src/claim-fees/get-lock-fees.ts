import { Connection, PublicKey } from "@solana/web3.js";
import AmmImpl from "@meteora-ag/dynamic-amm-sdk";
import { DEFAULT_RPC_URL, DEFAULT_COMMITMENT } from "../../../shared/constants";
import { createConnection, validatePublicKey, formatError } from "../../../shared/utils";

async function checkLockFees(
  connection: Connection,
  poolAddress: PublicKey,
  owner: PublicKey
): Promise<void> {
  const amm = await AmmImpl.create(connection, poolAddress);

  const lockEscrow = await amm.getUserLockEscrow(owner);

  if (!lockEscrow) {
    throw new Error("No lock escrow found for this user");
  }

  const unclaimedFees = lockEscrow.fee.unClaimed;

  if (unclaimedFees?.lp?.isZero()) {
    throw new Error("No unclaimed fees available");
  }

  console.log("Unclaimed fees:");
  console.log(`Token A: ${unclaimedFees.tokenA.toString()}`);
  console.log(`Token B: ${unclaimedFees.tokenB.toString()}`);

  console.log("Claimed fees:");
  console.log(`Token A: ${lockEscrow.fee.claimed.tokenA.toString()}`);
  console.log(`Token B: ${lockEscrow.fee.claimed.tokenB.toString()}`);
}

async function main(): Promise<void> {
  try {
    const poolAddressEnv = process.env.POOL_ADDRESS || "YOUR_POOL_ADDRESS";
    validatePublicKey(poolAddressEnv, "Pool address");
    const poolAddress = new PublicKey(poolAddressEnv);

    const ownerAddressEnv = process.env.WALLET_ADDRESS || "YOUR_WALLET_ADDRESS";
    validatePublicKey(ownerAddressEnv, "Wallet address");
    const owner = new PublicKey(ownerAddressEnv);

    const connection = createConnection(
      process.env.RPC_URL || DEFAULT_RPC_URL,
      DEFAULT_COMMITMENT
    );

    await checkLockFees(connection, poolAddress, owner);
  } catch (error) {
    console.error("Error:", formatError(error));
    throw error;
  }
}

main().catch((error) => {
  console.error("Fatal error:", formatError(error));
  process.exit(1);
});
