import { useState, useRef, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { audioService } from '@/lib/audio-service';
import { client } from '@/utils/orpc';

export interface VoiceChatState {
  isListening: boolean;
  isSpeaking: boolean;
  isProcessing: boolean;
  error: string | null;
  transcription: string | null;
  response: string | null;
}

export interface VoiceChatOptions {
  /**
   * Auto-listen after bot response for follow-up questions
   * Default: true
   */
  autoListen?: boolean;

  /**
   * Timeout in ms to wait for follow-up after bot response
   * Default: 5000 (5 seconds)
   */
  followUpTimeout?: number;

  /**
   * Device ID for session tracking
   */
  deviceId?: string;

  /**
   * Callback when conversation ends
   */
  onConversationEnd?: () => void;

  /**
   * Callback when error occurs
   */
  onError?: (error: Error) => void;
}

/**
 * Voice Chat Hook
 * Manages voice conversation flow with auto-listen for follow-up questions
 */
export function useVoiceChat(options: VoiceChatOptions = {}) {
  const {
    autoListen = true,
    followUpTimeout = 5000,
    deviceId,
    onConversationEnd,
    onError,
  } = options;

  const [state, setState] = useState<VoiceChatState>({
    isListening: false,
    isSpeaking: false,
    isProcessing: false,
    error: null,
    transcription: null,
    response: null,
  });

  // Session management
  const sessionIdRef = useRef<string | null>(null);
  const followUpTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isConversationActiveRef = useRef(false);

  /**
   * Clear follow-up timer
   */
  const clearFollowUpTimer = useCallback(() => {
    if (followUpTimerRef.current) {
      clearTimeout(followUpTimerRef.current);
      followUpTimerRef.current = null;
    }
  }, []);

  /**
   * End conversation and cleanup
   */
  const endConversation = useCallback(() => {
    console.log('[useVoiceChat] Ending conversation');
    clearFollowUpTimer();
    sessionIdRef.current = null;
    isConversationActiveRef.current = false;

    setState((prev) => ({
      ...prev,
      isListening: false,
      isSpeaking: false,
      isProcessing: false,
    }));

    onConversationEnd?.();
  }, [clearFollowUpTimer, onConversationEnd]);

  /**
   * Start listening for user input
   */
  const startListening = useCallback(async () => {
    try {
      console.log('[useVoiceChat] Starting to listen');

      setState((prev) => ({
        ...prev,
        isListening: true,
        error: null,
      }));

      await audioService.startRecording();

      console.log('[useVoiceChat] Recording started successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start recording';
      console.error('[useVoiceChat] Start listening error:', error);

      setState((prev) => ({
        ...prev,
        isListening: false,
        error: errorMessage,
      }));

      onError?.(error instanceof Error ? error : new Error(errorMessage));
    }
  }, [onError]);

  /**
   * Stop listening and process the recorded audio
   */
  const stopListening = useCallback(async () => {
    try {
      console.log('[useVoiceChat] Stopping listening');

      const uri = await audioService.stopRecording();

      if (!uri) {
        throw new Error('No audio recorded');
      }

      setState((prev) => ({
        ...prev,
        isListening: false,
        isProcessing: true,
      }));

      // Read audio file as base64
      const audioBase64 = await audioService.readAudioAsBase64(uri);

      // Create session ID if new conversation
      if (!sessionIdRef.current) {
        sessionIdRef.current = uuidv4();
      }

      console.log('[useVoiceChat] Sending audio to backend');

      // Send to backend for processing
      const result = await client.voice.chat({
        audio: audioBase64,
        sessionId: sessionIdRef.current,
        deviceId,
      });

      console.log('[useVoiceChat] Received response:', {
        transcription: result.transcription,
        duration: result.duration,
      });

      setState((prev) => ({
        ...prev,
        isProcessing: false,
        isSpeaking: true,
        transcription: result.transcription,
        response: result.response,
      }));

      // Play audio response
      await audioService.playAudio(result.audio, 'mp3');

      // Wait for audio to finish playing before starting recording again
      const playbackStatus = await audioService.getPlaybackStatus();
      if (playbackStatus && 'durationMillis' in playbackStatus && playbackStatus.durationMillis) {
        console.log(`[useVoiceChat] Waiting ${playbackStatus.durationMillis}ms for audio to finish`);
        await new Promise(resolve => setTimeout(resolve, playbackStatus.durationMillis));
      }

      setState((prev) => ({
        ...prev,
        isSpeaking: false,
      }));

      // If auto-listen is enabled, start listening again after timeout
      if (autoListen && isConversationActiveRef.current) {
        console.log(`[useVoiceChat] Starting ${followUpTimeout}ms follow-up timer`);

        followUpTimerRef.current = setTimeout(() => {
          console.log('[useVoiceChat] Follow-up timeout reached, ending conversation');
          endConversation();
        }, followUpTimeout);

        // Start listening for follow-up after audio completes
        await startListening();
      } else {
        endConversation();
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to process voice message';
      console.error('[useVoiceChat] Stop listening error:', error);

      setState((prev) => ({
        ...prev,
        isListening: false,
        isProcessing: false,
        isSpeaking: false,
        error: errorMessage,
      }));

      endConversation();
      onError?.(error instanceof Error ? error : new Error(errorMessage));
    }
  }, [autoListen, followUpTimeout, deviceId, endConversation, startListening, onError]);

  /**
   * Send a voice message (record + process)
   * Use this for manual "push-to-talk" style interaction
   */
  const sendVoiceMessage = useCallback(async () => {
    // Start new conversation
    isConversationActiveRef.current = true;
    sessionIdRef.current = uuidv4();

    await startListening();
  }, [startListening]);

  /**
   * Cancel current operation
   */
  const cancel = useCallback(async () => {
    console.log('[useVoiceChat] Canceling');

    try {
      if (state.isListening) {
        await audioService.stopRecording();
      }

      if (state.isSpeaking) {
        await audioService.stopPlayback();
      }

      endConversation();
    } catch (error) {
      console.error('[useVoiceChat] Cancel error:', error);
    }
  }, [state.isListening, state.isSpeaking, endConversation]);

  /**
   * Reset user input detected flag when user speaks during follow-up period
   */
  const onUserSpoke = useCallback(() => {
    // Clear the follow-up timer since user is engaging
    clearFollowUpTimer();
  }, [clearFollowUpTimer]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      clearFollowUpTimer();
      audioService.cleanup();
    };
  }, [clearFollowUpTimer]);

  return {
    ...state,
    isActive: isConversationActiveRef.current,
    sessionId: sessionIdRef.current,

    // Actions
    sendVoiceMessage,
    startListening,
    stopListening,
    cancel,
    onUserSpoke,
    endConversation,
  };
}
