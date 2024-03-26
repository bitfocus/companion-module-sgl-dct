const { combineRgb } = require('@companion-module/base')

module.exports = {
	initFeedbacks() {
		let self = this
		const feedbacks = {}

		const foregroundColor = combineRgb(255, 255, 255) // White
		const backgroundColorRed = combineRgb(255, 0, 0) // Red

		feedbacks.bufferStatus = {
			type: 'boolean',
			name: 'Buffer Status',
			description: 'If the buffer status matches the specified status, the button will change color.',
			style: {
				color: foregroundColor,
				bgcolor: backgroundColorRed,
			},
			options: [
				{
					type: 'dropdown',
					label: 'Buffer',
					id: 'buffer',
					default: '1',
					choices: self.CHOICES_BUFFERS,
				},
				{
					type: 'dropdown',
					label: 'Status',
					id: 'status',
					default: self.CHOICES_BUFFER_STATUS[0].id,
					choices: self.CHOICES_BUFFER_STATUS,
				},
			],
			callback: async function (feedback) {
				let opt = feedback.options
				let buffer = parseInt(opt.buffer)
				let status = opt.status

				//find the buffer in self.DATA.buffers
				let bufferData = self.DATA.buffers.find((bufferData) => bufferData.buffer == buffer)

				if (bufferData) {
					if (bufferData.status == status) {
						return true
					}
				}

				return false
			},
		}

		feedbacks.recordingMode = {
			type: 'boolean',
			name: 'Recording Mode',
			description: 'If the record mode matches the specified mode, the button will change color.',
			style: {
				color: foregroundColor,
				bgcolor: backgroundColorRed,
			},
			options: [
				{
					type: 'dropdown',
					label: 'Mode',
					id: 'mode',
					default: self.CHOICES_RECORDING_MODE[0].id,
					choices: self.CHOICES_RECORDING_MODE,
				},
			],
			callback: async function (feedback) {
				let opt = feedback.options

				if (parseInt(self.DATA.recordingMode) == parseInt(opt.mode)) {
					return true
				}

				return false
			},
		}

		feedbacks.playbackMode = {
			type: 'boolean',
			name: 'Playback Mode',
			description: 'If the playback mode matches the specified mode, the button will change color.',
			style: {
				color: foregroundColor,
				bgcolor: backgroundColorRed,
			},
			options: [
				{
					type: 'dropdown',
					label: 'Mode',
					id: 'mode',
					default: self.CHOICES_PLAYBACK_MODE[0].id,
					choices: self.CHOICES_PLAYBACK_MODE,
				},
			],
			callback: async function (feedback) {
				let opt = feedback.options

				if (parseInt(self.DATA.playbackMode) == parseInt(opt.mode)) {
					return true
				}

				return false
			},
		}

		feedbacks.stopMode = {
			type: 'boolean',
			name: 'Stop Mode',
			description: 'If the stop mode matches the specified mode, the button will change color.',
			style: {
				color: foregroundColor,
				bgcolor: backgroundColorRed,
			},
			options: [
				{
					type: 'dropdown',
					label: 'Mode',
					id: 'mode',
					default: self.CHOICES_STOP_MODE[0].id,
					choices: self.CHOICES_STOP_MODE,
				},
			],
			callback: async function (feedback) {
				let opt = feedback.options

				if (parseInt(self.DATA.stopMode) == parseInt(opt.mode)) {
					return true
				}

				return false
			},
		}

		self.setFeedbackDefinitions(feedbacks)
	},
}
