#!/bin/bash
# Capture serial output for 10 seconds

echo "Capturing serial output from /dev/cu.usbmodem1101 at 115200 baud..."
echo "Will capture for 10 seconds..."
echo ""

# Use script command to capture screen output
script -q /tmp/mote_serial.log bash -c "screen /dev/cu.usbmodem1101 115200" &
SCREEN_PID=$!

# Wait 10 seconds
sleep 10

# Kill screen
killall screen 2>/dev/null

# Show captured output
echo "=== Captured Serial Output ==="
cat /tmp/mote_serial.log | grep -v "^Script" | head -100

exit 0
