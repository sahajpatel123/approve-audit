#!/usr/bin/env node
// approve-audit — list and revoke stale ERC-20 approvals.
//
//   approve-audit scan --owner 0x… [--blocks 50000]
//   approve-audit revoke --owner 0x… --token 0x… --spender 0x…
//
// Reads only the Approval event, so it never touches a balance and never needs an indexer.

import { createPublicClient, http, parseAbi, getAddress } from 'viem'
import { mainnet, arbitrum, base, optimism, polygon } from 'viem/chains'
import { readFileSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'

const CHAINS = { 1: mainnet, 42161: arbitrum, 8453: base, 10: optimism, 137: polygon }
const APPROVAL = '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925'
const ERC20 = parseAbi(['function approve(address,uint256) returns (bool)', 'function allowance(address,address) view returns (uint256)'])

const argv = process.argv.slice(2)
const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d }
const cmd = argv[0]

function key() {
  if (process.env.PRIVATE_KEY) return process.env.PRIVATE_KEY
  for (const f of ['.env', `${homedir()}/.env`, `${homedir()}/.foundry/.env`]) {
    if (!existsSync(f)) continue
    const m = /(?:PRIVATE_KEY|PRIVATEKEY|DEPLOYER_PRIVATE_KEY)\s*=\s*["']?(0x[0-9a-fA-F]{64})/.exec(readFileSync(f, 'utf8'))
    if (m) return m[1]
  }
  return null
}

function client(chainId) {
  const chain = CHAINS[Number(chainId)]
  if (!chain) throw new Error(`unsupported chain ${chainId}`)
  const rpc = process.env.RPC_URL ?? chain.rpcUrls.default.http[0]
  return createPublicClient({ chain, transport: http(rpc) })
}

async function scan() {
  const owner = getAddress(opt('owner'))
  const chainId = opt('chain', '1')
  const blocks = BigInt(opt('blocks', '50000'))
  const c = client(chainId)
  const head = await c.getBlockNumber()
  const from = head > blocks ? head - blocks : 0n
  const logs = await c.getLogs({
    fromBlock: from, toBlock: head, event: parseAbiItem('event Approval(address indexed owner, address indexed spender, uint256 value)'),
    args: { owner },
  }).catch(() => [])
  const rows = logs.map((l) => ({ token: l.address, spender: l.args.spender, value: l.args.value }))
  if (!rows.length) { console.log('no approvals in the window'); return }
  for (const r of rows) {
    const live = await c.readContract({ address: r.token, abi: ERC20, functionName: 'allowance', args: [owner, r.spender] }).catch(() => 0n)
    console.log(`${live > 0n ? 'LIVE ' : 'stale'}  ${r.token}  spender ${r.spender}  ${live}`)
  }
}

async function revoke() {
  const { privateKeyToAccount } = await import('viem/accounts')
  const { createWalletClient } = await import('viem')
  const k = key()
  if (!k) throw new Error('no key: set PRIVATE_KEY or keep one in .env')
  const owner = privateKeyToAccount(k)
  const c = client(opt('chain', '1'))
  const wallet = createWalletClient({ chain: c.chain, account: owner, transport: http() })
  const hash = await wallet.writeContract({
    address: getAddress(opt('token')), abi: ERC20, functionName: 'approve',
    args: [getAddress(opt('spender')), 0n],
  })
  console.log(`revoked ${opt('spender')} on ${opt('token')}  ${hash}`)
  await c.waitForTransactionReceipt({ hash })
  console.log('done')
}

const run = { scan, revoke }[cmd]
if (!run) { console.log('usage: approve-audit scan|revoke --owner 0x… [--token … --spender …]'); process.exit(2) }
run().catch((e) => { console.error(`error: ${e.shortMessage ?? e.message}`); process.exit(1) })
