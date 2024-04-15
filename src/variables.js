module.exports = {
	initVariables: function () {
		let self = this

		let variables = []

		//variables.push({ variableId: 'version', name: 'Version' })

		variables.push({ variableId: 'bufferCount', name: 'Buffer Count (as configured)' })

		for (let i = 1; i <= 4; i++) {
			variables.push({ variableId: `bufferFramesRecorded_${i}`, name: `Buffer ${i} Frames Recorded` })
			variables.push({ variableId: `bufferSecondsRecorded_${i}`, name: `Buffer ${i} Seconds Recorded` })
			variables.push({ variableId: `bufferFramesAvailable_${i}`, name: `Buffer ${i} Frames Available` })
			variables.push({ variableId: `bufferSecondsAvailable_${i}`, name: `Buffer ${i} Seconds Available` })
			variables.push({ variableId: `bufferStatus_${i}`, name: `Buffer ${i} Status` })
			variables.push({ variableId: `bufferPos_${i}`, name: `Buffer ${i} Playback Position` })
			variables.push({ variableId: `bufferPosSeconds_${i}`, name: `Buffer ${i} Playback Position Seconds` })
			variables.push({ variableId: `bufferSpeed_${i}`, name: `Buffer ${i} Playback Speed` })
			variables.push({ variableId: `bufferMarkIn_${i}`, name: `Buffer ${i} Mark In Position` })
			variables.push({ variableId: `bufferMarkInSeconds_${i}`, name: `Buffer ${i} Mark In Position Seconds` })
			variables.push({ variableId: `bufferMarkOut_${i}`, name: `Buffer ${i} Mark Out Position` })
			variables.push({ variableId: `bufferMarkOutSeconds_${i}`, name: `Buffer ${i} Mark Out Position Seconds` })
		}

		variables.push({ variableId: 'currentRecordingBuffer', name: 'Current Recording Buffer' })
		variables.push({ variableId: 'currentPlaybackBuffer', name: 'Current Playback Buffer' })

		variables.push({ variableId: 'currentRecordingMode', name: 'Current Recording Mode' })
		variables.push({ variableId: 'currentPlaybackMode', name: 'Current Playback Mode' })
		variables.push({ variableId: 'currentStopMode', name: 'Current Stop Mode' })

		variables.push({ variableId: 'videoMode', name: 'Current Output Video Mode' })
		variables.push({ variableId: 'frameRate', name: 'Current Frame Rate Mode' })

		variables.push({ variableId: 'lastCommand', name: 'Last Command Sent' })
		variables.push({ variableId: 'lastCommandResponse', name: 'Last Command Response' })

		//variables.push({ variableId: 'activePhases', name: 'Active Phases' })
		//variables.push({ variableId: 'currentSensorFPS', name: 'Current Sensor FPS' })
		//variables.push({ variableId: 'currentDisplayFPS', name: 'Current Output/Display FPS' })

		self.setVariableDefinitions(variables)

		//set the unused text for unused buffer variables
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

			//variableValues['version'] = JSON.stringify(self.DATA.version)

			let frameRate = 1

			//look up the frame rate in the CHOICES_FRAME_RATES array, if it exists, use the frame rate, otherwise use the mode
			let frameRateMode = self.CHOICES_FRAME_RATE_MODES.find((rate) => rate.id.toString() === self.DATA.frameRateMode?.toString())
			if (frameRateMode) {
				variableValues['frameRate'] = frameRateMode.label
				frameRate = parseInt(frameRateMode.label)
			} else {
				variableValues['frameRate'] = 'Mode ' + self.DATA.frameRateMode
				frameRate = parseInt(self.DATA.frameRateMode)
			}

			for (let i = 1; i <= self.config.recordingBuffers; i++) {
				//loop through self.DATA.buffers and if the buffer number matches the current buffer, set the values
				let buffer = self.DATA.buffers.find((buffer) => buffer.buffer === i)
				if (buffer) {
					variableValues[`bufferFramesRecorded_${i}`] = buffer.recorded
					//calculate seconds recorded based on the amount recorded, the frame rate and speed
					let secondsRecorded = Number.parseFloat((buffer.recorded / frameRate)/buffer.speed).toFixed(2);



					if (isNaN(secondsRecorded)) {
						secondsRecorded = 0
					}
					variableValues[`bufferSecondsRecorded_${i}`] = secondsRecorded
					variableValues[`bufferFramesAvailable_${i}`] = buffer.available
					let secondsAvailable = Number.parseFloat((buffer.available / frameRate)/buffer.speed).toFixed(2);
					if (isNaN(secondsAvailable)) {
						secondsAvailable = 0
					}
					variableValues[`bufferSecondsAvailable_${i}`] = secondsAvailable
					variableValues[`bufferStatus_${i}`] = buffer.status
					variableValues[`bufferPos_${i}`] = buffer.pos
					let secondsPos = Number.parseFloat((buffer.pos / frameRate)/buffer.speed).toFixed(2);
					if (isNaN(secondsPos)) {
						secondsPos = 0
					}
					variableValues[`bufferPosSeconds_${i}`] = secondsPos
					variableValues[`bufferSpeed_${i}`] = buffer.speed
					variableValues[`bufferMarkIn_${i}`] = buffer.markIn
					let secondsMarkIn = Number.parseFloat((buffer.markIn / frameRate)/buffer.speed).toFixed(2);
					if (isNaN(secondsMarkIn)) {
						secondsMarkIn = 0
					}
					variableValues[`bufferMarkInSeconds_${i}`] = secondsMarkIn
					variableValues[`bufferMarkOut_${i}`] = buffer.markOut
					let secondsMarkOut = Number.parseFloat((buffer.markOut / frameRate)/buffer.speed).toFixed(2);
					if (isNaN(secondsMarkOut)) {
						secondsMarkOut = 0
					}
					variableValues[`bufferMarkOutSeconds_${i}`] = secondsMarkOut
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

			//look up the video mode in the CHOICES_VIDEO_MODES array, if it exists, use the label, otherwise use the mode
			let videoMode = self.CHOICES_VIDEO_MODES.find((mode) => mode.id === self.DATA.videoMode?.toString())
			if (videoMode) {
				variableValues['videoMode'] = videoMode.label
			} else {
				variableValues['videoMode'] = self.DATA.videoMode
			}

			//variableValues['activePhases'] = self.DATA.activePhases
			//variableValues['currentSensorFPS'] = self.DATA.sensorFPS
			//variableValues['currentDisplayFPS'] = self.DATA.displayFPS

			variableValues['lastCommand'] = self.lastCommand
			variableValues['lastCommandResponse'] = self.lastResponse

			self.setVariableValues(variableValues)
		} catch (error) {
			self.log('error', 'Error setting Variables: ' + String(error))
			console.log(error)
		}
	},
}
