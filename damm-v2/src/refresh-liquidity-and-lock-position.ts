import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { CpAmm } from "@meteora-ag/cp-amm-sdk";
import { BN, Wallet } from "@coral-xyz/anchor";
import bs58 from "bs58";

async function getAndLockPosition(secretKey: string, poolAddress: string) {
  console.log("Starting position retrieval and locking process...");

  // Initialize connection
  const connection = new Connection(
    "https://api.mainnet-beta.solana.com",
    "confirmed"
  );

  const userKeypair = Keypair.fromSecretKey(bs58.decode(secretKey));
  const userWallet = new Wallet(userKeypair);
  console.log("User wallet initialized:", userWallet.publicKey.toBase58());

  const cpAmm = new CpAmm(connection);

  try {
    let userPositions = await cpAmm.getUserPositionByPool(
      new PublicKey(poolAddress),
      userWallet.publicKey
    );

    if (userPositions.length === 0) {
      console.log("No positions found for this user.");
      return;
    }

    // create vesting account
    const vestingAccount = Keypair.generate();
    console.log(
      "Created vesting account:",
      vestingAccount.publicKey.toBase58()
    );

    // refresh vesting if vested liquidity exists
    if (userPositions[0].positionState.vestedLiquidity.gt(new BN(0))) {
      const vestings = await cpAmm.getAllVestingsByPosition(
        userPositions[0].position
      );

      const refreshVestingTx = await cpAmm.refreshVesting({
        owner: userWallet.publicKey,
        position: userPositions[0].position,
        positionNftAccount: userPositions[0].positionNftAccount,
        pool: userPositions[0].positionState.pool,
        vestingAccounts: vestings.map((v) => v.publicKey),
      });

      const refreshVestingSignature = await connection.sendTransaction(
        refreshVestingTx,
        [userKeypair]
      );
      console.log("Refreshing vesting...");
      await connection.confirmTransaction(refreshVestingSignature, "finalized");

      console.log("Vesting refreshed. Refetching position state...");
      userPositions = await cpAmm.getUserPositionByPool(
        userPositions[0].positionState.pool,
        userWallet.publicKey
      );
      console.log(
        "Refetched unlocked liquidity:",
        userPositions[0].positionState.unlockedLiquidity.toString()
      );
    }

    const DURATION = 365 * 24 * 60 * 60;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const cliffPoint = new BN(currentTimestamp + DURATION);
    const periodFrequency = new BN(1);
    const numberOfPeriods = 0;
    const cliffUnlockLiquidity =
      userPositions[0].positionState.unlockedLiquidity;
    const liquidityPerPeriod = new BN(0);

    // lock position
    const lockPositionTx = await cpAmm.lockPosition({
      owner: userWallet.publicKey,
      pool: userPositions[0].positionState.pool,
      payer: userWallet.publicKey,
      vestingAccount: vestingAccount.publicKey,
      position: userPositions[0].position,
      positionNftAccount: userPositions[0].positionNftAccount,
      cliffPoint,
      periodFrequency,
      cliffUnlockLiquidity,
      liquidityPerPeriod,
      numberOfPeriod: numberOfPeriods,
    });

    // send and confirm the transaction
    const lockPositionSignature = await connection.sendTransaction(
      lockPositionTx,
      [userKeypair, vestingAccount]
    );
    await connection.confirmTransaction(lockPositionSignature, "confirmed");

    console.log("\nPosition locked successfully!");
    console.log("Transaction: https://solscan.io/tx/" + lockPositionSignature);
    console.log("Vesting account:", vestingAccount.publicKey.toBase58());

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

getAndLockPosition("YOUR_SECRET_KEY", "YOUR_POOL_ADDRESS").catch((error) => {
  console.error("Fatal error in main function:", error);
  process.exit(1);
});
