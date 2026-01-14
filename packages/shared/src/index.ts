/**
 * @mote/shared
 *
 * Shared types and constants for Mote project
 */

// Device Pin Configuration
export const MOTE_PINS = {
  // Display (SPI)
  TFT_MOSI: 23,
  TFT_SCLK: 18,
  TFT_CS: 5,
  TFT_DC: 4,
  TFT_RST: 2,
  TFT_BL: 17,

  // Microphone (I2S Input)
  MIC_SCK: 14,
  MIC_WS: 32,
  MIC_SD: 15,

  // Amplifier (I2S Output)
  AMP_BCLK: 26,
  AMP_LRC: 25,
  AMP_DIN: 22,

  // Buttons
  BTN_VOL_UP: 33,
  BTN_VOL_DOWN: 27,
  BTN_MUTE: 12,

  // Battery
  BATTERY_ADC: 34,
} as const;

// BLE Commands (example structure)
export enum BLECommand {
  WAKE_WORD_DETECTED = 0x01,
  AUDIO_DATA = 0x02,
  VOLUME_UP = 0x03,
  VOLUME_DOWN = 0x04,
  MUTE_TOGGLE = 0x05,
  BATTERY_STATUS = 0x06,
  DEVICE_STATUS = 0x07,
}

// Device Types
export interface DeviceStatus {
  battery: number; // 0-100%
  volume: number; // 0-100%
  muted: boolean;
  connected: boolean;
}

export interface AudioPacket {
  data: Uint8Array;
  timestamp: number;
}
