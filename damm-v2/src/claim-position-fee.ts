import {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  CpAmm,
  getTokenProgram,
  getUnClaimLpFee,
} from "@meteora-ag/cp-amm-sdk";
import { BN, Wallet } from "@coral-xyz/anchor";
import bs58 from "bs58";

async function checkAndClaimPositionFee() {
  console.log("Starting position retrieval and locking process...");

  // Initialize connection
  const connection = new Connection(
    "https://api.mainnet-beta.solana.com",
    "confirmed"
  );

  const userKeypair = Keypair.fromSecretKey(bs58.decode(""));
  const userWallet = new Wallet(userKeypair);
  console.log("User wallet initialized:", userWallet.publicKey.toBase58());

  const cpAmm = new CpAmm(connection);

  try {
    // get pool state
    const poolState = await cpAmm.fetchPoolState(
      new PublicKey("YOUR_POOL_ADDRESS")
    ); // DAMM V2 pool address

    // get position address for the user
    const userPositions = await cpAmm.getUserPositionByPool(
      new PublicKey("YOUR_POOL_ADDRESS"), // DAMM V2 pool address
      new PublicKey("YOUR_WALLET_ADDRESS") // user wallet address
    );

    if (userPositions.length === 0) {
      console.log("No positions found for this user.");
      return;
    }

    const positionState = await cpAmm.fetchPositionState(
      userPositions[0].position
    );

    console.log(positionState.metrics.totalClaimedAFee.toString());
    console.log(positionState.metrics.totalClaimedBFee.toString());

    const unClaimedReward = getUnClaimLpFee(poolState, positionState);

    const totalPositionFeeA = positionState.metrics.totalClaimedAFee.add(
      unClaimedReward.feeTokenA
    );
    const totalPositionFeeB = positionState.metrics.totalClaimedBFee.add(
      unClaimedReward.feeTokenB
    );

    console.log(
      "Total Claimed Fee A:",
      positionState.metrics.totalClaimedAFee.toString()
    );
    console.log("Unclaimed Fee A:", unClaimedReward.feeTokenA.toString());
    console.log("TOTAL POSITION FEE A:", totalPositionFeeA.toString());

    console.log(
      "Total Claimed Fee B:",
      positionState.metrics.totalClaimedBFee.toString()
    );
    console.log("Unclaimed Fee B:", unClaimedReward.feeTokenB.toString());
    console.log("TOTAL POSITION FEE B:", totalPositionFeeB.toString());

    // const tempWSolAccount = Keypair.generate();

    const claimPositionFeeTx = await cpAmm.claimPositionFee({
      owner: userWallet.publicKey,
      receiver: userWallet.publicKey,
      pool: new PublicKey(""), // DAMM V2 pool address (can use deriveDAMMV2PoolAddress)
      position: userPositions[0].position,
      positionNftAccount: userPositions[0].positionNftAccount,
      tokenAVault: poolState.tokenAVault,
      tokenBVault: poolState.tokenBVault,
      tokenAMint: poolState.tokenAMint,
      tokenBMint: poolState.tokenBMint,
      tokenAProgram: getTokenProgram(poolState.tokenAFlag),
      tokenBProgram: getTokenProgram(poolState.tokenBFlag),
      feePayer: userWallet.publicKey,
      //   tempWSolAccount: tempWSolAccount.publicKey,
    });

    // send and confirm the transaction
    const signature = await sendAndConfirmTransaction(
      connection,
      claimPositionFeeTx,
      [userKeypair],
      {
        commitment: "confirmed",
      }
    );

    console.log("\nPosition fee claimed successfully!");
    console.log("Transaction: https://solscan.io/tx/" + signature);
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    console.error(
      "Error details:",
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}

// Execute the main function
checkAndClaimPositionFee().catch((error) => {
  console.error("Fatal error in main function:", error);
  process.exit(1);
});
