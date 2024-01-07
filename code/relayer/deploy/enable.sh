#!/bin/sh
sudo cp otp-wallet-relayer.service /etc/systemd/system/otp-wallet-relayer.service
sudo systemctl start otp-wallet-relayer
sudo systemctl enable otp-wallet-relayer
systemctl status otp-wallet-relayer
