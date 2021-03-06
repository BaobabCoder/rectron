const {desktopCapturer, ipcRenderer, remote} = require('electron')
const domify = require('domify')

let localStream
let microAudioStream
let recordedChunks = []
let numRecordedChunks = 0
let recorder
let includeMic = false
// let includeSysAudio = false

document.addEventListener('DOMContentLoaded', () => {
  document.querySelector('#pick-source').addEventListener('click', pickSource)
  document.querySelector('#record-camera').addEventListener('click', recordCamera)
  document.querySelector('#play-video').addEventListener('click', playVideo)
  document.querySelector('#micro-audio').addEventListener('click', microAudioCheck)
  // document.querySelector('#system-audio').addEventListener('click', sysAudioCheck)
  document.querySelector('#record-stop').addEventListener('click', stopRecording)
  document.querySelector('#play-button').addEventListener('click', play)
  document.querySelector('#download-button').addEventListener('click', showTypeButtons)//download)
})

const playVideo = () => {
  remote.dialog.showOpenDialog({properties: ['openFile']}, (filename) => {
    console.log(filename)
    let video = document.querySelector('video')
    video.muted = false
    video.controls = true
    video.src = filename
  })
}

const disableButtons = () => {
  document.querySelector('#pick-source').disabled = true
  document.querySelector('#record-camera').disabled = true
  document.querySelector('#record-stop').hidden = false
  document.querySelector('#play-button').hidden = true
  document.querySelector('#download-button').hidden = true
}

const enableButtons = () => {
  document.querySelector('#pick-source').disabled = false
  document.querySelector('#record-camera').disabled = false
  document.querySelector('#record-stop').hidden = true
  document.querySelector('#play-button').hidden = true
  document.querySelector('#download-button').hidden = true
}

const showTypeButtons = () => {
  document.querySelector('#media-type-container').classList.add('show');
}
const hideMediaTypeContainer = () => {
  document.querySelector('#media-type-container').classList.remove('show');
}

const microAudioCheck = () => {
  // includeSysAudio = false
  // document.querySelector('#system-audio').checked = false

  // Mute video so we don't play loopback audio.
  var video = document.querySelector('video')
  video.muted = true
  includeMic = !includeMic
  if(includeMic)
    document.querySelector('#micro-audio-btn').classList.add('active');
  else
    document.querySelector('#micro-audio-btn').classList.remove('active');
  console.log('Audio =', includeMic)

  if (includeMic) {
    navigator.webkitGetUserMedia({ audio: true, video: false },
        getMicroAudio, getUserMediaError)
  }
}

// function sysAudioCheck () {
  // // Mute video so we don't play loopback audio
  // var video = document.querySelector('video')
  // video.muted = true

  // includeSysAudio = !includeSysAudio
  // includeMic = false
  // document.querySelector('#micro-audio').checked = false
  // console.log('System Audio =', includeSysAudio)
// };

const cleanRecord = () => {
  let video = document.querySelector('video');
  video.controls = false;
  recordedChunks = []
  numRecordedChunks = 0
}

ipcRenderer.on('source-id-selected', (event, sourceId) => {
  // Users have cancel the picker dialog.
  if (!sourceId) return
  console.log(sourceId)
  onAccessApproved(sourceId)
})

const pickSource = () => {
  cleanRecord()
  ipcRenderer.send('show-picker', { types: ['screen'] })
}

const recordCamera = () => {
  cleanRecord()
  navigator.webkitGetUserMedia({
    audio: false,
    video: { mandatory: { minWidth: 1280, minHeight: 720 } }
  }, getMediaStream, getUserMediaError)
}

const recorderOnDataAvailable = (event) => {
  if (event.data && event.data.size > 0) {
    recordedChunks.push(event.data)
    numRecordedChunks += event.data.byteLength
  }
}

const stopRecording = () => {
  console.log('Stopping record and starting download')
  enableButtons()
  document.querySelector('#play-button').hidden = false
  document.querySelector('#download-button').hidden = false
  recorder.stop()
  localStream.getVideoTracks()[0].stop()
}

const play = () => {
  // Unmute video.
  let video = document.querySelector('video')
  video.controls = true;
  video.muted = false
  let blob = new Blob(recordedChunks, {type: 'video/webm;codecs=h264'})
  video.src = window.URL.createObjectURL(blob)
}

const download = (mimeType, extension) => {
  let blob = new Blob(recordedChunks, {type: mimeType})
  let url = URL.createObjectURL(blob)
  let a = document.createElement('a')
  document.body.appendChild(a)
  a.style = 'display: none'
  a.href = url
  a.download = 'electron-screen-recorder.' + extension;
  a.click()
  setTimeout(function () {
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
    hideMediaTypeContainer()
  }, 100)
}

const getMediaStream = (stream) => {
  let video = document.querySelector('video')
  video.src = URL.createObjectURL(stream)
  localStream = stream
  stream.onended = () => { console.log('Media stream ended.') }

  let videoTracks = localStream.getVideoTracks()

  if (includeMic) {
    console.log('Adding audio track.')
    let audioTracks = microAudioStream.getAudioTracks()
    localStream.addTrack(audioTracks[0])
  }
  // if (includeSysAudio) {
    // console.log('Adding system audio track.')
    // let audioTracks = stream.getoAudioTracks()
    // if (audioTracks.length < 1) {
      // console.log('No audio track in screen stream.')
    // }
  // } else {
    // console.log('Not adding audio track.')
  // }
  try {
    console.log('Start recording the stream.')
    recorder = new MediaRecorder(stream)
  } catch (e) {
    console.assert(false, 'Exception while creating MediaRecorder: ' + e)
    return
  }
  recorder.ondataavailable = recorderOnDataAvailable
  recorder.onstop = () => { console.log('recorderOnStop fired') }
  recorder.start()
  console.log('Recorder is started.')
  disableButtons()
}

const getMicroAudio = (stream) => {
  console.log('Received audio stream.')
  microAudioStream = stream
  stream.onended = () => { console.log('Micro audio ended.') }
}

const getUserMediaError = () => {
  console.log('getUserMedia() failed.')
}

const onAccessApproved = (id) => {
  if (!id) {
    console.log('Access rejected.')
    return
  }
  console.log('Window ID: ', id)
  navigator.webkitGetUserMedia({
    audio: false,
    video: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: id,
      maxWidth: window.screen.width, maxHeight: window.screen.height } }
  }, getMediaStream, getUserMediaError)
}
