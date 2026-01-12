'use client';


import { Mic, Square, Pause, Play, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAudioDevices, useAudioRecorder } from '@/hooks/use-audio';

interface AudioRecorderProps {
  onRecordingComplete: (blob: Blob) => void;
  disabled?: boolean;
}

export function AudioRecorder({ onRecordingComplete, disabled }: AudioRecorderProps) {
  const {
    devices,
    selectedDeviceId,
    setSelectedDeviceId,
    error: deviceError,
    hasPermission,
    requestPermission,
  } = useAudioDevices();

  const {
    isRecording,
    isPaused,
    duration,
    audioBlob,
    audioUrl,
    error: recordingError,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    clearRecording,
  } = useAudioRecorder();

  const handleStartRecording = async () => {
    if (!hasPermission) {
      const granted = await requestPermission();
      if (!granted) return;
    }
    await startRecording(selectedDeviceId || undefined);
  };

  const handleUseRecording = () => {
    if (audioBlob) {
      onRecordingComplete(audioBlob);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const error = deviceError || recordingError;

  return (
    <Card className="w-full">
      <CardContent className="p-6">
        {/* Device selector */}
        {devices.length > 1 && !isRecording && !audioBlob && (
          <div className="mb-4">
            <label className="text-sm font-medium mb-2 block">Microphone</label>
            <Select value={selectedDeviceId} onValueChange={setSelectedDeviceId}>
              <SelectTrigger>
                <SelectValue placeholder="Select microphone" />
              </SelectTrigger>
              <SelectContent>
                {devices.map((device) => (
                  <SelectItem key={device.deviceId} value={device.deviceId}>
                    {device.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Recording controls */}
        <div className="flex flex-col items-center gap-4">
          {!isRecording && !audioBlob && (
            <Button
              size="lg"
              onClick={handleStartRecording}
              disabled={disabled}
              className="w-24 h-24 rounded-full"
            >
              <Mic className="h-10 w-10" />
            </Button>
          )}

          {isRecording && (
            <>
              <div className="text-4xl font-mono tabular-nums">
                {formatDuration(duration)}
              </div>
              
              <div className="flex items-center gap-2 h-8">
                <span className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${isPaused ? 'bg-yellow-500' : 'bg-red-500 animate-pulse'}`} />
                  <span className="text-sm text-muted-foreground">
                    {isPaused ? 'Paused' : 'Recording'}
                  </span>
                </span>
              </div>

              <div className="flex gap-2">
                {isPaused ? (
                  <Button variant="outline" size="icon" onClick={resumeRecording}>
                    <Play className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button variant="outline" size="icon" onClick={pauseRecording}>
                    <Pause className="h-4 w-4" />
                  </Button>
                )}
                <Button variant="destructive" size="icon" onClick={stopRecording}>
                  <Square className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}

          {audioBlob && !isRecording && (
            <>
              <div className="text-2xl font-mono tabular-nums text-muted-foreground">
                {formatDuration(duration)}
              </div>

              {audioUrl && (
                <audio controls src={audioUrl} className="w-full max-w-md" />
              )}

              <div className="flex gap-2">
                <Button variant="outline" onClick={clearRecording}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Discard
                </Button>
                <Button onClick={handleUseRecording}>
                  <Upload className="h-4 w-4 mr-2" />
                  Use Recording
                </Button>
              </div>
            </>
          )}
        </div>

        {error && (
          <p className="text-sm text-destructive mt-4 text-center">{error}</p>
        )}

        {!hasPermission && !isRecording && !audioBlob && (
          <p className="text-sm text-muted-foreground mt-4 text-center">
            Click the microphone to start recording
          </p>
        )}
      </CardContent>
    </Card>
  );
}
