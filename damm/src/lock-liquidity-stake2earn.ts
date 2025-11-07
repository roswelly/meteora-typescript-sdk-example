import {
  createProgram,
  getAssociatedTokenAccount,
} from "@meteora-ag/dynamic-amm-sdk/dist/cjs/src/amm/utils";
import { deriveFeeVault } from "@meteora-ag/m3m3";
import {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import bs58 from "bs58";
import { fromAllocationsToAmount } from "./helpers/common";
import AmmImpl from "@meteora-ag/dynamic-amm-sdk";
import BN from "bn.js";

export const allocations = [
  {
    percentage: 100,
    address: "YOUR_STAKE2EARN_VAULT_ADDRESS",
  },
];

async function main() {
  const WALLET_PRIVATE_KEY = "";
  const walletSecretKey = bs58.decode(WALLET_PRIVATE_KEY);
  const wallet = Keypair.fromSecretKey(walletSecretKey);
  console.log("Wallet public key:", wallet.publicKey.toBase58());

  console.log("Locking liquidity to Stake2Earn vault");

  const connection = new Connection(
    "https://api.devnet.solana.com",
    "confirmed"
  );

  const m3m3ProgramId = new PublicKey(
    "FEESngU3neckdwib9X3KWqdL7Mjmqk9XNp3uh5JbP4KP"
  );

  const poolAddress = new PublicKey("YOUR_DAMM_V1_POOL_ADDRESS");
  console.log(`- Pool address: ${poolAddress}`);

  const stake2EarnVaultPubkey = deriveFeeVault(poolAddress, m3m3ProgramId);
  console.log(`- Stake2Earn fee vault ${stake2EarnVaultPubkey}`);

  const allocationContainsFeeFarmAddress = allocations.some((allocation) =>
    new PublicKey(allocation.address).equals(stake2EarnVaultPubkey)
  );
  if (!allocationContainsFeeFarmAddress) {
    throw new Error(
      "Lock liquidity allocations does not contain Stake2Earn fee farm address"
    );
  }

  const [lpMint] = PublicKey.findProgramAddressSync(
    [Buffer.from("lp_mint"), poolAddress.toBuffer()],
    createProgram(connection as any).ammProgram.programId
  );
  const payerPoolLp = getAssociatedTokenAccount(lpMint, wallet.publicKey);
  const payerPoolLpBalance = (
    await connection.getTokenAccountBalance(payerPoolLp, connection.commitment)
  ).value.amount;
  console.log("- payerPoolLpBalance %s", payerPoolLpBalance.toString());

  const allocationByAmounts = fromAllocationsToAmount(
    new BN(payerPoolLpBalance),
    allocations
  );

  const pool = await AmmImpl.create(connection as any, poolAddress);

  for (const allocation of allocationByAmounts) {
    console.log("\n> Lock liquidity %s", allocation.address.toString());
    const tx = await pool.lockLiquidity(
      allocation.address,
      allocation.amount,
      wallet.publicKey
    );

    const txHash = await sendAndConfirmTransaction(
      connection,
      tx as any,
      [wallet],
      {
        commitment: connection.commitment,
        maxRetries: 3,
      }
    ).catch((err) => {
      console.error(err);
      throw err;
    });

    console.log(
      `>>> Lock liquidity successfully with tx hash: ${txHash} for address ${allocation.address} with amount ${allocation.amount}`
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
