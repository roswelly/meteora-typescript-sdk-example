import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import {
  ActivationType,
  BaseFeeMode,
  CpAmm,
  getBaseFeeParams,
  getDynamicFeeParams,
  getSqrtPriceFromPrice,
  MAX_SQRT_PRICE,
  MIN_SQRT_PRICE,
  PoolFeesParams,
} from "@meteora-ag/cp-amm-sdk";
import {
  getMint,
  NATIVE_MINT,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

(async () => {
  const POOL_CONFIG = {
    keypairPath: "../../keypair.json",
    rpcUrl: "YOUR_RPC_URL",
    tokenAMint: new PublicKey("YOUR_TOKEN_MINT"),
    tokenBMint: NATIVE_MINT,
    tokenADecimals: 9,
    tokenBDecimals: 9,
    maxTokenAAmount: 724637.6811594203,
    maxTokenBAmount: 1, // SOL
    initialPrice: 0.00000138,
    maxBaseFeeBps: 5000, // 50%
    minBaseFeeBps: 50, // 0.5%
    useDynamicFee: true,
    isLockLiquidity: true,
    baseFeeMode: BaseFeeMode.FeeSchedulerExponential,
    numberOfPeriod: 120, // 60 peridos
    totalDuration: 120, // 60 * 60
  };

  const wallet = Keypair.fromSecretKey(
    Uint8Array.from(Uint8Array.from(require(POOL_CONFIG.keypairPath)))
  );

  const connection = new Connection(POOL_CONFIG.rpcUrl);
  const cpAmm = new CpAmm(connection);

  const tokenAAccountInfo = await connection.getAccountInfo(
    POOL_CONFIG.tokenAMint
  );

  let tokenAProgram = TOKEN_PROGRAM_ID;
  let tokenAInfo = null;
  if (tokenAAccountInfo?.owner.equals(TOKEN_2022_PROGRAM_ID)) {
    tokenAProgram = tokenAAccountInfo?.owner;
    const baseMint = await getMint(
      connection,
      POOL_CONFIG.tokenAMint,
      connection.commitment,
      tokenAProgram
    );
    const epochInfo = await connection.getEpochInfo();
    tokenAInfo = {
      mint: baseMint,
      currentEpoch: epochInfo.epoch,
    };
  }

  const tokenAAmountInLamport = new BN(POOL_CONFIG.maxTokenAAmount).mul(
    new BN(10 ** POOL_CONFIG.tokenADecimals)
  );
  const tokenBAmountInLamport = new BN(POOL_CONFIG.maxTokenBAmount).mul(
    new BN(10 ** POOL_CONFIG.tokenBDecimals)
  );
  const initSqrtPrice = getSqrtPriceFromPrice(
    POOL_CONFIG.initialPrice.toString(),
    POOL_CONFIG.tokenADecimals,
    POOL_CONFIG.tokenBDecimals
  );
  const liquidityDelta = cpAmm.getLiquidityDelta({
    maxAmountTokenA: tokenAAmountInLamport,
    maxAmountTokenB: tokenBAmountInLamport,
    sqrtPrice: initSqrtPrice,
    sqrtMinPrice: MIN_SQRT_PRICE,
    sqrtMaxPrice: MAX_SQRT_PRICE,
    tokenAInfo: tokenAInfo ?? undefined,
  });

  const baseFeeParams = getBaseFeeParams(
    {
      baseFeeMode: POOL_CONFIG.baseFeeMode,
      feeSchedulerParam: {
        startingFeeBps: POOL_CONFIG.minBaseFeeBps,
        endingFeeBps: POOL_CONFIG.maxBaseFeeBps,
        numberOfPeriod: POOL_CONFIG.numberOfPeriod,
        totalDuration: POOL_CONFIG.totalDuration,
      },
    },
    POOL_CONFIG.tokenBDecimals,
    ActivationType.Slot
  );

  const dynamicFeeParams = POOL_CONFIG.useDynamicFee
    ? getDynamicFeeParams(POOL_CONFIG.minBaseFeeBps)
    : null;

  const poolFees: PoolFeesParams = {
    baseFee: baseFeeParams,
    padding: [],
    dynamicFee: dynamicFeeParams,
  };
  const positionNft = Keypair.generate();

  const {
    tx: initCustomizePoolTx,
    pool,
    position,
  } = await cpAmm.createCustomPool({
    payer: wallet.publicKey,
    creator: wallet.publicKey,
    positionNft: positionNft.publicKey,
    tokenAMint: POOL_CONFIG.tokenAMint,
    tokenBMint: POOL_CONFIG.tokenBMint,
    tokenAAmount: tokenAAmountInLamport,
    tokenBAmount: tokenBAmountInLamport,
    sqrtMinPrice: MIN_SQRT_PRICE,
    sqrtMaxPrice: MAX_SQRT_PRICE,
    liquidityDelta: liquidityDelta,
    initSqrtPrice: initSqrtPrice,
    poolFees: poolFees,
    hasAlphaVault: false,
    activationType: ActivationType.Slot,
    collectFeeMode: 0,
    activationPoint: null,
    tokenAProgram,
    tokenBProgram: TOKEN_PROGRAM_ID,
    isLockLiquidity: POOL_CONFIG.isLockLiquidity,
  });

  initCustomizePoolTx.recentBlockhash = (
    await connection.getLatestBlockhash()
  ).blockhash;
  initCustomizePoolTx.feePayer = wallet.publicKey;
  initCustomizePoolTx.partialSign(wallet);
  initCustomizePoolTx.partialSign(positionNft);

  console.log(await connection.simulateTransaction(initCustomizePoolTx));
  const signature = await connection.sendRawTransaction(
    initCustomizePoolTx.serialize()
  );
  console.log({
    signature,
    pool: pool.toString(),
    position: position.toString(),
  });
})();
