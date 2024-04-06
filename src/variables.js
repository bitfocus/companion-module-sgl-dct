module.exports = {
	initVariables: function () {
		let self = this

		let variables = []

		for (let i = 1; i <= 4; i++) {
			variables.push({ variableId: `bufferFramesRecorded_${i}`, name: `Buffer ${i} Frames Recorded` })
			variables.push({ variableId: `bufferFramesAvailable_${i}`, name: `Buffer ${i} Frames Available` })
			variables.push({ variableId: `bufferStatus${i}`, name: `Buffer ${i} Status` })
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

		variables.push({ variableId: 'videoMode', name: 'Current Video Mode' })
		variables.push({ variableId: 'activePhases', name: 'Active Phases' })
		variables.push({ variableId: 'currentSensorFPS', name: 'Current Sensor FPS' })
		variables.push({ variableId: 'currentDisplayFPS', name: 'Current Output/Display FPS' })

		self.setVariableDefinitions(variables)

		//set the unused text for unused buffer variables
		let i = 4 - self.config.buffers
		let unusedBufferText = self.config.unusedBufferText
		for (i; i <= 4; i++) {
			self.setVariable(`bufferFramesRecorded_${i}`, unusedBufferText)
			self.setVariable(`bufferFramesAvailable_${i}`, unusedBufferText)
			self.setVariable(`bufferStatus${i}`, unusedBufferText)
		}
	},

	checkVariables: function () {
		let self = this

		try {
			let variableValues = {}

			for (let i = 1; i <= self.config.buffers; i++) {
				//loop through self.DATA.buffers and if the buffer number matches the current buffer, set the values
				let buffer = self.DATA.buffers.find((buffer) => buffer.buffer === i)
				if (buffer) {
					variableValues[`bufferFramesRecorded_${i}`] = buffer.recorded
					variableValues[`bufferFramesAvailable_${i}`] = buffer.available
					variableValues[`bufferStatus${i}`] = buffer.status
				} else {
					variableValues[`bufferFramesRecorded_${i}`] = 0
					variableValues[`bufferFramesAvailable_${i}`] = 0
					variableValues[`bufferStatus${i}`] = 'Unknown'
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

			variableValues['currentRecordingMode'] = self.DATA.recordingMode
			variableValues['currentPlaybackMode'] = self.DATA.playbackMode
			variableValues['currentStopMode'] = self.DATA.stopMode

			variableValues['currentFramePosition'] = self.DATA.pos
			variableValues['currentPlaybackMarkerIn'] = self.DATA.markIn
			variableValues['currentPlaybackMarkerOut'] = self.DATA.markOut

			variableValues['videoMode'] = self.DATA.videoMode
			variableValues['activePhases'] = self.DATA.activePhases
			variableValues['currentSensorFPS'] = self.DATA.sensorFPS
			variableValues['currentDisplayFPS'] = self.DATA.displayFPS

			self.setVariableValues(variableValues)
		} catch (error) {
			self.log('error', 'Error setting Variables: ' + String(error))
			console.log(error)
		}
	},
}
