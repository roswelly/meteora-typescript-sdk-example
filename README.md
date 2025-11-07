# Meteora TypeScript Examples

This repository contains practical code examples and implementations designed to help developers work with Meteora's SDKs. The goal is to provide simple, easy-to-understand examples that can be used as a starting point for building more complex applications.

updated according to recent update meteora dbc and damm v2

## Features

-  **Professional Code Quality**: Type-safe, well-structured code following best practices
-  **Shared Utilities**: Reusable utilities for common operations (validation, transactions, etc.)
-  **Error Handling**: Comprehensive error handling with proper error messages
-  **Environment Variables**: Support for environment variables for sensitive data
-  **Transaction Utilities**: Robust transaction confirmation with retry logic
- **Type Safety**: Full TypeScript support with explicit types

## Project Structure

```
meteora-sdk-sample/
├── shared/                    # Shared utilities and constants
│   ├── constants.ts           # Common constants (RPC URLs, commitments, etc.)
│   ├── utils.ts               # Utility functions (validation, keypair creation)
│   └── transaction-utils.ts   # Transaction confirmation utilities
├── dbc/                       # Dynamic Bonding Curve examples
│   ├── src/
│   │   ├── create-config.ts
│   │   ├── create-pool.ts
│   │   ├── get-config.ts
│   │   ├── claim-creator-trading-fee.ts
│   │   └── claim-partner-trading-fee.ts
│   └── README.md
├── dlmm/                      # Dynamic Liquidity Market Maker examples
│   ├── src/
│   │   ├── create-pool.ts
│   │   ├── seed-liquidity.ts
│   │   ├── create-position/
│   │   ├── get-position/
│   │   └── manage-position/
│   └── README.md
├── damm/                      # Dynamic AMM V1 examples
│   ├── src/
│   │   ├── create-pool/
│   │   ├── claim-fees/
│   │   ├── helpers/
│   │   └── lock-liquidity-stake2earn.ts
│   └── README.md
└── damm-v2/                   # Dynamic AMM V2 examples
    ├── src/
    │   ├── create-pool.ts
    │   ├── lock-position.ts
    │   ├── claim-position-fee.ts
    │   ├── get-user-positions.ts
    │   └── split-position-legacy.ts
    └── README.md
```

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- TypeScript knowledge
- Basic understanding of Solana blockchain

### Installation

Each module has its own dependencies. Navigate to the module directory and install:

```bash
# For Dynamic Bonding Curve
cd dbc
npm install

# For DLMM
cd ../dlmm
npm install

# For DAMM V1
cd ../damm
npm install

# For DAMM V2
cd ../damm-v2
npm install
```

## Environment Variables

The examples support environment variables for sensitive data. Create a `.env` file in the module directory or set environment variables:

```bash
# Connection
RPC_URL=https://api.mainnet-beta.solana.com

# Private Keys (base58 encoded)
USER_PRIVATE_KEY=your_private_key_here
PAYER_PRIVATE_KEY=your_payer_private_key_here
OWNER_PRIVATE_KEY=your_owner_private_key_here

# Addresses
POOL_ADDRESS=your_pool_address_here
WALLET_ADDRESS=your_wallet_address_here
CONFIG_ADDRESS=your_config_address_here

# Token Mints (optional, defaults provided)
TOKEN_A_MINT=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
TOKEN_B_MINT=So11111111111111111111111111111111111111112
```

** Security Note**: Never commit private keys or sensitive data to version control. Always use environment variables or secure key management systems.

## Shared Utilities

The `shared/` directory contains reusable utilities:

### Constants (`shared/constants.ts`)

```typescript
import { DEFAULT_RPC_URL, DEFAULT_COMMITMENT, USDC_MINT, SOL_MINT } from "../../../shared/constants";
```

### Utilities (`shared/utils.ts`)

```typescript
import { 
  createConnection, 
  createKeypairFromPrivateKey, 
  validatePublicKey,
  formatError 
} from "../../../shared/utils";

// Create connection
const connection = createConnection(process.env.RPC_URL);

// Create keypair from private key
const keypair = createKeypairFromPrivateKey(process.env.PRIVATE_KEY);

// Validate public key
validatePublicKey(address, "Pool address");
```

### Transaction Utilities (`shared/transaction-utils.ts`)

```typescript
import { confirmTransactionWithRetry, getLatestBlockhashSafe } from "../../../shared/transaction-utils";

// Get latest blockhash safely
const { blockhash, lastValidBlockHeight } = await getLatestBlockhashSafe(connection);

// Confirm transaction with retry logic
await confirmTransactionWithRetry(
  connection,
  signature,
  blockhash,
  lastValidBlockHeight
);
```

## Examples

### Dynamic Bonding Curve (DBC)

Check out the [Dynamic Bonding Curve](./dbc/README.md) examples.

**Available Scripts:**
- `create-config`: Create a new DBC configuration
- `create-pool`: Create a new DBC pool
- `get-config`: Retrieve and display pool configuration
- `claim-creator-trading-fee`: Claim creator trading fees
- `claim-partner-trading-fee`: Claim partner trading fees

### DLMM (Dynamic Liquidity Market Maker)

Check out the [DLMM](./dlmm/README.md) examples.

**Available Scripts:**
- `create-pool`: Create a new DLMM pool
- `seed-liquidity`: Seed initial liquidity
- `create-balance-position`: Create a balanced position
- `create-imbalance-position`: Create an imbalanced position
- `create-one-sided-position`: Create a one-sided position
- `add-liquidity`: Add liquidity to existing position
- `get-positions-list`: Get list of user positions
- `get-active-bin`: Get active bin information

### DAMM V1 (Dynamic AMM V1)

Check out the [DAMM V1](./damm/README.md) examples.

**Available Scripts:**
- `create-constant-product-pool`: Create a constant product pool
- `claim-lock-fees`: Claim locked fees
- `get-lock-fees`: Get locked fees information

### DAMM V2 (Dynamic AMM V2)

Check out the [DAMM V2](./damm-v2/README.md) examples.

**Available Scripts:**
- `create-pool`: Create a new DAMM V2 pool
- `lock-position`: Lock a position
- `claim-position-fee`: Claim position fees
- `get-user-positions`: Get user positions
- `split-position-legacy`: Split a legacy position
- `refresh-liquidity-and-lock-position`: Refresh liquidity and lock position

## Code Quality

This project follows professional development standards:

- **Type Safety**: Full TypeScript with explicit types, minimal `any` usage
- **Error Handling**: Proper error propagation with descriptive messages
- **Code Organization**: Shared utilities to reduce duplication
- **Validation**: Input validation for all user-provided data
- **Consistency**: Standardized patterns across all modules
- **Documentation**: Clear code structure and comments

## Running Examples

1. Navigate to the module directory:
   ```bash
   cd damm
   ```

2. Set up environment variables (create `.env` file or export variables)

3. Run the example script:
   ```bash
   npm run create-constant-product-pool
   ```

## Best Practices

1. **Always validate inputs**: Use the shared validation utilities
2. **Use environment variables**: Never hardcode private keys
3. **Handle errors properly**: Use try-catch and proper error messages
4. **Use shared utilities**: Leverage the shared utilities for common operations
5. **Check transaction confirmations**: Use the transaction utilities for reliable confirmation

## Troubleshooting

### Common Issues

1. **"Private key is required"**: Make sure you've set the environment variable or provided a valid private key
2. **"Invalid public key format"**: Verify the address is a valid Solana public key
3. **Transaction failures**: Check your RPC endpoint and network connectivity
4. **Type errors**: Ensure all dependencies are installed and TypeScript is properly configured

### Getting Help

- Check the module-specific README files for detailed examples
- Review the shared utilities for common patterns
- Ensure all dependencies are up to date

## Contributing

When adding new examples:

1. Follow the established code patterns
2. Use shared utilities where possible
3. Add proper error handling
4. Include environment variable support
5. Update the relevant README

## License

ISC

## Disclaimer

These examples are provided for educational purposes. Always test thoroughly on devnet before using on mainnet. Never share or commit private keys.
