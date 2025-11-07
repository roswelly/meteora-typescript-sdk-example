import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import DLMMPool from "@meteora-ag/dlmm";
import bs58 from "bs58";
import * as dotenv from "dotenv";

dotenv.config();

async function getPositionsList() {
  console.log("Fetching user positions...");

  const connection = new Connection(
    "https://api.mainnet-beta.solana.com",
    "confirmed"
  );

  // Initialize user wallet (from bs58 private key)
  const user = Keypair.fromSecretKey(bs58.decode(""));
  console.log("User wallet initialized:", user.publicKey.toBase58());

  // Initialize DLMM pool
  const poolAddress = new PublicKey(
    "5rCf1DM8LjKTw4YqhnoLcngyZYeNnQqztScTogYHAS6"
  ); // SOL-USDC pool on mainnet
  const dlmmPool = await DLMMPool.create(connection, poolAddress);
  console.log("DLMM pool initialized successfully");

  try {
    // Get user positions
    console.log("Fetching positions for user:", user.publicKey.toBase58());
    const { userPositions } = await dlmmPool.getPositionsByUserAndLbPair(
      user.publicKey
    );

    if (userPositions.length === 0) {
      console.log("No positions found for this user.");
      return;
    }

    console.log(`Found ${userPositions.length} position(s)`);

    // Display information about each position
    userPositions.forEach((position, index) => {
      console.log(`\nPosition #${index + 1}:`);
      console.log(`Position Address: ${position.publicKey.toBase58()}`);
      console.log(
        `Lower Bin ID: ${position.positionData.lowerBinId.toString()}`
      );
      console.log(
        `Upper Bin ID: ${position.positionData.upperBinId.toString()}`
      );

      const binData = position.positionData.positionBinData;
      console.log(`Bin Data: ${binData.length} entries`);

      // Display some sample bin data if available
      if (binData.length > 0) {
        console.log("Sample bin data:");
        binData.slice(0, 3).forEach((bin, i) => {
          console.log(
            `  Bin ${i}: ID=${bin.binId.toString()}, X=${bin.binLiquidity.toString()}, Y=${bin.binLiquidity.toString()}`
          );
        });
      }
    });
  } catch (error) {
    console.error("Error fetching positions:", error);
    console.error(
      "Error details:",
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}

getPositionsList().catch((error) => {
  console.error("Fatal error in main function:", error);
  process.exit(1);
});
