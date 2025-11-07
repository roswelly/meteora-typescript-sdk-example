import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import DLMMPool, { getPriceOfBinByBinId } from "@meteora-ag/dlmm";
import { StrategyType } from "@meteora-ag/dlmm";
import Decimal from "decimal.js";
import * as dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

function formatAmountFromBaseUnits(amount: BN, decimals: number) {
  return amount.toNumber() / 10 ** decimals + "";
}

async function initializeMultiplePositionsAndAddLiquidity() {
  console.log(
    "Starting initialize multiple positions and add liquidity process..."
  );

  const connection = new Connection(
    "https://api.mainnet-beta.solana.com",
    "confirmed"
  );

  const keypairPath = path.join(__dirname, "../../../keypair.json");
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const user = Keypair.fromSecretKey(new Uint8Array(keypairData));
  console.log("User wallet initialized:", user.publicKey.toBase58());

  const poolAddress = new PublicKey("YOUR_POOL_ADDRESS");
  const dlmmPool = await DLMMPool.create(connection, poolAddress);
  console.log("DLMM pool initialized successfully");

  const vaultPda = user.publicKey;

  console.log("\nFetching active bin information...");
  const activeBin = await dlmmPool.getActiveBin();
  console.log("Active bin ID:", activeBin.binId.toString());
  console.log(
    "Active bin price:",
    getPriceOfBinByBinId(activeBin.binId, dlmmPool.lbPair.binStep)
  );

  const tokenBaseDecimals = 9;
  const tokenQuoteDecimals = 9;
  console.log(
    `Token decimals - Base: ${tokenBaseDecimals}, Quote: ${tokenQuoteDecimals}`
  );

  const initialPriceInQuoteTokens = new Decimal(
    getPriceOfBinByBinId(activeBin.binId, dlmmPool.lbPair.binStep)
  );
  const initialPricePerLamport = initialPriceInQuoteTokens.div(
    new Decimal(10 ** (tokenBaseDecimals - tokenQuoteDecimals))
  );

  // ============= CONFIGURATION =============

  const BASE_AMOUNT = 0.0001;

  // =========================================

  // lower bin: getBinIdFromPrice at initial price per lamport
  const lowerBinId = dlmmPool.getBinIdFromPrice(
    initialPricePerLamport.toNumber(),
    false
  );
  const lowerBinPricePerToken = new Decimal(
    getPriceOfBinByBinId(lowerBinId, dlmmPool.lbPair.binStep)
  ).mul(new Decimal(10 ** (tokenBaseDecimals - tokenQuoteDecimals)));

  // upper bin: for this example, up to 2x price, need price in tokens for getBinIdFromPrice
  const upperBinPrice_numeric = lowerBinPricePerToken.toNumber() * 2;
  const upperBinId = dlmmPool.getBinIdFromPrice(
    upperBinPrice_numeric / 10 ** (tokenBaseDecimals - tokenQuoteDecimals),
    false
  );
  const upperBinPricePerToken = new Decimal(
    getPriceOfBinByBinId(upperBinId, dlmmPool.lbPair.binStep)
  ).mul(new Decimal(10 ** (tokenBaseDecimals - tokenQuoteDecimals)));

  const totalBaseAmount = new BN(BASE_AMOUNT * 10 ** tokenBaseDecimals);

  console.log("Position:", {
    baseAmount: formatAmountFromBaseUnits(totalBaseAmount, tokenBaseDecimals),
    bins: `[${lowerBinId}, ${upperBinId}]`,
    binPrices: `[${lowerBinPricePerToken.toString()}, ${upperBinPricePerToken.toString()}]`,
  });

  const positionKeypairs: Keypair[] = [];
  const { instructionsByPositions: positionInstructions } =
    await dlmmPool.initializeMultiplePositionAndAddLiquidityByStrategy(
      async (count: number) => {
        const kps: Keypair[] = [];
        for (let i = 0; i < count; i++) {
          const kp = Keypair.generate();
          kps.push(kp);
          positionKeypairs.push(kp);
        }
        return kps;
      },
      totalBaseAmount,
      new BN(0),
      {
        minBinId: lowerBinId,
        maxBinId: upperBinId,
        strategyType: StrategyType.Spot,
      },
      vaultPda,
      vaultPda,
      1
    );

  console.log(`\nCreated ${positionInstructions.length} position(s)`);

  positionKeypairs.forEach((kp, index) => {
    console.log(`Position ${index + 1} public key:`, kp.publicKey.toBase58());
  });

  console.log("\n=== Sending transactions for position(s) ===");
  for (let i = 0; i < positionInstructions.length; i++) {
    const {
      positionKeypair,
      initializePositionIx,
      initializeAtaIxs,
      addLiquidityIxs,
    } = positionInstructions[i];
    console.log(
      `\nProcessing position ${i + 1}/${positionInstructions.length}`
    );
    console.log("Position public key:", positionKeypair.publicKey.toBase58());

    console.log("  → Step 1: Initializing ßposition and ATAs...");
    const initTx = new Transaction();

    // Add ATA initialization instructions
    initializeAtaIxs.forEach((ix) => initTx.add(ix));

    // Add position initialization instruction
    initTx.add(initializePositionIx);

    let blockhash = (await connection.getLatestBlockhash()).blockhash;
    initTx.recentBlockhash = blockhash;
    initTx.feePayer = user.publicKey;

    const initSig = await connection.sendTransaction(initTx, [
      user,
      positionKeypair,
    ]);
    await connection.confirmTransaction(initSig, "confirmed");
    console.log("  ✓ Position initialized: https://solscan.io/tx/" + initSig);

    console.log(
      `  → Step 2: Adding liquidity (${addLiquidityIxs.length} batches)...`
    );
    for (let j = 0; j < addLiquidityIxs.length; j++) {
      const liqTx = new Transaction();

      // Add liquidity instructions for this batch
      addLiquidityIxs[j].forEach((ix) => liqTx.add(ix));

      blockhash = (await connection.getLatestBlockhash()).blockhash;
      liqTx.recentBlockhash = blockhash;
      liqTx.feePayer = user.publicKey;

      const liqSig = await connection.sendTransaction(liqTx, [user]);
      await connection.confirmTransaction(liqSig, "confirmed");
      console.log(
        `  ✓ Liquidity batch ${j + 1}/${
          addLiquidityIxs.length
        }: https://solscan.io/tx/${liqSig}`
      );
    }

    console.log(`✅ Position ${i + 1} completed successfully`);
  }

  console.log(
    "\n✅ All positions initialized and liquidity added successfully"
  );
  process.exit(0);
}

initializeMultiplePositionsAndAddLiquidity().catch((error) => {
  console.error("Fatal error in main function:", error);
  process.exit(1);
});
