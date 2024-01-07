#!/bin/sh
sudo cp otp-wallet-backend.service /etc/systemd/system/otp-wallet-backend.service
sudo systemctl start otp-wallet-backend
sudo systemctl enable otp-wallet-backend
systemctl status otp-wallet-backend
