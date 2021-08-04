#!/usr/bin/env bash
rm -Rf code/node_modules
rm -Rf code/client/node_modules
rm -Rf code/relayer/node_modules
rm -Rf benchmark/node_modules
rm -Rf legacy/node_modules
rm -Rf legacy/webclient/node_modules
rm -Rf SmartOTP/node_modules

cd code; yarn install
cd relayer; yarn install; cd ..;
cd client; yarn install; cd ..;
cd ..

cd benchmark; yarn install; cd ..;
cd SmartOTP; yarn install; cd ..;

cd legacy; yarn install; cd ..;
cd webclient; yarn install; cd ..;
cd ..

cp scripts/hdnode.js ./SmartOTP/node_modules/@harmony-js/account/dist/hdnode.js
./scripts/patch.sh

