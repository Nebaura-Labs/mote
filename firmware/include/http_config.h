#ifndef HTTP_CONFIG_H
#define HTTP_CONFIG_H

#include <Arduino.h>
#include <WiFi.h>

/**
 * Simple HTTP Configuration Server
 *
 * Provides HTTP endpoints for device configuration:
 * - GET /status - Returns device status as JSON
 * - POST /config - Accepts WiFi configuration
 *
 * Runs on port 80 (default HTTP port)
 */

// Initialize HTTP config server
void setupHttpConfig();

// Handle HTTP requests in loop()
void handleHttpConfig();

// Battery monitoring (forward declarations)
extern float getMoteBatteryVoltage();
extern int getMoteBatteryPercent();

#endif // HTTP_CONFIG_H
