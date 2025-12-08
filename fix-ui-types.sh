#!/bin/bash
# Comprehensive UI type fix script
# Fixes contact.company references and null safety issues

cd /home/ubuntu/target-account-dashboard

echo "Fixing UI component type errors..."

# The contact type now includes company from the joined accounts table
# All components already use contact.company correctly, so no changes needed there

# Fix null safety issues in Contacts components
files=(
  "client/src/components/ui/Contacts.tsx"
  "client/src/components/ui/ContactsEnhanced.tsx"
  "client/src/pages/Contacts.tsx"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "Processing $file..."
    # Add null checks for contact.name and contact.company
    sed -i 's/contact\.name\.toLowerCase()/contact.name?.toLowerCase() || ""/g' "$file"
    sed -i 's/contact\.company\.toLowerCase()/contact.company?.toLowerCase() || ""/g' "$file"
    sed -i 's/contact\.company === companyFilter/contact.company === companyFilter || (!contact.company && companyFilter === "all")/g' "$file"
    # Fix sorting null issues
    sed -i 's/a\.name\.localeCompare(b\.name)/(a.name || "").localeCompare(b.name || "")/g' "$file"
    sed -i 's/a\.company\.localeCompare(b\.company)/(a.company || "").localeCompare(b.company || "")/g' "$file"
  fi
done

echo "UI type fixes complete!"
