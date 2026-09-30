@echo off
cd /d "%~dp0"
title Afterhours - Radmin VPN firewall setup
echo Run this file as administrator.
echo Detecting the VPN address and allowing peers only.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0allow-vpn-firewall.ps1"
pause
