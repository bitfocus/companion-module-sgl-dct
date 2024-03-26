module.exports = {
	initVariables: function () {
		let self = this

		let variables = []

		for (let i = 1; i <= self.config.recordingBuffers; i++) {
			variables.push({ variableId: `bufferFramesRecorded_${i}`, label: `Buffer ${i} Frames Recorded` })
			variables.push({ variableId: `bufferFramesAvailable_${i}`, label: `Buffer ${i} Frames Available` })
			variables.push({ variableId: `bufferStatus${i}`, label: `Buffer ${i} Status` })
		}

		variables.push({ variableId: 'currentRecordingBuffer', label: 'Current Recording Buffer' })
		variables.push({ variableId: 'currentPlaybackBuffer', label: 'Current Playback Buffer' })

		variables.push({ variableId: 'currentRecordingMode', label: 'Current Recording Mode' })
		variables.push({ variableId: 'currentPlaybackMode', label: 'Current Playback Mode' })
		variables.push({ variableId: 'currentStopMode', label: 'Current Stop Mode' })

		variables.push({ variableId: 'currentFramePosition', label: 'Current Frame Position of Playback Buffer' })
		variables.push({ variableId: 'currentPlaybackMarkerIn', label: 'Current Playback Marker In' })
		variables.push({ variableId: 'currentPlaybackMarkerOut', label: 'Current Playback Marker Out' })

		self.setVariableDefinitions(variables)
	},

	checkVariables: function () {
		let self = this

		try {
			let variableValues = {}

			for (let i = 1; i <= self.config.recordingBuffers; i++) {
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

			variableValues['currentRecordingMode'] = self.DATA.recordingMode
			variableValues['currentPlaybackMode'] = self.DATA.playbackMode
			variableValues['currentStopMode'] = self.DATA.stopMode

			variableValues['currentFramePosition'] = 0
			variableValues['currentPlaybackMarkerIn'] = 0
			variableValues['currentPlaybackMarkerOut'] = 0

			self.setVariableValues(variableValues)
		} catch (error) {
			self.log('error', 'Error setting Variables: ' + String(error))
			console.log(error)
		}
	},
}
