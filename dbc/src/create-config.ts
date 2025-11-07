import {
  Connection,
  Keypair,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  DynamicBondingCurveClient,
  CollectFeeMode,
  TokenType,
  ActivationType,
  MigrationOption,
  FeeSchedulerMode,
  MigrationFeeOption,
  TokenDecimal,
  TokenUpdateAuthorityOption,
} from "@meteora-ag/dynamic-bonding-curve-sdk";
import { NATIVE_MINT } from "@solana/spl-token";
import BN from "bn.js";
import bs58 from "bs58";

async function createConfig() {
  const PAYER_PRIVATE_KEY = "";
  const payerSecretKey = bs58.decode(PAYER_PRIVATE_KEY);
  const payer = Keypair.fromSecretKey(payerSecretKey);
  console.log("Payer public key:", payer.publicKey.toBase58());

  const OWNER_PRIVATE_KEY = "";
  const ownerSecretKey = bs58.decode(OWNER_PRIVATE_KEY);
  const owner = Keypair.fromSecretKey(ownerSecretKey);
  console.log("Owner public key:", owner.publicKey.toBase58());

  const connection = new Connection(
    "https://api.mainnet-beta.solana.com",
    "confirmed"
  );

  const config = Keypair.generate();
  console.log(`Config account: ${config.publicKey.toString()}`);

  const feeClaimer = owner.publicKey;

  const createConfigParam = {
    config: config.publicKey,
    feeClaimer,
    leftoverReceiver: feeClaimer,
    quoteMint: NATIVE_MINT,
    payer: payer.publicKey,
    poolFees: {
      baseFee: {
        cliffFeeNumerator: new BN("2500000"),
        numberOfPeriod: 0,
        reductionFactor: new BN("0"),
        periodFrequency: new BN("0"),
        feeSchedulerMode: FeeSchedulerMode.Linear,
      },
      dynamicFee: null,
    },
    activationType: ActivationType.Slot,
    collectFeeMode: CollectFeeMode.OnlyQuote,
    migrationOption: MigrationOption.MET_DAMM_V2,
    tokenType: TokenType.Token2022,
    tokenDecimal: TokenDecimal.NINE,
    migrationQuoteThreshold: new BN("3000000000"),
    partnerLpPercentage: 50,
    creatorLpPercentage: 50,
    partnerLockedLpPercentage: 0,
    creatorLockedLpPercentage: 0,
    sqrtStartPrice: new BN("58333726687135158"),
    lockedVesting: {
      amountPerPeriod: new BN(0),
      cliffDurationFromMigrationTime: new BN(0),
      frequency: new BN(0),
      numberOfPeriod: new BN(0),
      cliffUnlockAmount: new BN(0),
    },
    migrationFeeOption: MigrationFeeOption.FixedBps100,
    tokenSupply: {
      preMigrationTokenSupply: new BN("10000000000000000000"),
      postMigrationTokenSupply: new BN("10000000000000000000"),
    },
    creatorTradingFeePercentage: 0,
    padding0: [],
    padding1: [],
    curve: [
      {
        sqrtPrice: new BN("233334906748540631"),
        liquidity: new BN("622226417996106429201027821619672729"),
      },
      {
        sqrtPrice: new BN("79226673521066979257578248091"),
        liquidity: new BN("1"),
      },
    ],
    tokenUpdateAuthority: TokenUpdateAuthorityOption.Immutable,
    migrationFee: {
      feePercentage: 25,
      creatorFeePercentage: 50,
    },
  };

  try {
    const client = new DynamicBondingCurveClient(connection, "confirmed");

    const transaction = await client.partner.createConfig(createConfigParam);

    const { blockhash } = await connection.getLatestBlockhash("confirmed");
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = payer.publicKey;

    transaction.partialSign(config);

    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [payer, config],
      { commitment: "confirmed" }
    );

    console.log(`Config created successfully!`);
    console.log(`Transaction: https://solscan.io/tx/${signature}`);
    console.log(`Config address: ${config.publicKey.toString()}`);
  } catch (error) {
    console.error("Failed to create config:", error);
  }
}

createConfig()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
