#!/bin/bash

# 1. Kill any zombie processes from previous attempts
pkill -f Xvfb
pkill -f x11vnc
pkill -f novnc

# 2. Start Xvfb (Virtual Monitor)
# We use -ac to disable access control for the local connection
Xvfb :1 -screen 0 800x600x24 -ac &
export DISPLAY=:1
sleep 2 # Wait for Xvfb to stabilize

# 3. Start Fluxbox (Window Manager)
fluxbox &
sleep 1

# 4. Start x11vnc (The Server)
# -localhost ensures it only listens internally (safer)
# -rfbport 5900 forces the port
x11vnc -display :1 -nopw -forever -shared -rfbport 5900 -localhost &
sleep 2

# 5. Start noVNC Bridge (The Browser Client)
/usr/share/novnc/utils/novnc_proxy --vnc localhost:5900 --listen 6080 &

echo "-------------------------------------------------------"
echo "VNC stack is booting. Check port 6080 in your Ports tab."
echo "If you see a blank screen with a cursor, it's working!"
echo "-------------------------------------------------------"