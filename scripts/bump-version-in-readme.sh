#!/bin/bash

cd "$(dirname "$0")"

node lib/BumpVersionInReadme.js
git add ../README.md
