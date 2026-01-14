import { BleManager, Device, Characteristic } from 'react-native-ble-plx'
import { Platform, PermissionsAndroid } from 'react-native'

// BLE Service and Characteristic UUIDs for Mote device
// TODO: Update these with actual UUIDs from firmware
const MOTE_SERVICE_UUID = '00000000-0000-1000-8000-00805f9b34fb'
const AUDIO_CHARACTERISTIC_UUID = '00000001-0000-1000-8000-00805f9b34fb'
const COMMAND_CHARACTERISTIC_UUID = '00000002-0000-1000-8000-00805f9b34fb'
const STATUS_CHARACTERISTIC_UUID = '00000003-0000-1000-8000-00805f9b34fb'

class BluetoothService {
  private manager: BleManager
  private connectedDevice: Device | null = null

  constructor() {
    this.manager = new BleManager()
  }

  async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'android') {
      if (Platform.Version >= 31) {
        // Android 12+
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ])

        return Object.values(granted).every(
          (permission) => permission === PermissionsAndroid.RESULTS.GRANTED
        )
      } else {
        // Android < 12
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        )
        return granted === PermissionsAndroid.RESULTS.GRANTED
      }
    }
    return true // iOS handles permissions automatically
  }

  async scanForDevices(
    onDeviceFound: (device: Device) => void,
    durationMs: number = 10000
  ): Promise<void> {
    const hasPermissions = await this.requestPermissions()
    if (!hasPermissions) {
      throw new Error('Bluetooth permissions not granted')
    }

    const subscription = this.manager.onStateChange((state) => {
      if (state === 'PoweredOn') {
        this.manager.startDeviceScan(
          null,
          null,
          (error, device) => {
            if (error) {
              console.error('Scan error:', error)
              return
            }

            if (device && device.name?.includes('Mote')) {
              onDeviceFound(device)
            }
          }
        )

        // Stop scan after duration
        setTimeout(() => {
          this.manager.stopDeviceScan()
        }, durationMs)

        subscription.remove()
      }
    }, true)
  }

  async connectToDevice(deviceId: string): Promise<Device> {
    try {
      const device = await this.manager.connectToDevice(deviceId)
      await device.discoverAllServicesAndCharacteristics()
      this.connectedDevice = device
      return device
    } catch (error) {
      console.error('Connection error:', error)
      throw error
    }
  }

  async disconnect(): Promise<void> {
    if (this.connectedDevice) {
      await this.connectedDevice.cancelConnection()
      this.connectedDevice = null
    }
  }

  async sendAudioData(audioData: Uint8Array): Promise<void> {
    if (!this.connectedDevice) {
      throw new Error('No device connected')
    }

    try {
      const base64Data = Buffer.from(audioData).toString('base64')
      await this.connectedDevice.writeCharacteristicWithResponseForService(
        MOTE_SERVICE_UUID,
        AUDIO_CHARACTERISTIC_UUID,
        base64Data
      )
    } catch (error) {
      console.error('Send audio error:', error)
      throw error
    }
  }

  async sendCommand(command: number): Promise<void> {
    if (!this.connectedDevice) {
      throw new Error('No device connected')
    }

    try {
      const commandData = Buffer.from([command]).toString('base64')
      await this.connectedDevice.writeCharacteristicWithResponseForService(
        MOTE_SERVICE_UUID,
        COMMAND_CHARACTERISTIC_UUID,
        commandData
      )
    } catch (error) {
      console.error('Send command error:', error)
      throw error
    }
  }

  async subscribeToStatus(
    callback: (status: { batteryLevel: number }) => void
  ): Promise<() => void> {
    if (!this.connectedDevice) {
      throw new Error('No device connected')
    }

    const subscription = this.connectedDevice.monitorCharacteristicForService(
      MOTE_SERVICE_UUID,
      STATUS_CHARACTERISTIC_UUID,
      (error, characteristic) => {
        if (error) {
          console.error('Status monitor error:', error)
          return
        }

        if (characteristic?.value) {
          const data = Buffer.from(characteristic.value, 'base64')
          const batteryLevel = data[0]
          callback({ batteryLevel })
        }
      }
    )

    return () => subscription.remove()
  }

  isConnected(): boolean {
    return this.connectedDevice !== null
  }

  getConnectedDevice(): Device | null {
    return this.connectedDevice
  }
}

export const bluetoothService = new BluetoothService()
