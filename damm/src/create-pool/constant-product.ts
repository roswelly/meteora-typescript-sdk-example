import AmmImpl, { PROGRAM_ID } from "@meteora-ag/dynamic-amm-sdk";
import { Connection, PublicKey } from "@solana/web3.js";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import * as dotenv from "dotenv";
import { derivePoolAddressWithConfig } from "@meteora-ag/dynamic-amm-sdk/dist/cjs/src/amm/utils";
import { BN } from "@coral-xyz/anchor";
import { DEFAULT_RPC_URL, DEFAULT_COMMITMENT, USDC_MINT, SOL_MINT } from "../../../shared/constants";
import { createConnection, createKeypairFromPrivateKey, formatError } from "../../../shared/utils";
import { confirmTransactionWithRetry, getLatestBlockhashSafe } from "../../../shared/transaction-utils";

dotenv.config();

async function createConstantProductPool(): Promise<void> {
  console.log("Starting constant product pool creation process...");

  const rpcUrl = process.env.RPC_URL || DEFAULT_RPC_URL;
  const mainnetConnection = createConnection(rpcUrl, DEFAULT_COMMITMENT);

  const privateKey = process.env.USER_PRIVATE_KEY || "";
  const userKeypair = createKeypairFromPrivateKey(privateKey);
  const userWallet = new Wallet(userKeypair);
  console.log("User wallet initialized:", userWallet.publicKey.toBase58());

  const provider = new AnchorProvider(mainnetConnection, userWallet, {
    commitment: DEFAULT_COMMITMENT,
  });

  const tokenAMint = new PublicKey(process.env.TOKEN_A_MINT || USDC_MINT);
  const tokenBMint = new PublicKey(process.env.TOKEN_B_MINT || SOL_MINT);

  const configAddress = process.env.CONFIG_ADDRESS || "DqqQ2kta9GAkCHzGrNAwJGDn4XDZp9SDYUBFz4z7rKRN";
  const config = new PublicKey(configAddress);

  const tokenAAmount = new BN(100_00);
  const tokenBAmount = new BN(0.080389395 * 10 ** 9);

  console.log("Pool configuration:");
  console.log("Token A (USDC):", tokenAMint.toBase58());
  console.log("Token B (SOL):", tokenBMint.toBase58());
  console.log("Config address:", config.toBase58());
  console.log("Initial liquidity - USDC:", tokenAAmount.toString());
  console.log("Initial liquidity - SOL:", tokenBAmount.toString());

  const programId = new PublicKey(PROGRAM_ID);
  const poolPubKey = derivePoolAddressWithConfig(
    tokenAMint,
    tokenBMint,
    config,
    programId
  );
  console.log("Derived pool address:", poolPubKey.toBase58());

  console.log("Preparing pool creation transactions...");
  const transactions =
    await AmmImpl.createPermissionlessConstantProductPoolWithConfig(
      provider.connection,
      userWallet.publicKey,
      tokenAMint,
      tokenBMint,
      tokenAAmount,
      tokenBAmount,
      config
    );

  console.log("Sending transactions to network...");
  for (const transaction of transactions) {
    transaction.sign(userWallet.payer);
    const txHash = await provider.connection.sendRawTransaction(
      transaction.serialize(),
      {
        skipPreflight: false,
        preflightCommitment: DEFAULT_COMMITMENT,
        maxRetries: 3,
      }
    );
    console.log("Transaction sent, waiting for confirmation...");

    const { blockhash, lastValidBlockHeight } = await getLatestBlockhashSafe(
      provider.connection
    );

    await confirmTransactionWithRetry(
      provider.connection,
      txHash,
      blockhash,
      lastValidBlockHeight,
      {
        commitment: DEFAULT_COMMITMENT,
      }
    );

    console.log("Transaction confirmed:", txHash);
  }

  console.log("\nPool created successfully!");
  console.log("Pool address:", poolPubKey.toBase58());
  if (transactions[0]?.signature) {
    console.log(`Transaction: https://solscan.io/tx/${transactions[0].signature}`);
  }
}

createConstantProductPool().catch((error) => {
  console.error("Fatal error:", formatError(error));
  process.exit(1);
});
