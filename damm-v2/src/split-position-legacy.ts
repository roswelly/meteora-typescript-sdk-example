import {
  clusterApiUrl,
  Connection,
  Keypair,
  PublicKey,
  Transaction,
} from "@solana/web3.js";
import {
  CpAmm,
  derivePositionNftAccount,
  getAmountAFromLiquidityDelta,
  getAmountBFromLiquidityDelta,
  getTokenProgram,
  Rounding,
} from "@meteora-ag/cp-amm-sdk";
import { BN, Wallet } from "@coral-xyz/anchor";
import bs58 from "bs58";

async function splitPosition() {
  const connection = new Connection(
    "https://api.mainnet-beta.solana.com",
    "confirmed"
  );

  const userKeypair = Keypair.fromSecretKey(bs58.decode("YOUR_PRIVATE_KEY"));
  const wallet = new Wallet(userKeypair);
  console.log("User wallet initialized:", wallet.publicKey.toBase58());

  const cpAmm = new CpAmm(connection);
  const pool = new PublicKey("YOUR_POOL_ADDRESS");
  const userPosition = await cpAmm.getUserPositionByPool(
    pool,
    wallet.publicKey
  );
  const position = userPosition[0].position;

  const positonState = await cpAmm.fetchPositionState(position);
  const poolState = await cpAmm.fetchPoolState(pool);
  const currentSlot = await connection.getSlot();
  const blockTime = await connection.getBlockTime(currentSlot);

  if (!blockTime) {
    throw new Error("Could not get block time");
  }

  // 1. withdraw 50% liquidity from position
  const withdrawLiquidityDelta = positonState.unlockedLiquidity.div(new BN(2));
  const withdrawPositionTx = await cpAmm.removeLiquidity({
    owner: wallet.publicKey,
    pool,
    position,
    positionNftAccount: derivePositionNftAccount(positonState.nftMint),
    liquidityDelta: withdrawLiquidityDelta,
    tokenAAmountThreshold: new BN(0),
    tokenBAmountThreshold: new BN(0),
    tokenAMint: poolState.tokenAMint,
    tokenBMint: poolState.tokenBMint,
    tokenAVault: poolState.tokenAVault,
    tokenBVault: poolState.tokenBVault,
    tokenAProgram: getTokenProgram(poolState.tokenAFlag),
    tokenBProgram: getTokenProgram(poolState.tokenBFlag),
    vestings: [],
    currentPoint: new BN(blockTime),
  });

  // 2 create and add 50% liquidity into new position
  // recalculate liquidity delta
  const tokenAWithdrawAmount = getAmountAFromLiquidityDelta(
    withdrawLiquidityDelta,
    poolState.sqrtPrice,
    poolState.sqrtMaxPrice,
    Rounding.Down
  );

  const tokenBWithdrawAmount = getAmountBFromLiquidityDelta(
    withdrawLiquidityDelta,
    poolState.sqrtPrice,
    poolState.sqrtMinPrice,
    Rounding.Down
  );

  const newLiquidityDelta = cpAmm.getLiquidityDelta({
    maxAmountTokenA: tokenAWithdrawAmount,
    maxAmountTokenB: tokenBWithdrawAmount,
    sqrtMaxPrice: poolState.sqrtMaxPrice,
    sqrtMinPrice: poolState.sqrtMinPrice,
    sqrtPrice: poolState.sqrtPrice,
  });
  const positionNft = Keypair.generate();
  const createAndDepositPositionTx = await cpAmm.createPositionAndAddLiquidity({
    owner: wallet.publicKey,
    pool,
    positionNft: positionNft.publicKey,
    liquidityDelta: newLiquidityDelta,
    maxAmountTokenA: tokenAWithdrawAmount,
    maxAmountTokenB: tokenBWithdrawAmount,
    tokenAAmountThreshold: new BN("18446744073709551615"), // U64_MAX value
    tokenBAmountThreshold: new BN("18446744073709551615"), // U64_MAX value
    tokenAMint: poolState.tokenAMint,
    tokenBMint: poolState.tokenBMint,
    tokenAProgram: getTokenProgram(poolState.tokenAFlag),
    tokenBProgram: getTokenProgram(poolState.tokenBFlag),
  });

  const transaction = new Transaction()
    .add(withdrawPositionTx)
    .add(createAndDepositPositionTx);

  transaction.feePayer = wallet.publicKey;

  transaction.recentBlockhash = (
    await connection.getLatestBlockhash()
  ).blockhash;

  console.log(await connection.simulateTransaction(transaction));
}

splitPosition().catch(console.error);
