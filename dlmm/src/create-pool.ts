import {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import bs58 from "bs58";
import DLMM, {
  deriveCustomizablePermissionlessLbPair,
  LBCLMM_PROGRAM_IDS,
} from "@meteora-ag/dlmm";
import BN from "bn.js";

async function main() {
  const connection = new Connection(
    "https://api.mainnet-beta.solana.com",
    "confirmed"
  );

  const wallet = Keypair.fromSecretKey(bs58.decode("YOUR_WALLET_PRIVATE_KEY"));
  console.log("User wallet initialized:", wallet.publicKey.toBase58());

  const binStep = 25; // Price increment/decrement percentage in basis points (400 = 4% price step between bins)
  const feeBps = 1; // Trading fee in basis points (200 = 2% fee per swap)
  const initialPrice = 1.333; // Initial price (in terms of quote/base price)
  const activationType = 1; // 0 - Slot | 1 - Timestamp
  const activationPoint = 1760070600; // Activation time of the pool depending on activationType
  const creatorPoolOnOffControl = true; // Pool creator permission to enable/disable trading for permissionless pools
  const hasAlphaVault = false; // If true, the alpha vault will be created after the pool is created

  const quoteMint = new PublicKey(
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
  );
  const quoteMintDecimals = 6;

  const baseMint = new PublicKey("YOUR_BASE_MINT_ADDRESS");
  const baseMintDecimals = 6;

  const initPrice = DLMM.getPricePerLamport(
    baseMintDecimals,
    quoteMintDecimals,
    initialPrice
  );

  const activateBinId = DLMM.getBinIdFromPrice(initPrice, binStep, false);

  const dlmmProgramId = new PublicKey(LBCLMM_PROGRAM_IDS["mainnet-beta"]);

  const initPoolTx = await DLMM.createCustomizablePermissionlessLbPair2(
    connection,
    new BN(binStep),
    baseMint,
    quoteMint,
    new BN(activateBinId.toString()),
    new BN(feeBps),
    activationType,
    hasAlphaVault,
    wallet.publicKey,
    new BN(activationPoint) || undefined,
    creatorPoolOnOffControl,
    {
      cluster: "mainnet-beta",
      programId: dlmmProgramId,
    }
  );

  const [poolKey] = deriveCustomizablePermissionlessLbPair(
    baseMint,
    quoteMint,
    dlmmProgramId
  );

  console.log(`\n> Pool address: ${poolKey}`);

  console.log(`>> Sending init pool transaction...`);
  const initPoolTxHash = await sendAndConfirmTransaction(
    connection,
    initPoolTx,
    [wallet],
    {
      commitment: connection.commitment,
      maxRetries: 3,
    }
  ).catch((e) => {
    console.error(e);
    throw e;
  });
  console.log(
    `>>> Pool initialized successfully with tx hash: ${initPoolTxHash}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
