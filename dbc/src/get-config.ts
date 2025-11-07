import { address, createSolanaRpc } from "@solana/kit";
import bs58 from "bs58";

const rpc = createSolanaRpc(
  "https://api.mainnet-beta.solana.com"
);

const CONFIG_ADDRESS = "YOUR_CONFIG_ADDRESS";

const POOL_CONFIG_DISCRIMINATOR = Buffer.from([
  26, 108, 14, 123, 116, 230, 129, 43,
]);

// helper to deserialize BaseFeeConfig
function deserializeBaseFeeConfig(buffer: Buffer, offset: number) {
  const cliffFeeNumerator = buffer.readBigUInt64LE(offset);
  offset += 8;

  const secondFactor = buffer.readBigUInt64LE(offset);
  offset += 8;

  const thirdFactor = buffer.readBigUInt64LE(offset);
  offset += 8;

  const firstFactor = buffer.readUInt16LE(offset);
  offset += 2;

  const baseFeeMode = buffer.readUInt8(offset);
  offset += 1;

  offset += 5;

  return {
    cliffFeeNumerator,
    secondFactor,
    thirdFactor,
    firstFactor,
    baseFeeMode,
    newOffset: offset,
  };
}

// helper to deserialize DynamicFeeConfig
function deserializeDynamicFeeConfig(buffer: Buffer, offset: number) {
  const initialized = buffer.readUInt8(offset);
  offset += 1;

  offset += 7;

  const maxVolatilityAccumulator = buffer.readUInt32LE(offset);
  offset += 4;

  const variableFeeControl = buffer.readUInt32LE(offset);
  offset += 4;

  const binStep = buffer.readUInt16LE(offset);
  offset += 2;

  const filterPeriod = buffer.readUInt16LE(offset);
  offset += 2;

  const decayPeriod = buffer.readUInt16LE(offset);
  offset += 2;

  const reductionFactor = buffer.readUInt16LE(offset);
  offset += 2;

  offset += 8;

  const binStepU128Low = buffer.readBigUInt64LE(offset);
  const binStepU128High = buffer.readBigUInt64LE(offset + 8);
  const binStepU128 = (binStepU128High << BigInt(64)) | binStepU128Low;
  offset += 16;

  return {
    initialized,
    maxVolatilityAccumulator,
    variableFeeControl,
    binStep,
    filterPeriod,
    decayPeriod,
    reductionFactor,
    binStepU128,
    newOffset: offset,
  };
}

// helper to deserialize PoolFeesConfig
function deserializePoolFeesConfig(buffer: Buffer, offset: number) {
  const baseFeeResult = deserializeBaseFeeConfig(buffer, offset);
  const baseFee = baseFeeResult;
  offset = baseFeeResult.newOffset;

  const dynamicFeeResult = deserializeDynamicFeeConfig(buffer, offset);
  const dynamicFee = dynamicFeeResult;
  offset = dynamicFeeResult.newOffset;

  offset += 40;

  offset += 6;

  const protocolFeePercent = buffer.readUInt8(offset);
  offset += 1;

  const referralFeePercent = buffer.readUInt8(offset);
  offset += 1;

  return {
    baseFee: {
      cliffFeeNumerator: baseFee.cliffFeeNumerator,
      secondFactor: baseFee.secondFactor,
      thirdFactor: baseFee.thirdFactor,
      firstFactor: baseFee.firstFactor,
      baseFeeMode: baseFee.baseFeeMode,
    },
    dynamicFee: {
      initialized: dynamicFee.initialized,
      maxVolatilityAccumulator: dynamicFee.maxVolatilityAccumulator,
      variableFeeControl: dynamicFee.variableFeeControl,
      binStep: dynamicFee.binStep,
      filterPeriod: dynamicFee.filterPeriod,
      decayPeriod: dynamicFee.decayPeriod,
      reductionFactor: dynamicFee.reductionFactor,
      binStepU128: dynamicFee.binStepU128,
    },
    protocolFeePercent,
    referralFeePercent,
    newOffset: offset,
  };
}

// helper to deserialize LockedVestingConfig
function deserializeLockedVestingConfig(buffer: Buffer, offset: number) {
  const amountPerPeriod = buffer.readBigUInt64LE(offset);
  offset += 8;

  const cliffDurationFromMigrationTime = buffer.readBigUInt64LE(offset);
  offset += 8;

  const frequency = buffer.readBigUInt64LE(offset);
  offset += 8;

  const numberOfPeriod = buffer.readBigUInt64LE(offset);
  offset += 8;

  const cliffUnlockAmount = buffer.readBigUInt64LE(offset);
  offset += 8;

  offset += 8;

  return {
    amountPerPeriod,
    cliffDurationFromMigrationTime,
    frequency,
    numberOfPeriod,
    cliffUnlockAmount,
    newOffset: offset,
  };
}

// helper to deserialize LiquidityDistributionConfig (single curve point)
function deserializeLiquidityDistributionConfig(
  buffer: Buffer,
  offset: number
) {
  const sqrtPriceLow = buffer.readBigUInt64LE(offset);
  const sqrtPriceHigh = buffer.readBigUInt64LE(offset + 8);
  const sqrtPrice = (sqrtPriceHigh << BigInt(64)) | sqrtPriceLow;
  offset += 16;

  const liquidityLow = buffer.readBigUInt64LE(offset);
  const liquidityHigh = buffer.readBigUInt64LE(offset + 8);
  const liquidity = (liquidityHigh << BigInt(64)) | liquidityLow;
  offset += 16;

  return {
    sqrtPrice,
    liquidity,
    newOffset: offset,
  };
}

// helper to deserialize curve data (array of 20 LiquidityDistributionConfig)
function deserializeCurveData(buffer: Buffer, offset: number) {
  const curve = [];

  for (let i = 0; i < 20; i++) {
    const curvePoint = deserializeLiquidityDistributionConfig(buffer, offset);
    curve.push({
      sqrtPrice: curvePoint.sqrtPrice,
      liquidity: curvePoint.liquidity,
    });
    offset = curvePoint.newOffset;
  }

  return {
    curve,
    newOffset: offset,
  };
}

// helper to deserialize PoolConfig data
function deserializePoolConfig(data: Uint8Array) {
  const buffer = Buffer.from(data);

  const discriminator = buffer.subarray(0, 8);
  if (!discriminator.equals(POOL_CONFIG_DISCRIMINATOR)) {
    throw new Error("Invalid account discriminator - not a PoolConfig account");
  }

  let offset = 8;

  const quoteMint = buffer.subarray(offset, offset + 32);
  offset += 32;

  const feeClaimer = buffer.subarray(offset, offset + 32);
  offset += 32;

  const leftoverReceiver = buffer.subarray(offset, offset + 32);
  offset += 32;

  const poolFeesResult = deserializePoolFeesConfig(buffer, offset);
  const poolFees = poolFeesResult;
  offset = poolFeesResult.newOffset;

  const collectFeeMode = buffer.readUInt8(offset++);
  const migrationOption = buffer.readUInt8(offset++);
  const activationType = buffer.readUInt8(offset++);
  const tokenDecimal = buffer.readUInt8(offset++);
  const version = buffer.readUInt8(offset++);
  const tokenType = buffer.readUInt8(offset++);
  const quoteTokenFlag = buffer.readUInt8(offset++);
  const partnerLockedLpPercentage = buffer.readUInt8(offset++);
  const partnerLpPercentage = buffer.readUInt8(offset++);
  const creatorLockedLpPercentage = buffer.readUInt8(offset++);
  const creatorLpPercentage = buffer.readUInt8(offset++);
  const migrationFeeOption = buffer.readUInt8(offset++);
  const fixedTokenSupplyFlag = buffer.readUInt8(offset++);
  const creatorTradingFeePercentage = buffer.readUInt8(offset++);
  const tokenUpdateAuthority = buffer.readUInt8(offset++);
  const migrationFeePercentage = buffer.readUInt8(offset++);
  const creatorMigrationFeePercentage = buffer.readUInt8(offset++);

  offset += 7;

  const swapBaseAmount = buffer.readBigUInt64LE(offset);
  offset += 8;

  const migrationQuoteThreshold = buffer.readBigUInt64LE(offset);
  offset += 8;

  const migrationBaseThreshold = buffer.readBigUInt64LE(offset);
  offset += 8;

  const migrationSqrtPriceLow = buffer.readBigUInt64LE(offset);
  const migrationSqrtPriceHigh = buffer.readBigUInt64LE(offset + 8);
  const migrationSqrtPrice =
    (migrationSqrtPriceHigh << BigInt(64)) | migrationSqrtPriceLow;
  offset += 16;

  const lockedVestingResult = deserializeLockedVestingConfig(buffer, offset);
  const lockedVesting = lockedVestingResult;
  offset = lockedVestingResult.newOffset;

  const preMigrationTokenSupply = buffer.readBigUInt64LE(offset);
  offset += 8;

  const postMigrationTokenSupply = buffer.readBigUInt64LE(offset);
  offset += 8;

  offset += 32;

  const sqrtStartPriceLow = buffer.readBigUInt64LE(offset);
  const sqrtStartPriceHigh = buffer.readBigUInt64LE(offset + 8);
  const sqrtStartPrice = (sqrtStartPriceHigh << BigInt(64)) | sqrtStartPriceLow;
  offset += 16;

  const curveResult = deserializeCurveData(buffer, offset);
  const curve = curveResult.curve;
  offset = curveResult.newOffset;

  return {
    quoteMint: bs58.encode(quoteMint),
    feeClaimer: bs58.encode(feeClaimer),
    leftoverReceiver: bs58.encode(leftoverReceiver),
    poolFees: {
      baseFee: poolFees.baseFee,
      dynamicFee: poolFees.dynamicFee,
      protocolFeePercent: poolFees.protocolFeePercent,
      referralFeePercent: poolFees.referralFeePercent,
    },
    collectFeeMode,
    migrationOption,
    activationType,
    tokenDecimal,
    version,
    tokenType,
    quoteTokenFlag,
    partnerLockedLpPercentage,
    partnerLpPercentage,
    creatorLockedLpPercentage,
    creatorLpPercentage,
    migrationFeeOption,
    fixedTokenSupplyFlag,
    creatorTradingFeePercentage,
    tokenUpdateAuthority,
    migrationFeePercentage,
    creatorMigrationFeePercentage,
    swapBaseAmount,
    migrationQuoteThreshold,
    migrationBaseThreshold,
    migrationSqrtPrice,
    lockedVestingConfig: {
      amountPerPeriod: lockedVesting.amountPerPeriod,
      cliffDurationFromMigrationTime:
        lockedVesting.cliffDurationFromMigrationTime,
      frequency: lockedVesting.frequency,
      numberOfPeriod: lockedVesting.numberOfPeriod,
      cliffUnlockAmount: lockedVesting.cliffUnlockAmount,
    },
    preMigrationTokenSupply,
    postMigrationTokenSupply,
    sqrtStartPrice,
    curve: curve,
  };
}

async function getConfig(configAddress?: string) {
  try {
    const configAddr = configAddress || CONFIG_ADDRESS;
    if (!configAddr) {
      throw new Error(
        "Config address is required. Please provide a config address."
      );
    }

    console.log(`Fetching config from address: ${configAddr}`);

    const accountAddress = address(configAddr);

    const { value: accountInfo } = await rpc
      .getAccountInfo(accountAddress, {
        encoding: "base64",
        commitment: "confirmed",
      })
      .send();

    if (!accountInfo) {
      throw new Error(`No account found at address: ${configAddr}`);
    }

    console.log("Account Info:", {
      owner: accountInfo.owner,
      lamports: accountInfo.lamports,
      dataLength: accountInfo.data[0]?.length || 0,
      executable: accountInfo.executable,
      rentEpoch: accountInfo.rentEpoch,
    });

    const accountData = Buffer.from(accountInfo.data[0], "base64");
    const deserializedConfig = deserializePoolConfig(accountData);

    console.log("\nDeserialized Config:");
    console.log("Quote Mint:", deserializedConfig.quoteMint);
    console.log("Fee Claimer:", deserializedConfig.feeClaimer);
    console.log("Leftover Receiver:", deserializedConfig.leftoverReceiver);

    console.log("\nPool Fees:");
    console.log("  Base Fee:");
    console.log(
      "    Cliff Fee Numerator:",
      deserializedConfig.poolFees.baseFee.cliffFeeNumerator.toString()
    );
    console.log(
      "    First Factor:",
      deserializedConfig.poolFees.baseFee.firstFactor
    );
    console.log(
      "    Second Factor:",
      deserializedConfig.poolFees.baseFee.secondFactor.toString()
    );
    console.log(
      "    Third Factor:",
      deserializedConfig.poolFees.baseFee.thirdFactor.toString()
    );
    console.log(
      "    Base Fee Mode:",
      deserializedConfig.poolFees.baseFee.baseFeeMode
    );
    console.log("  Dynamic Fee:");
    console.log(
      "    Initialized:",
      deserializedConfig.poolFees.dynamicFee.initialized
    );
    console.log(
      "    Max Volatility Accumulator:",
      deserializedConfig.poolFees.dynamicFee.maxVolatilityAccumulator
    );
    console.log(
      "    Variable Fee Control:",
      deserializedConfig.poolFees.dynamicFee.variableFeeControl
    );
    console.log(
      "    Bin Step:",
      deserializedConfig.poolFees.dynamicFee.binStep
    );
    console.log(
      "    Filter Period:",
      deserializedConfig.poolFees.dynamicFee.filterPeriod
    );
    console.log(
      "    Decay Period:",
      deserializedConfig.poolFees.dynamicFee.decayPeriod
    );
    console.log(
      "    Reduction Factor:",
      deserializedConfig.poolFees.dynamicFee.reductionFactor
    );
    console.log(
      "    Bin Step U128:",
      deserializedConfig.poolFees.dynamicFee.binStepU128.toString()
    );
    console.log(
      "  Protocol Fee Percent:",
      deserializedConfig.poolFees.protocolFeePercent
    );
    console.log(
      "  Referral Fee Percent:",
      deserializedConfig.poolFees.referralFeePercent
    );

    console.log("\nOther Config:");
    console.log("Collect Fee Mode:", deserializedConfig.collectFeeMode);
    console.log("Migration Option:", deserializedConfig.migrationOption);
    console.log("Activation Type:", deserializedConfig.activationType);
    console.log("Token Decimal:", deserializedConfig.tokenDecimal);
    console.log("Version:", deserializedConfig.version);
    console.log("Token Type:", deserializedConfig.tokenType);
    console.log(
      "Partner LP Percentage:",
      deserializedConfig.partnerLpPercentage
    );
    console.log(
      "Creator LP Percentage:",
      deserializedConfig.creatorLpPercentage
    );
    console.log(
      "Migration Quote Threshold:",
      deserializedConfig.migrationQuoteThreshold.toString()
    );
    console.log(
      "Migration Base Threshold:",
      deserializedConfig.migrationBaseThreshold.toString()
    );
    console.log(
      "Migration Sqrt Price:",
      deserializedConfig.migrationSqrtPrice.toString()
    );
    console.log(
      "Swap Base Amount:",
      deserializedConfig.swapBaseAmount.toString()
    );
    console.log(
      "Sqrt Start Price:",
      deserializedConfig.sqrtStartPrice.toString()
    );
    console.log(
      "Pre Migration Token Supply:",
      deserializedConfig.preMigrationTokenSupply.toString()
    );
    console.log(
      "Post Migration Token Supply:",
      deserializedConfig.postMigrationTokenSupply.toString()
    );

    // Display locked vesting config
    console.log("\nLocked Vesting Config:");
    console.log(
      "  Amount Per Period:",
      deserializedConfig.lockedVestingConfig.amountPerPeriod.toString()
    );
    console.log(
      "  Cliff Duration From Migration Time:",
      deserializedConfig.lockedVestingConfig.cliffDurationFromMigrationTime.toString()
    );
    console.log(
      "  Frequency:",
      deserializedConfig.lockedVestingConfig.frequency.toString()
    );
    console.log(
      "  Number Of Period:",
      deserializedConfig.lockedVestingConfig.numberOfPeriod.toString()
    );
    console.log(
      "  Cliff Unlock Amount:",
      deserializedConfig.lockedVestingConfig.cliffUnlockAmount.toString()
    );

    // Display curve data (first few points to avoid overwhelming output)
    console.log("\nCurve Data (first 5 points):");
    for (let i = 0; i < Math.min(5, deserializedConfig.curve.length); i++) {
      const point = deserializedConfig.curve[i];
      console.log(`  Point ${i + 1}:`);
      console.log(`    Sqrt Price: ${point.sqrtPrice.toString()}`);
      console.log(`    Liquidity: ${point.liquidity.toString()}`);
    }

    if (deserializedConfig.curve.length > 5) {
      console.log(
        `  ... and ${deserializedConfig.curve.length - 5} more points`
      );
    }

    return {
      address: configAddr,
      accountInfo: accountInfo,
      data: accountInfo.data,
      deserializedConfig: deserializedConfig,
    };
  } catch (error) {
    console.error("Error fetching config:", error);
    throw error;
  }
}

getConfig()
  .then((result) => {
    if (result) {
      console.log("\nConfig fetched and deserialized successfully!");
    }
  })
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
