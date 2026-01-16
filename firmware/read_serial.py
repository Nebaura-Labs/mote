#!/usr/bin/env python3
import serial
import time

port = '/dev/cu.usbmodem1101'
baud = 115200

print(f"Opening {port} at {baud} baud...")
print("Reading for 15 seconds...\n")

try:
    ser = serial.Serial(port, baud, timeout=1)
    time.sleep(1)  # Wait for connection

    start_time = time.time()
    while time.time() - start_time < 15:
        if ser.in_waiting > 0:
            line = ser.readline().decode('utf-8', errors='ignore').strip()
            if line:
                print(line)

    ser.close()
    print("\nDone reading serial output.")

except Exception as e:
    print(f"Error: {e}")
