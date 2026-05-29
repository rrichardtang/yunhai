#!/usr/bin/env node
const { generateCodes, seedOwnerEntitlement } = require('../src/entitlements');

const args = process.argv.slice(2);
const ownerFlag = args.indexOf('--owner');
if (ownerFlag !== -1) {
  const userId = args[ownerFlag + 1];
  if (!userId) {
    console.error('Usage: node scripts/mint-invite-codes.js --owner <clerk-user-id>');
    process.exit(1);
  }
  const seeded = seedOwnerEntitlement(userId);
  console.log(seeded ? `Seeded owner entitlement for ${userId}` : `${userId} already entitled`);
  process.exit(0);
}

const count = parseInt(args[0], 10) || 5;
const codes = generateCodes(count);
console.log(`Minted ${codes.length} invite codes:`);
codes.forEach((c) => console.log(`  ${c}`));
