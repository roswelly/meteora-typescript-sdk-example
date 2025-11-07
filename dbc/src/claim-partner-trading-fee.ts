import {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { DynamicBondingCurveClient } from "@meteora-ag/dynamic-bonding-curve-sdk";
import bs58 from "bs58";

async function claimPartnerTradingFee() {
  const PAYER_PRIVATE_KEY = "";
  const payerSecretKey = bs58.decode(PAYER_PRIVATE_KEY);
  const payer = Keypair.fromSecretKey(payerSecretKey);
  console.log("Payer public key:", payer.publicKey.toBase58());

  const PARTNER_PRIVATE_KEY = "";
  const partnerSecretKey = bs58.decode(PARTNER_PRIVATE_KEY);
  const partner = Keypair.fromSecretKey(partnerSecretKey);
  console.log("Partner public key:", partner.publicKey.toBase58());

  const connection = new Connection(
    "https://api.mainnet-beta.solana.com",
    "confirmed"
  );

  const poolAddress = new PublicKey(""); // can use deriveDbcPoolAddress

  try {
    const client = new DynamicBondingCurveClient(connection, "confirmed");

    const feeMetrics = await client.state.getPoolPartnerFeeMetrics(poolAddress);

    // const tempWSolAccount = Keypair.generate(); // use only if your quoteMint is SOL & receiver != creator

    const claimTradingFeeParam = {
      feeClaimer: partner.publicKey,
      payer: payer.publicKey,
      pool: poolAddress,
      maxBaseAmount: feeMetrics.partnerBaseFee,
      maxQuoteAmount: feeMetrics.partnerQuoteFee,
      receiver: new PublicKey(""),
      //   tempWSolAccount: tempWSolAccount.publicKey, // use only if your quoteMint is SOL & receiver != creator
    };

    console.log("Creating claim trading fee transaction...");
    const claimTransaction = await client.partner.claimPartnerTradingFee(
      claimTradingFeeParam
    );
    console.log("Claim transaction created, sending to network...");

    claimTransaction.feePayer = payer.publicKey;

    const claimSignature = await sendAndConfirmTransaction(
      connection,
      claimTransaction,
      [payer, partner],
      {
        commitment: "confirmed",
        skipPreflight: true,
        maxRetries: 5,
      }
    );
    console.log("Trading fees claimed successfully!");
    console.log(
      `Transaction: https://solscan.io/tx/${claimSignature}?cluster=devnet`
    );
  } catch (error) {
    console.error("Failed to claim trading fees:", error);
    console.log("Error details:", JSON.stringify(error, null, 2));
  }
}

claimPartnerTradingFee()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
