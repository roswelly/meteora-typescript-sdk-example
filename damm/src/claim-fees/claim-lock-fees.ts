import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import AmmImpl from "@meteora-ag/dynamic-amm-sdk";
import bs58 from "bs58";
import { ComputeBudgetProgram } from "@solana/web3.js";

async function checkAndClaimLockFees(
  connection: Connection,
  poolAddress: PublicKey,
  owner: Keypair,
  payer: Keypair,
  receiver?: Keypair
) {
  try {
    // init AMM instance
    const amm = await AmmImpl.create(connection as any, poolAddress);

    // get user's lock escrow info
    const lockEscrow = await amm.getUserLockEscrow(owner.publicKey);

    if (!lockEscrow) {
      console.log("No lock escrow found for this user");
      return;
    }

    // check if there are unclaimed fees
    const unclaimedFees = lockEscrow.fee.unClaimed;

    if (unclaimedFees?.lp?.isZero()) {
      console.log("No unclaimed fees available");
      return;
    }

    console.log("Unclaimed fees:");
    console.log(`LP tokens: ${unclaimedFees?.lp?.toString()}`);
    console.log(`Token A: ${unclaimedFees.tokenA.toString()}`);
    console.log(`Token B: ${unclaimedFees.tokenB.toString()}`);

    const amountToClaim = unclaimedFees.lp;

    if (!amountToClaim) {
      console.log("No LP amount available to claim");
      return;
    }

    const tempWSolAcc = Keypair.generate();

    // create and send claim transaction
    const claimTx = await amm.claimLockFee(
      owner.publicKey,
      amountToClaim,
      payer.publicKey,
      receiver?.publicKey,
      tempWSolAcc?.publicKey
    );

    // Add priority fees
    const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({
      units: 300000,
    });
    const addPriorityFee = ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 50000,
    });

    claimTx.add(modifyComputeUnits);
    claimTx.add(addPriorityFee);

    // sign and send transaction
    const signers = [owner];
    if (payer) signers.push(payer);
    if (receiver) signers.push(tempWSolAcc);

    const signature = await connection.sendTransaction(claimTx as any, signers);

    console.log(`Claim transaction sent: ${signature}`);
    console.log("Waiting for confirmation...");

    const maxRetries = 3;
    let retryCount = 0;
    let confirmed = false;

    while (retryCount < maxRetries && !confirmed) {
      try {
        const confirmation = await connection.confirmTransaction(
          {
            signature,
            blockhash: claimTx.recentBlockhash!,
            lastValidBlockHeight: (
              await connection.getLatestBlockhash()
            ).lastValidBlockHeight,
          },
          "confirmed"
        );

        if (confirmation.value.err) {
          throw new Error(`Transaction failed: ${confirmation.value.err}`);
        }

        confirmed = true;
        console.log("Fees claimed successfully!");
      } catch (error) {
        retryCount++;
        if (retryCount === maxRetries) {
          console.error(`Transaction failed after ${maxRetries} attempts.`);
          console.error(
            "Please check the transaction status manually using the signature above."
          );
          throw error;
        }
        console.log(`Confirmation attempt ${retryCount} failed, retrying...`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
  } catch (error) {
    console.error("Error claiming fees:", error);
  }
}

async function main() {
  try {
    const poolAddress = new PublicKey("");

    const PAYER_PRIVATE_KEY = "";
    const payerSecretKey = bs58.decode(PAYER_PRIVATE_KEY);
    const payer = Keypair.fromSecretKey(payerSecretKey);
    console.log("Payer public key:", payer.publicKey.toBase58());

    const OWNER_PRIVATE_KEY = "";
    const ownerSecretKey = bs58.decode(OWNER_PRIVATE_KEY);
    const owner = Keypair.fromSecretKey(ownerSecretKey);
    console.log("Owner public key:", owner.publicKey.toBase58());

    const RECEIVER_PRIVATE_KEY = "";
    const receiverSecretKey = bs58.decode(RECEIVER_PRIVATE_KEY);
    const receiver = Keypair.fromSecretKey(receiverSecretKey);
    console.log("Receiver public key:", receiver.publicKey.toBase58());

    const connection = new Connection(
      "https://api.mainnet-beta.solana.com",
      "confirmed"
    );

    await checkAndClaimLockFees(connection, poolAddress, owner, payer);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

main();
