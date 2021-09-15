#!/usr/bin/env bash
FROM=$1
TO=$2
mkdir -p cache/$TO
cp cache/$FROM/* cache/$TO
