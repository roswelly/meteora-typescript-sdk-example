import { AllocationByAmount, LockLiquidityAllocation } from "../types";
import BN from "bn.js";
import { PublicKey } from "@solana/web3.js";

export function fromAllocationsToAmount(
  lpAmount: BN,
  allocations: LockLiquidityAllocation[]
): AllocationByAmount[] {
  const sumPercentage = allocations.reduce(
    (partialSum, a) => partialSum + a.percentage,
    0
  );
  if (sumPercentage === 0) {
    throw Error("sumPercentage is zero");
  } else if (sumPercentage > 100) {
    throw Error("sumPercentage is greater than 100");
  }

  const amounts: AllocationByAmount[] = [];
  let sum = new BN(0);
  for (let i = 0; i < allocations.length - 1; i++) {
    const allocation = allocations[i];
    if (!allocation) {
      throw new Error(`Allocation at index ${i} is undefined`);
    }
    const amount = lpAmount
      .mul(new BN(allocation.percentage))
      .div(new BN(sumPercentage));
    sum = sum.add(amount);
    amounts.push({
      address: new PublicKey(allocation.address),
      amount,
      percentage: allocation.percentage,
    });
  }
  // the last wallet get remaining amount
  const lastAllocation = allocations[allocations.length - 1];
  if (!lastAllocation) {
    throw new Error(`Last allocation is undefined`);
  }
  amounts.push({
    address: new PublicKey(lastAllocation.address),
    amount: lpAmount.sub(sum),
    percentage: lastAllocation.percentage,
  });
  return amounts;
}
