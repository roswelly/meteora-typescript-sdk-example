import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import DLMMPool, { StrategyType } from "@meteora-ag/dlmm";
import bs58 from "bs58";
import * as dotenv from "dotenv";

dotenv.config();

async function createOnSidedPosition() {
  console.log("Starting one-sided position creation process...");

  const connection = new Connection(
    "https://api.mainnet-beta.solana.com",
    "confirmed"
  );

  const user = Keypair.fromSecretKey(bs58.decode("YOUR_USER_PRIVATE_KEY"));
  console.log("User wallet initialized:", user.publicKey.toBase58());

  const poolAddress = new PublicKey(
    "5rCf1DM8LjKTw4YqhnoLcngyZYeNnQqztScTogYHAS6"
  );
  const dlmmPool = await DLMMPool.create(connection, poolAddress);
  console.log("DLMM pool initialized successfully");

  console.log("Fetching active bin information...");
  const activeBin = await dlmmPool.getActiveBin();
  console.log("Active bin ID:", activeBin.binId.toString());

  const TOTAL_RANGE_INTERVAL = 10;
  const minBinId = activeBin.binId - TOTAL_RANGE_INTERVAL;
  const maxBinId = activeBin.binId + TOTAL_RANGE_INTERVAL;
  console.log(`Setting bin range: min=${minBinId}, max=${maxBinId}`);

  const totalXAmount = new BN(0.1 * 10 ** 9);
  const totalYAmount = new BN(0);

  const newOneSidedPosition = new Keypair();
  console.log(
    "Created new position keypair:",
    newOneSidedPosition.publicKey.toBase58()
  );

  try {
    console.log("Preparing to create position and add liquidity...");
    const createPositionTx =
      await dlmmPool.initializePositionAndAddLiquidityByStrategy({
        positionPubKey: newOneSidedPosition.publicKey,
        user: user.publicKey,
        totalXAmount,
        totalYAmount,
        strategy: {
          maxBinId,
          minBinId,
          strategyType: StrategyType.Spot,
        },
      });
    console.log("Transaction prepared, sending to network...");

    const signature = await connection.sendTransaction(
      createPositionTx,
      [user, newOneSidedPosition],
      {
        skipPreflight: false,
        preflightCommitment: "confirmed",
      }
    );

    console.log("\nTransaction sent successfully!");
    console.log("Transaction: https://solscan.io/tx/" + signature);
    console.log("Position address:", newOneSidedPosition.publicKey.toBase58());
    process.exit(0);
  } catch (error) {
    console.error("Error creating one sided position:", error);
    console.error(
      "Error details:",
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}

createOnSidedPosition().catch((error) => {
  console.error("Fatal error in main function:", error);
  process.exit(1);
});
