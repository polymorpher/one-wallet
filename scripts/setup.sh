#!/usr/bin/env bash

cd code; yarn install
cd relayer; yarn install; cd ..;
cd client; yarn install; cd ..;
cd ..

./scripts/patch.sh

