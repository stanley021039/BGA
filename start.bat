@echo off
cd /d "%~dp0"
title Afterhours - Board games
echo Start the server, then use the localhost URL printed below.
echo Friends: connect to the same VPN and use Copy invitation in the lobby.
node server.js
pause
