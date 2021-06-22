#!/usr/bin/env bash
rm -R code/node_modules
rm -R code/client/node_modules
rm -R code/relayer/node_modules
rm -R benchmark/node_modules
rm -R legacy/node_modules
rm -R legacy/webclient/node_modules
rm -R SmartOTP/node_modules

cd code; yarn install
cd relayer; yarn install; cd ..;
cd client; yarn install; cd ..;
cd..

cd benchmark; yarn install; cd ..;
cd SmartOTP; yarn install; cd ..;

cd legacy; yarn install; cd ..;
cd webclient; yarn install; cd ..;
cd ..
./patch/patch.sh

