import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

export interface LockLiquidityAllocation {
  percentage: number;
  address: string;
}

export type AllocationByAmount = {
  address: PublicKey;
  amount: BN;
  percentage: number;
};
