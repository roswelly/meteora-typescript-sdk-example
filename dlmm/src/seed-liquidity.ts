import DLMM, {
  deriveCustomizablePermissionlessLbPair,
  LBCLMM_PROGRAM_IDS,
} from "@meteora-ag/dlmm";
import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
} from "@solana/web3.js";
import bs58 from "bs58";
import BN from "bn.js";

async function main() {
  const connection = new Connection(
    "https://api.mainnet-beta.solana.com",
    "confirmed"
  );

  const payer = Keypair.fromSecretKey(bs58.decode("YOUR_PAYER_PRIVATE_KEY"));
  console.log("Payer wallet initialized:", payer.publicKey.toBase58());

  const operator = Keypair.fromSecretKey(
    bs58.decode("YOUR_OPERATOR_PRIVATE_KEY")
  );
  console.log("Operator wallet initialized:", operator.publicKey.toBase58());

  const cluster = "mainnet-beta";
  const dlmmProgramId = new PublicKey(LBCLMM_PROGRAM_IDS[cluster]);

  const quoteMint = new PublicKey(
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
  ); // USDC
  const baseMint = new PublicKey("YOUR_BASE_MINT_ADDRESS");

  const baseKeypair = Keypair.generate();

  const [poolKey] = deriveCustomizablePermissionlessLbPair(
    baseMint,
    quoteMint,
    dlmmProgramId
  );
  console.log(`- Using pool key ${poolKey.toString()}`);

  const minPrice = 1.333; // Minimum price boundary for liquidity distribution range
  const maxPrice = 3.999; // Maximum price boundary for liquidity distribution range
  const curvature = 0.6; // Distribution curvature factor (1/k) controlling liquidity concentration (0-1, lower = more concentrated)
  const seedAmount = new BN(200000000000); // Total amount of liquidity to seed into the pool (in token units)
  const positionOwner = new PublicKey("YOUR_POSITION_OWNER_ADDRESS"); // Public key of the position owner who controls the liquidity
  const feeOwner = new PublicKey("YOUR_FEE_OWNER_ADDRESS"); // Public key entitled to claim trading fees from this position
  const lockReleasePoint = new BN(0); // Timestamp/slot when position becomes withdrawable (0 = immediately unlocked)
  const seedTokenXToPositionOwner = true; // Whether to send 1 lamport of token X to position owner as ownership proof

  if (!seedTokenXToPositionOwner) {
    console.log(
      `WARNING: You selected seedTokenXToPositionOwner = false, you should manually send 1 lamport of token X to the position owner account to prove ownership.`
    );
  }

  const dlmmInstance = await DLMM.create(connection, poolKey, {
    cluster,
    programId: dlmmProgramId,
  });

  const {
    sendPositionOwnerTokenProveIxs,
    initializeBinArraysAndPositionIxs,
    addLiquidityIxs,
  } = await dlmmInstance.seedLiquidity(
    positionOwner,
    seedAmount,
    curvature,
    minPrice,
    maxPrice,
    baseKeypair.publicKey,
    payer.publicKey,
    feeOwner,
    operator.publicKey,
    lockReleasePoint,
    seedTokenXToPositionOwner
  );

  if (sendPositionOwnerTokenProveIxs.length > 0) {
    // run preflight ixs
    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash(connection.commitment);
    const setCUPriceIx = ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 100000,
    });

    const signers = [payer, operator];
    const tx = new Transaction({
      feePayer: payer.publicKey,
      blockhash,
      lastValidBlockHeight,
    }).add(setCUPriceIx);

    tx.add(...sendPositionOwnerTokenProveIxs);

    try {
      const txHash = await sendAndConfirmTransaction(connection, tx, signers, {
        commitment: connection.commitment,
        maxRetries: 3,
      });
      console.log(`>>> Preflight successfully with tx hash: ${txHash}`);
    } catch (err) {
      console.error(err);
      throw new Error(err as string);
    }
  }

  console.log(`>> Running initializeBinArraysAndPosition instructions...`);
  // Initialize all bin array and position, transaction order can be in sequence or not
  {
    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash(connection.commitment);

    const transactions: Array<Promise<string>> = [];

    for (const groupIx of initializeBinArraysAndPositionIxs) {
      const tx = new Transaction({
        feePayer: payer.publicKey,
        blockhash,
        lastValidBlockHeight,
      }).add(...groupIx);

      const signers = [payer, baseKeypair, operator];

      transactions.push(
        sendAndConfirmTransaction(connection, tx, signers, {
          commitment: connection.commitment,
          maxRetries: 3,
        })
      );
    }

    await Promise.all(transactions)
      .then((txs) => {
        txs.map(console.log);
      })
      .catch((e) => {
        console.error(e);
        throw e;
      });
  }
  console.log(`>>> Finished initializeBinArraysAndPosition instructions!`);

  console.log(`>> Running addLiquidity instructions...`);
  {
    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash(connection.commitment);

    // Deposit to positions created in above step. The add liquidity order can be in sequence or not.
    for (const groupIx of addLiquidityIxs) {
      const tx = new Transaction({
        feePayer: payer.publicKey,
        blockhash,
        lastValidBlockHeight,
      }).add(...groupIx);

      const signers = [payer, operator];

      await sendAndConfirmTransaction(connection, tx, signers, {
        commitment: connection.commitment,
        maxRetries: 3,
      });
    }
  }
  console.log(`>>> Finished addLiquidity instructions!`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
