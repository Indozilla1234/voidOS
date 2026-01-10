#!/bin/bash

npm install uiohook-napi
npm install x11

# Ensure dependencies are installed
echo "Checking dependencies..."
sudo apt-get update
sudo apt-get install -y xvfb fluxbox x11vnc novnc python3-websockify gcc

# 1. Kill any zombie processes from previous attempts
pkill -f Xvfb
pkill -f x11vnc
pkill -f novnc

# 2. Start Xvfb (Virtual Monitor)
Xvfb :1 -screen 0 800x600x24 -ac &
export DISPLAY=:1
sleep 2

# 3. Start Fluxbox (Window Manager)
fluxbox &
sleep 1

# 4. Start x11vnc (The Server)
x11vnc -display :1 -nopw -forever -shared -rfbport 5900 -localhost &
sleep 2

# 5. Start noVNC Bridge
# Note: Path may vary. Using common Debian/Ubuntu path.
/usr/share/novnc/utils/novnc_proxy --vnc localhost:5900 --listen 6080 &

echo "-------------------------------------------------------"
echo "VNC stack is booting. Check port 6080 in your Ports tab."
echo "If you see a blank screen with a cursor, it's working!"
echo "-------------------------------------------------------"

# Compile and Run Trit-C
gcc trit-c_compiler.c -o tritc
./tritc