import { Connection, PublicKey, Keypair, ComputeBudgetProgram } from "@solana/web3.js";
import AmmImpl from "@meteora-ag/dynamic-amm-sdk";
import {
  DEFAULT_COMPUTE_UNIT_LIMIT,
  DEFAULT_COMPUTE_UNIT_PRICE_MICROLAMPORTS,
  DEFAULT_MAX_RETRIES,
  DEFAULT_RETRY_DELAY_MS,
  DEFAULT_RPC_URL,
  DEFAULT_COMMITMENT,
} from "../../../shared/constants";
import { confirmTransactionWithRetry, getLatestBlockhashSafe } from "../../../shared/transaction-utils";
import {
  createConnection,
  createKeypairFromPrivateKey,
  validatePublicKey,
  formatError,
} from "../../../shared/utils";

async function checkAndClaimLockFees(
  connection: Connection,
  poolAddress: PublicKey,
  owner: Keypair,
  payer: Keypair,
  receiver?: Keypair
): Promise<void> {
  const amm = await AmmImpl.create(connection, poolAddress);

  const lockEscrow = await amm.getUserLockEscrow(owner.publicKey);

  if (!lockEscrow) {
    throw new Error("No lock escrow found for this user");
  }

  const unclaimedFees = lockEscrow.fee.unClaimed;

  if (unclaimedFees?.lp?.isZero()) {
    throw new Error("No unclaimed fees available");
  }

  console.log("Unclaimed fees:");
  console.log(`LP tokens: ${unclaimedFees?.lp?.toString()}`);
  console.log(`Token A: ${unclaimedFees.tokenA.toString()}`);
  console.log(`Token B: ${unclaimedFees.tokenB.toString()}`);

  const amountToClaim = unclaimedFees.lp;

  if (!amountToClaim) {
    throw new Error("No LP amount available to claim");
  }

  const tempWSolAccount = Keypair.generate();

  const claimTx = await amm.claimLockFee(
    owner.publicKey,
    amountToClaim,
    payer.publicKey,
    receiver?.publicKey,
    tempWSolAccount?.publicKey
  );

  const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({
    units: DEFAULT_COMPUTE_UNIT_LIMIT,
  });
  const addPriorityFee = ComputeBudgetProgram.setComputeUnitPrice({
    microLamports: DEFAULT_COMPUTE_UNIT_PRICE_MICROLAMPORTS,
  });

  claimTx.add(modifyComputeUnits);
  claimTx.add(addPriorityFee);

  const signers = [owner];
  if (payer) signers.push(payer);
  if (receiver) signers.push(tempWSolAccount);

  const signature = await connection.sendTransaction(claimTx, signers);

  console.log(`Claim transaction sent: ${signature}`);
  console.log("Waiting for confirmation...");

  const { blockhash, lastValidBlockHeight } = await getLatestBlockhashSafe(connection);

  if (!claimTx.recentBlockhash) {
    claimTx.recentBlockhash = blockhash;
  }

  await confirmTransactionWithRetry(
    connection,
    signature,
    claimTx.recentBlockhash,
    lastValidBlockHeight,
    {
      maxRetries: DEFAULT_MAX_RETRIES,
      retryDelayMs: DEFAULT_RETRY_DELAY_MS,
    }
  );

  console.log("Fees claimed successfully!");
}

async function main(): Promise<void> {
  try {
    const poolAddressEnv = process.env.POOL_ADDRESS || "";
    validatePublicKey(poolAddressEnv, "Pool address");
    const poolAddress = new PublicKey(poolAddressEnv);

    const PAYER_PRIVATE_KEY = process.env.PAYER_PRIVATE_KEY || "";
    const payer = createKeypairFromPrivateKey(PAYER_PRIVATE_KEY);
    console.log("Payer public key:", payer.publicKey.toBase58());

    const OWNER_PRIVATE_KEY = process.env.OWNER_PRIVATE_KEY || "";
    const owner = createKeypairFromPrivateKey(OWNER_PRIVATE_KEY);
    console.log("Owner public key:", owner.publicKey.toBase58());

    const RECEIVER_PRIVATE_KEY = process.env.RECEIVER_PRIVATE_KEY;
    const receiver = RECEIVER_PRIVATE_KEY
      ? createKeypairFromPrivateKey(RECEIVER_PRIVATE_KEY)
      : undefined;
    if (receiver) {
      console.log("Receiver public key:", receiver.publicKey.toBase58());
    }

    const connection = createConnection(
      process.env.RPC_URL || DEFAULT_RPC_URL,
      DEFAULT_COMMITMENT
    );

    await checkAndClaimLockFees(connection, poolAddress, owner, payer, receiver);
  } catch (error) {
    console.error("Error:", formatError(error));
    throw error;
  }
}

main().catch((error) => {
  console.error("Fatal error:", formatError(error));
  process.exit(1);
});
