#!/usr/bin/env python3
import serial
import time
import sys

port = '/dev/cu.usbmodem1101'
baud = 115200

print(f"Opening {port} at {baud} baud...")
print("Press Ctrl+C to stop\n")

try:
    ser = serial.Serial(port, baud, timeout=0.1)
    time.sleep(0.5)  # Wait for connection

    start_time = time.time()
    line_count = 0

    while time.time() - start_time < 15:  # Read for 15 seconds
        if ser.in_waiting > 0:
            try:
                data = ser.read(ser.in_waiting)
                text = data.decode('utf-8', errors='replace')
                print(text, end='', flush=True)
                line_count += text.count('\n')
            except:
                pass
        time.sleep(0.01)

    ser.close()
    print(f"\n\nRead complete. Got {line_count} lines.")

except KeyboardInterrupt:
    print("\nStopped by user")
    sys.exit(0)
except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)
