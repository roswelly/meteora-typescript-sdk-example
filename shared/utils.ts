import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import bs58 from "bs58";

export function validatePrivateKey(privateKey: string): void {
  if (!privateKey || privateKey.trim() === "") {
    throw new Error("Private key is required and cannot be empty");
  }
  try {
    bs58.decode(privateKey);
  } catch (error) {
    throw new Error("Invalid private key format. Must be base58 encoded.");
  }
}

export function validatePublicKey(address: string, name = "Address"): void {
  if (!address || address.trim() === "") {
    throw new Error(`${name} is required and cannot be empty`);
  }
  try {
    new PublicKey(address);
  } catch (error) {
    throw new Error(`Invalid ${name} format. Must be a valid Solana public key.`);
  }
}

export function createKeypairFromPrivateKey(privateKey: string): Keypair {
  validatePrivateKey(privateKey);
  const secretKey = bs58.decode(privateKey);
  return Keypair.fromSecretKey(secretKey);
}

export function createConnection(
  rpcUrl?: string,
  commitment: "confirmed" | "finalized" | "processed" = "confirmed"
): Connection {
  const url = rpcUrl || process.env.RPC_URL || "https://api.mainnet-beta.solana.com";
  return new Connection(url, commitment);
}

export function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return JSON.stringify(error);
}

export function createSolscanUrl(signature: string): string {
  return `https://solscan.io/tx/${signature}`;
}

