#!/bin/bash

# Fix all TypeScript errors systematically

cd /home/ubuntu/target-account-dashboard

echo "Fixing TypeScript errors..."

# 1. Fix .employees → .employeeCount (11 errors)
echo "1. Replacing .employees with .employeeCount..."
find client/src -name "*.tsx" -type f -exec sed -i 's/\.employees\([^C]\)/.employeeCount\1/g' {} \;
find client/src -name "*.tsx" -type f -exec sed -i 's/relatedAccount\.employees/relatedAccount.employeeCount/g' {} \;
find client/src -name "*.tsx" -type f -exec sed -i 's/selectedAccount\.employees/selectedAccount.employeeCount/g' {} \;
find client/src -name "*.tsx" -type f -exec sed -i 's/account\.employees/account.employeeCount/g' {} \;

# 2. Fix type mismatches - number to string for Link href (18 errors)
echo "2. Fixing number to string conversions for Link href..."
find client/src -name "*.tsx" -type f -exec sed -i 's|href={account\.id}|href={`/accounts/${account.id}`}|g' {} \;
find client/src -name "*.tsx" -type f -exec sed -i 's|href={contact\.id}|href={`/contacts/${contact.id}`}|g' {} \;
find client/src -name "*.tsx" -type f -exec sed -i 's|href={call\.id}|href={`/calls/${call.id}`}|g' {} \;

# 3. Fix 'never' type errors by adding proper type guards
echo "3. Fixing 'never' type errors..."
# These need manual fixes in specific files

echo "Done! Check remaining errors with: pnpm tsc --noEmit"
