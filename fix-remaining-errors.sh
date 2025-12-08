#!/bin/bash

# Fix account.employees → account.employeeCount
find client/src -name "*.tsx" -type f -exec sed -i 's/account\.employees/account.employeeCount/g' {} +
find client/src -name "*.tsx" -type f -exec sed -i 's/account\?\.employees/account?.employeeCount/g' {} +

# Fix call.participants (doesn't exist in schema, remove or comment out)
find client/src -name "*.tsx" -type f -exec sed -i 's/call\.participants/null \/\/ participants field removed/g' {} +
find client/src -name "*.tsx" -type f -exec sed -i 's/call\?\.participants/null \/\/ participants field removed/g' {} +

# Fix contact.rawData (doesn't exist in contacts schema)
find client/src -name "*.tsx" -type f -exec sed -i 's/contact\.rawData/null \/\/ rawData field removed/g' {} +
find client/src -name "*.tsx" -type f -exec sed -i 's/contact\?\.rawData/null \/\/ rawData field removed/g' {} +

# Fix rfp.type references
find client/src -name "*.tsx" -type f -exec sed -i 's/rfp\.type/"government"/g' {} +
find client/src -name "*.tsx" -type f -exec sed -i 's/rfp\?\.type/"government"/g' {} +

echo "Fixed common property name errors"
