import { Connection, Transaction, TransactionSignature } from "@solana/web3.js";
import { DEFAULT_MAX_RETRIES, DEFAULT_RETRY_DELAY_MS } from "./constants";

export interface ConfirmTransactionOptions {
  maxRetries?: number;
  retryDelayMs?: number;
  commitment?: "confirmed" | "finalized" | "processed";
}

export async function confirmTransactionWithRetry(
  connection: Connection,
  signature: TransactionSignature,
  blockhash: string,
  lastValidBlockHeight: number,
  options: ConfirmTransactionOptions = {}
): Promise<void> {
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  const commitment = options.commitment ?? "confirmed";

  let retryCount = 0;
  let confirmed = false;

  while (retryCount < maxRetries && !confirmed) {
    try {
      const confirmation = await connection.confirmTransaction(
        {
          signature,
          blockhash,
          lastValidBlockHeight,
        },
        commitment
      );

      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }

      confirmed = true;
    } catch (error) {
      retryCount++;
      if (retryCount === maxRetries) {
        throw new Error(
          `Transaction confirmation failed after ${maxRetries} attempts: ${error instanceof Error ? error.message : String(error)}`
        );
      }
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }
}

export async function getLatestBlockhashSafe(
  connection: Connection
): Promise<{ blockhash: string; lastValidBlockHeight: number }> {
  const blockhash = await connection.getLatestBlockhash();
  if (!blockhash.blockhash || !blockhash.lastValidBlockHeight) {
    throw new Error("Failed to get valid blockhash from connection");
  }
  return {
    blockhash: blockhash.blockhash,
    lastValidBlockHeight: blockhash.lastValidBlockHeight,
  };
}

