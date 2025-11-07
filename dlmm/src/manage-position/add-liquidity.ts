import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import DLMMPool, { autoFillYByStrategy } from "@meteora-ag/dlmm";
import { StrategyType } from "@meteora-ag/dlmm";
import bs58 from "bs58";
import * as dotenv from "dotenv";

dotenv.config();

async function addLiquidity() {
  console.log("Starting add liquidity process...");

  const connection = new Connection(
    "https://api.mainnet-beta.solana.com",
    "confirmed"
  );

  // Initialise user wallet (from bs58 private key)
  const user = Keypair.fromSecretKey(bs58.decode(""));
  console.log("User wallet initialized:", user.publicKey.toBase58());

  // Initialise DLMM pool
  const poolAddress = new PublicKey(
    "5rCf1DM8LjKTw4YqhnoLcngyZYeNnQqztScTogYHAS6"
  ); // SOL-USDC pool on mainnet
  const dlmmPool = await DLMMPool.create(connection, poolAddress);
  console.log("DLMM pool initialized successfully");

  // Get active bin information
  console.log("Fetching active bin information...");
  const activeBin = await dlmmPool.getActiveBin();
  console.log("Active bin ID:", activeBin.binId.toString());

  // Get the bin ranges from get-position/get-positions-list.ts
  const minBinId = -5219;
  const maxBinId = -5199;
  console.log(`Setting bin range: min=${minBinId}, max=${maxBinId}`);

  const totalXAmount = new BN(0.1 * 10 ** 9); // 0.1 SOL in lamports
  const totalYAmount = autoFillYByStrategy(
    activeBin.binId,
    dlmmPool.lbPair.binStep,
    totalXAmount,
    activeBin.xAmount,
    activeBin.yAmount,
    minBinId,
    maxBinId,
    StrategyType.Spot
  );

  // Get the position public key from get-position/get-positions-list.ts
  const existingPositionPubkey = new PublicKey(
    "DvT47zNFuvqTj6PPRtqcbU1Jhncf96Bidcrv9KNELi5w"
  );
  console.log("Using existing position:", existingPositionPubkey.toBase58());

  try {
    console.log("Adding liquidity...");
    const addLiquidityTx = await dlmmPool.addLiquidityByStrategy({
      positionPubKey: existingPositionPubkey,
      user: user.publicKey,
      totalXAmount,
      totalYAmount,
      strategy: {
        maxBinId,
        minBinId,
        strategyType: StrategyType.Spot,
      },
    });

    // Send and confirm the transaction
    const signature = await connection.sendTransaction(addLiquidityTx, [user]);
    await connection.confirmTransaction(signature, "confirmed");

    console.log("Liquidity added successfully");
    console.log("Transaction: https://solscan.io/tx/" + signature);
    process.exit(0);
  } catch (error) {
    console.error("Error adding liquidity:", error);
    console.error(
      "Error details:",
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}

addLiquidity().catch((error) => {
  console.error("Fatal error in main function:", error);
  process.exit(1);
});
