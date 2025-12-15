# Counter DApp - Midnight Preview Testnet

A simple counter smart contract demonstrating Midnight's zero-knowledge proofs.

## Prerequisites

- **Node.js 22+**: `node --version`
- **Docker**: `docker --version`
- **Compact Compiler**: Install with:
  ```bash
  curl --proto '=https' --tlsv1.2 -LsSf https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh
  source $HOME/.local/bin/env
  ```

## Quick Start

### 1. Install & Build

```bash
npm install
cd contract && npm run compact && npm run build
cd ../counter-cli && npm run build
```

### 2. Start Proof Server

In a separate terminal (keep it running):

```bash
docker run -p 6300:6300 midnightnetwork/proof-server:6.1.0-alpha.6 -- midnight-proof-server --network preview
```

### 3. Run the CLI

```bash
cd counter-cli
npm run preview
```

### 4. Create/Load Wallet

Choose one:
- **Option 1**: Build fresh wallet (will need funding)
- **Option 2**: Enter mnemonic manually
- **Option 3**: Use mnemonic from `.env` file (pre-configured)

### 5. Fund Your Wallet (if new)

1. Copy your wallet address from the CLI output
2. Visit [Preview Faucet](https://faucet.preview.midnight.network)
3. Request tokens and wait ~2 minutes

### 6. Deploy & Interact

1. Choose **Deploy** to create a new counter contract
2. Use **Increment** to increase the counter
3. Use **Display** to view current value

## Project Structure

```
├── contract/           # Compact smart contract
│   └── src/counter.compact
├── counter-cli/        # CLI application
└── .env               # Wallet mnemonic (pre-funded)
```

## Network Endpoints

| Service | URL |
|---------|-----|
| Faucet | https://faucet.preview.midnight.network |
| RPC | https://rpc.preview.midnight.network |
| Indexer | https://indexer.preview.midnight.network |

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `ECONNREFUSED 127.0.0.1:6300` | Start the proof server |
| `compact: command not found` | Run `source $HOME/.local/bin/env` |
| Balance stays 0 | Use faucet, wait 2-3 minutes |

## Links

- [Midnight Docs](https://docs.midnight.network/)
- [Compact Language](https://docs.midnight.network/compact)
