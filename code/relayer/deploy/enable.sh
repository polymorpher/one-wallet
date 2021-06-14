#!/bin/sh
sudo cp onewallet-relayer.service /etc/systemd/system/onewallet-relayer.service
sudo systemctl start onewallet-relayer
sudo systemctl enable onewallet-relayer
systemctl status onewallet-relayer
