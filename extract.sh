#!/bin/bash

# Ensure a file name is provided
if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <filename>"
  exit 1
fi

filename=$1

# Extract emails and print them
sed -n 's/.*"emailAddress":"\([^"]*\)".*/\1/p' "$filename"
