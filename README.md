# approve-audit

Find the ERC-20 approvals your wallets still hand out to contracts you have forgotten, and revoke
them in one command.

Wallet drainers work by asking for an allowance once and keeping it. Revoking is the only durable
fix, but every revoker in the wild wants a wallet connection and a browser. This one does not: it
reads the `Approval` event and builds the revoke itself.

## Run

```bash
npx --yes github:sahajpatel123/approve-audit scan --owner 0xYourAddress
```

No install, no wallet connect, no browser. Or clone and `node bin/cli.js scan --owner 0x…`.

## Use

```bash
approve-audit scan --owner 0xYourAddress --blocks 50000
```

```
LIVE  0xdAC17F958D2ee523a2206206994597C13D831ec7  spender 0x63c79fcc…  115792089237316195423570985008687907853269984665640564039457584007913129639935
stale 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48  spender 0x000000000022D4…  0
```

`LIVE` means the allowance is still open. Revoke it:

```bash
approve-audit revoke --owner 0xYourAddress --token 0xdAC17… --spender 0x63c7…
```

The key is read from `PRIVATE_KEY`, or from `.env` in the working directory or your home. Chains:
`--chain 1|42161|8453|10|137`.

## Notes

- Only the `Approval` event is read, so no indexer and no balance calls.
- `--blocks` caps the window; 50000 is roughly a week on mainnet. Narrow it on free RPCs.
- Set `RPC_URL` to use your own node. Public defaults are fine for a scan.

## Licence

MIT
