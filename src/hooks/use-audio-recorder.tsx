import { useState, useRef, useCallback, useEffect } from 'react'

export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [duration, setDuration] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [audioLevel, setAudioLevel] = useState(0)

  const mediaRecorder = useRef<MediaRecorder | null>(null)
  const audioContext = useRef<AudioContext | null>(null)
  const analyser = useRef<AnalyserNode | null>(null)
  const dataArray = useRef<Uint8Array | null>(null)
  const animationFrame = useRef<number | null>(null)
  const timerInterval = useRef<NodeJS.Timeout | null>(null)
  const chunks = useRef<BlobPart[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  const cleanup = useCallback(() => {
    if (animationFrame.current) cancelAnimationFrame(animationFrame.current)
    if (timerInterval.current) clearInterval(timerInterval.current)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (audioContext.current?.state !== 'closed') {
      audioContext.current?.close().catch(() => {})
    }
    audioContext.current = null
    analyser.current = null
    dataArray.current = null
    if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
      mediaRecorder.current.stop()
    }
    mediaRecorder.current = null
  }, [])

  useEffect(() => {
    return cleanup
  }, [cleanup])

  const updateAudioLevel = useCallback(() => {
    if (!analyser.current || !dataArray.current || isPaused) return
    analyser.current.getByteFrequencyData(dataArray.current)
    const sum = dataArray.current.reduce((a, b) => a + b, 0)
    const average = sum / dataArray.current.length
    setAudioLevel(Math.min(100, Math.round((average / 255) * 100 * 2)))
    animationFrame.current = requestAnimationFrame(updateAudioLevel)
  }, [isPaused])

  const startRecording = useCallback(async () => {
    try {
      setError(null)
      setAudioBlob(null)
      setDuration(0)
      setAudioLevel(0)
      chunks.current = []

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Navegador nao suporta gravacao de audio.')
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      streamRef.current = stream

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
      audioContext.current = new AudioContextClass()
      const source = audioContext.current.createMediaStreamSource(stream)
      analyser.current = audioContext.current.createAnalyser()
      analyser.current.fftSize = 256
      source.connect(analyser.current)
      dataArray.current = new Uint8Array(analyser.current.frequencyBinCount)

      const mimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus']
      let selectedMimeType = ''
      for (const type of mimeTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          selectedMimeType = type
          break
        }
      }

      if (!selectedMimeType) {
        throw new Error('Nenhum formato de audio suportado.')
      }

      mediaRecorder.current = new MediaRecorder(stream, { mimeType: selectedMimeType })

      mediaRecorder.current.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data)
      }

      mediaRecorder.current.onstop = () => {
        const blob = new Blob(chunks.current, { type: selectedMimeType })
        setAudioBlob(blob)
      }

      mediaRecorder.current.start(1000)
      setIsRecording(true)
      setIsPaused(false)

      timerInterval.current = setInterval(() => {
        setDuration((prev) => prev + 1)
      }, 1000)

      updateAudioLevel()
    } catch (err: any) {
      setError(
        err.name === 'NotAllowedError'
          ? 'Permissao de microfone negada. Habilite nas configuracoes do navegador.'
          : err.message || 'Erro ao acessar microfone.',
      )
      cleanup()
    }
  }, [cleanup, updateAudioLevel])

  const pauseRecording = useCallback(() => {
    if (mediaRecorder.current && mediaRecorder.current.state === 'recording') {
      mediaRecorder.current.pause()
      setIsPaused(true)
      if (timerInterval.current) clearInterval(timerInterval.current)
      if (animationFrame.current) cancelAnimationFrame(animationFrame.current)
      setAudioLevel(0)
    }
  }, [])

  const resumeRecording = useCallback(() => {
    if (mediaRecorder.current && mediaRecorder.current.state === 'paused') {
      mediaRecorder.current.resume()
      setIsPaused(false)
      timerInterval.current = setInterval(() => {
        setDuration((prev) => prev + 1)
      }, 1000)
      updateAudioLevel()
    }
  }, [updateAudioLevel])

  const stopRecording = useCallback(() => {
    if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
      mediaRecorder.current.stop()
      setIsRecording(false)
      setIsPaused(false)
      if (timerInterval.current) clearInterval(timerInterval.current)
      if (animationFrame.current) cancelAnimationFrame(animationFrame.current)
      setAudioLevel(0)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
      if (audioContext.current?.state !== 'closed') {
        audioContext.current?.close().catch(() => {})
      }
    }
  }, [])

  const resetRecording = useCallback(() => {
    cleanup()
    setAudioBlob(null)
    setDuration(0)
    setError(null)
    setAudioLevel(0)
    setIsRecording(false)
    setIsPaused(false)
  }, [cleanup])

  return {
    isRecording,
    isPaused,
    duration,
    audioBlob,
    error,
    audioLevel,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    resetRecording,
  }
}
