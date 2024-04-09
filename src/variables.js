module.exports = {
	initVariables: function () {
		let self = this

		let variables = []

		variables.push({ variableId: 'version', name: 'Version' })

		variables.push({ variableId: 'bufferCount', name: 'Buffer Count (as configured)' })

		for (let i = 1; i <= 4; i++) {
			variables.push({ variableId: `bufferFramesRecorded_${i}`, name: `Buffer ${i} Frames Recorded` })
			variables.push({ variableId: `bufferFramesAvailable_${i}`, name: `Buffer ${i} Frames Available` })
			variables.push({ variableId: `bufferStatus_${i}`, name: `Buffer ${i} Status` })
		}

		variables.push({ variableId: 'currentRecordingBuffer', name: 'Current Recording Buffer' })
		variables.push({ variableId: 'currentPlaybackBuffer', name: 'Current Playback Buffer' })
		variables.push({ variableId: 'lastPlaybackSpeed', name: 'Last Playback Speed' })

		variables.push({ variableId: 'currentRecordingMode', name: 'Current Recording Mode' })
		variables.push({ variableId: 'currentPlaybackMode', name: 'Current Playback Mode' })
		variables.push({ variableId: 'currentStopMode', name: 'Current Stop Mode' })

		variables.push({ variableId: 'currentFramePosition', name: 'Current Frame Position of Playback Buffer' })
		variables.push({ variableId: 'currentPlaybackMarkerIn', name: 'Current Playback Marker In' })
		variables.push({ variableId: 'currentPlaybackMarkerOut', name: 'Current Playback Marker Out' })

		variables.push({ variableId: 'videoMode', name: 'Current Output Video Mode' })
		variables.push({ variableId: 'frameRate', name: 'Current Frame Rate Mode' })

		variables.push({ variableId: 'lastCommand', name: 'Last Command Sent' })
		variables.push({ variableId: 'lastCommandResponse', name: 'Last Command Response' })

		//variables.push({ variableId: 'activePhases', name: 'Active Phases' })
		//variables.push({ variableId: 'currentSensorFPS', name: 'Current Sensor FPS' })
		//variables.push({ variableId: 'currentDisplayFPS', name: 'Current Output/Display FPS' })

		self.setVariableDefinitions(variables)

		//set the unused text for unused buffer variables
		let totalBuffersUnused = 4 - self.config.recordingBuffers
		let unusedBufferText = self.config.unusedBufferText
		let variableValues = {}

		variableValues['bufferCount'] = self.config.recordingBuffers

		for (let i = 4; i > self.config.recordingBuffers; i--) {
			variableValues[`bufferFramesRecorded_${i}`] = unusedBufferText
			variableValues[`bufferFramesAvailable_${i}`] = unusedBufferText
			variableValues[`bufferStatus_${i}`] = unusedBufferText
		}
		self.setVariableValues(variableValues)
	},

	checkVariables: function () {
		let self = this

		try {
			let variableValues = {}

			variableValues['version'] = self.DATA.version

			for (let i = 1; i <= self.config.recordingBuffers; i++) {
				//loop through self.DATA.buffers and if the buffer number matches the current buffer, set the values
				let buffer = self.DATA.buffers.find((buffer) => buffer.buffer === i)
				if (buffer) {
					variableValues[`bufferFramesRecorded_${i}`] = buffer.recorded
					variableValues[`bufferFramesAvailable_${i}`] = buffer.available
					variableValues[`bufferStatus_${i}`] = buffer.status
				} else {
					variableValues[`bufferFramesRecorded_${i}`] = 0
					variableValues[`bufferFramesAvailable_${i}`] = 0
					variableValues[`bufferStatus_${i}`] = 'Unknown'
				}
			}

			variableValues['currentRecordingBuffer'] = self.DATA.currentRecordingBuffer
			variableValues['currentPlaybackBuffer'] = self.DATA.currentPlaybackBuffer

			//look up the last speed in the CHOICES_SPEEDS array, if it exists, use the label, otherwise use the speed
			let lastSpeed = self.CHOICES_SPEEDS.find((speed) => speed.id === self.DATA.lastSpeed)
			if (lastSpeed) {
				variableValues['lastPlaybackSpeed'] = lastSpeed.label
			} else {
				variableValues['lastPlaybackSpeed'] = self.DATA.lastSpeed
			}

			//look up the recording mode in the CHOICES_RECORDING_MODE array, if it exists, use the label, otherwise use the mode
			let recordingMode = self.CHOICES_RECORDING_MODE.find((mode) => mode.id === self.DATA.recordingMode)
			if (recordingMode) {
				variableValues['currentRecordingMode'] = recordingMode.label
			} else {
				variableValues['currentRecordingMode'] = self.DATA.recordingMode
			}

			//look up the playback mode in the CHOICES_PLAYBACK_MODE array, if it exists, use the label, otherwise use the mode
			let playbackMode = self.CHOICES_PLAYBACK_MODE.find((mode) => mode.id === self.DATA.playbackMode)
			if (playbackMode) {
				variableValues['currentPlaybackMode'] = playbackMode.label
			} else {
				variableValues['currentPlaybackMode'] = self.DATA.playbackMode
			}

			//look up the stop mode in the CHOICES_STOP_MODE array, if it exists, use the label, otherwise use the mode
			let stopMode = self.CHOICES_STOP_MODE.find((mode) => mode.id === self.DATA.stopMode)
			if (stopMode) {
				variableValues['currentStopMode'] = stopMode.label
			} else {
				variableValues['currentStopMode'] = self.DATA.stopMode
			}

			variableValues['currentFramePosition'] = self.DATA.pos
			variableValues['currentPlaybackMarkerIn'] = self.DATA.markIn
			variableValues['currentPlaybackMarkerOut'] = self.DATA.markOut

			//look up the video mode in the CHOICES_VIDEO_MODES array, if it exists, use the label, otherwise use the mode
			let videoMode = self.CHOICES_VIDEO_MODES.find((mode) => mode.id === self.DATA.videoMode?.toString())
			if (videoMode) {
				variableValues['videoMode'] = videoMode.label
			} else {
				variableValues['videoMode'] = self.DATA.videoMode
			}

			//look up the frame rate in the CHOICES_FRAME_RATES array, if it exists, use the frame rate, otherwise use the mode
			let frameRate = self.CHOICES_FRAME_RATES.find((rate) => rate.id === self.DATA.frameRate)
			if (frameRate) {
				variableValues['frameRate'] = frameRate.frameRate
			} else {
				variableValues['frameRate'] = self.DATA.frameRate
			}

			//variableValues['activePhases'] = self.DATA.activePhases
			//variableValues['currentSensorFPS'] = self.DATA.sensorFPS
			//variableValues['currentDisplayFPS'] = self.DATA.displayFPS

			variableValues['lastCommand'] = self.DATA.lastCommand
			variableValues['lastCommandResponse'] = self.DATA.lastResponse

			self.setVariableValues(variableValues)
		} catch (error) {
			self.log('error', 'Error setting Variables: ' + String(error))
			console.log(error)
		}
	},
}
