import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';

/**
 * Audio Service
 * Handles audio recording and playback for voice interactions
 */
export class AudioService {
  private recorder: Audio.Recording | null = null;
  private sound: Audio.Sound | null = null;

  /**
   * Request microphone permissions
   */
  async requestPermissions(): Promise<boolean> {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      return granted;
    } catch (error) {
      console.error('[AudioService] Failed to request permissions:', error);
      return false;
    }
  }

  /**
   * Start recording audio
   * Returns the recording URI when stopped
   */
  async startRecording(): Promise<void> {
    try {
      console.log('[AudioService] Step 1: Requesting permissions');
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        throw new Error('Microphone permission not granted');
      }
      console.log('[AudioService] Step 2: Permissions granted');

      // Stop any existing recording
      if (this.recorder) {
        console.log('[AudioService] Step 3: Stopping existing recording');
        await this.stopRecording();
      }

      // Set audio mode for recording
      console.log('[AudioService] Step 4: Setting audio mode');
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Create new recorder
      console.log('[AudioService] Step 5: Creating recorder');
      this.recorder = new Audio.Recording();

      console.log('[AudioService] Step 6: Preparing recorder');
      await this.recorder.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);

      console.log('[AudioService] Step 7: Starting recording');
      await this.recorder.startAsync();
      console.log('[AudioService] Recording started successfully');
    } catch (error) {
      console.error('[AudioService] Failed to start recording:', error);
      throw error;
    }
  }

  /**
   * Stop recording and return the file URI
   */
  async stopRecording(): Promise<string | null> {
    if (!this.recorder) {
      console.warn('[AudioService] No recording in progress');
      return null;
    }

    try {
      await this.recorder.stopAndUnloadAsync();
      const uri = this.recorder.getURI();
      this.recorder = null;

      console.log('[AudioService] Recording stopped, URI:', uri);
      return uri;
    } catch (error) {
      console.error('[AudioService] Failed to stop recording:', error);
      this.recorder = null;
      throw error;
    }
  }

  /**
   * Get recording status (duration, metering level, etc.)
   */
  async getRecordingStatus() {
    if (!this.recorder) return null;

    try {
      return this.recorder.getStatus();
    } catch (error) {
      console.error('[AudioService] Failed to get recording status:', error);
      return null;
    }
  }

  /**
   * Read audio file as base64 string
   */
  async readAudioAsBase64(uri: string): Promise<string> {
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: 'base64',
      });
      return base64;
    } catch (error) {
      console.error('[AudioService] Failed to read audio file:', error);
      throw error;
    }
  }

  /**
   * Play audio from base64 string
   * @param base64Audio - Base64 encoded audio data
   * @param format - Audio format (default: mp3)
   */
  async playAudio(base64Audio: string, format: 'mp3' | 'wav' = 'mp3'): Promise<void> {
    try {
      // Stop previous playback
      if (this.sound) {
        await this.stopPlayback();
      }

      // Set audio mode for playback with maximum volume
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: false,
      });

      // Create and load sound from data URI
      const { sound } = await Audio.Sound.createAsync(
        { uri: `data:audio/${format};base64,${base64Audio}` },
        { shouldPlay: true, volume: 1.0 }
      );

      // Set volume to maximum after creating sound
      await sound.setVolumeAsync(1.0);
      this.sound = sound;

      console.log('[AudioService] Playing audio at full volume');
    } catch (error) {
      console.error('[AudioService] Failed to play audio:', error);
      throw error;
    }
  }

  /**
   * Play audio from file URI
   */
  async playAudioFile(uri: string): Promise<void> {
    try {
      // Stop previous playback
      if (this.sound) {
        await this.stopPlayback();
      }

      // Set audio mode for playback with maximum volume
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: false,
      });

      // Create and load sound from file
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true, volume: 1.0 }
      );

      // Set volume to maximum after creating sound
      await sound.setVolumeAsync(1.0);
      this.sound = sound;

      console.log('[AudioService] Playing audio file at full volume:', uri);
    } catch (error) {
      console.error('[AudioService] Failed to play audio file:', error);
      throw error;
    }
  }

  /**
   * Stop playback
   */
  async stopPlayback(): Promise<void> {
    if (!this.sound) {
      console.warn('[AudioService] No audio playing');
      return;
    }

    try {
      await this.sound.stopAsync();
      await this.sound.unloadAsync();
      this.sound = null;
      console.log('[AudioService] Playback stopped');
    } catch (error) {
      console.error('[AudioService] Failed to stop playback:', error);
      throw error;
    }
  }

  /**
   * Get current playback status
   */
  async getPlaybackStatus() {
    if (!this.sound) return null;

    try {
      return await this.sound.getStatusAsync();
    } catch (error) {
      console.error('[AudioService] Failed to get playback status:', error);
      return null;
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    try {
      if (this.recorder) {
        await this.recorder.stopAndUnloadAsync();
        this.recorder = null;
      }

      if (this.sound) {
        await this.sound.stopAsync();
        await this.sound.unloadAsync();
        this.sound = null;
      }

      console.log('[AudioService] Cleanup complete');
    } catch (error) {
      console.error('[AudioService] Cleanup error:', error);
    }
  }
}

/**
 * Singleton instance for app-wide use
 */
export const audioService = new AudioService();
