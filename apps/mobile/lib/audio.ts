import { Audio } from 'expo-av'
import { Platform } from 'react-native'

class AudioService {
  private recording: Audio.Recording | null = null
  private isRecording: boolean = false

  async requestPermissions(): Promise<boolean> {
    const { status } = await Audio.requestPermissionsAsync()
    return status === 'granted'
  }

  async startRecording(onDataAvailable?: (data: Uint8Array) => void): Promise<void> {
    try {
      const hasPermission = await this.requestPermissions()
      if (!hasPermission) {
        throw new Error('Audio recording permission not granted')
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      })

      const recording = new Audio.Recording()
      await recording.prepareToRecordAsync({
        android: {
          extension: '.m4a',
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        ios: {
          extension: '.m4a',
          outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: 'audio/webm',
          bitsPerSecond: 128000,
        },
      })

      await recording.startAsync()
      this.recording = recording
      this.isRecording = true

      console.log('Recording started')
    } catch (error) {
      console.error('Failed to start recording:', error)
      throw error
    }
  }

  async stopRecording(): Promise<string | null> {
    if (!this.recording) {
      return null
    }

    try {
      await this.recording.stopAndUnloadAsync()
      const uri = this.recording.getURI()
      this.recording = null
      this.isRecording = false

      console.log('Recording stopped, saved at:', uri)
      return uri
    } catch (error) {
      console.error('Failed to stop recording:', error)
      throw error
    }
  }

  async pauseRecording(): Promise<void> {
    if (this.recording && this.isRecording) {
      await this.recording.pauseAsync()
      this.isRecording = false
    }
  }

  async resumeRecording(): Promise<void> {
    if (this.recording && !this.isRecording) {
      await this.recording.startAsync()
      this.isRecording = true
    }
  }

  getIsRecording(): boolean {
    return this.isRecording
  }

  async playSound(uri: string): Promise<void> {
    try {
      const { sound } = await Audio.Sound.createAsync({ uri })
      await sound.playAsync()
    } catch (error) {
      console.error('Failed to play sound:', error)
      throw error
    }
  }
}

export const audioService = new AudioService()
