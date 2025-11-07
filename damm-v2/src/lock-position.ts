import {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
} from "@solana/web3.js";
import { CpAmm, derivePositionNftAccount } from "@meteora-ag/cp-amm-sdk";
import { BN, Wallet } from "@coral-xyz/anchor";
import bs58 from "bs58";
import {
  AuthorityType,
  createSetAuthorityInstruction,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";

async function getAndLockPosition() {
  console.log("Starting position retrieval and locking process...");

  const connection = new Connection(
    "https://api.mainnet-beta.solana.com",
    "confirmed"
  );

  const userKeypair = Keypair.fromSecretKey(bs58.decode("YOUR_PRIVATE_KEY"));
  const userWallet = new Wallet(userKeypair);
  console.log("User wallet initialized:", userWallet.publicKey.toBase58());

  const cpAmm = new CpAmm(connection);

  try {
    let userPositions = await cpAmm.getUserPositionByPool(
      new PublicKey("YOUR_POOL_ADDRESS"),
      new PublicKey("YOUR_WALLET_ADDRESS")
    );

    if (userPositions.length === 0) {
      console.log("No positions found for this user.");
      return;
    }

    userPositions.forEach((position, index) => {
      console.log(`\nPosition #${index + 1}:`);
      console.log(`Position Address: ${position.position.toBase58()}`);
      console.log(`NFT Account: ${position.positionNftAccount.toBase58()}`);
      console.log(
        `Total Liquidity: ${position.positionState.unlockedLiquidity
          .add(position.positionState.vestedLiquidity)
          .toString()}`
      );
      console.log(
        `Unlocked Liquidity: ${position.positionState.unlockedLiquidity.toString()}`
      );
      console.log(
        `Vested Liquidity: ${position.positionState.vestedLiquidity.toString()}`
      );
    });

    const vestingAccount = Keypair.generate();
    console.log(
      "Created vesting account:",
      vestingAccount.publicKey.toBase58()
    );

    if (userPositions[0].positionState.vestedLiquidity.gt(new BN(0))) {
      const vestings = await cpAmm.getAllVestingsByPosition(
        userPositions[0].position
      );

      console.log("Vestings:", vestings);

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

    const DURATION = 120;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const cliffPoint = new BN(currentTimestamp + DURATION);
    const periodFrequency = new BN(1);
    const numberOfPeriods = 0;
    const cliffUnlockLiquidity =
      userPositions[0].positionState.unlockedLiquidity;
    const liquidityPerPeriod = new BN(0);

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

getAndLockPosition().catch((error) => {
  console.error("Fatal error in main function:", error);
  process.exit(1);
});
