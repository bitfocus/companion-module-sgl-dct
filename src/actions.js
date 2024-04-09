module.exports = {
	initActions: function () {
		let self = this

		let actions = {}

		actions.setBufferCount = {
			name: 'Set Buffer Count',
			options: [
				{
					type: 'dropdown',
					label: 'Buffer Count',
					id: 'bufferCount',
					choices: [
						{ id: 0, label: '0 (Disables Recording)' },
						{ id: 1, label: '1' },
						{ id: 2, label: '2' },
						{ id: 3, label: '3' },
						{ id: 4, label: '4' },
					],
					default: 1,
					required: true,
				},
			],
			callback: async function (action) {
				let bufferCount = parseInt(action.options.bufferCount)
				self.setBufferCount(bufferCount)
			},
		}

		if (self.config.recordingBuffers > 0) {
			actions.play = {
				name: 'Play',
				options: [
					{
						type: 'checkbox',
						label: 'Use Last Recorded Buffer',
						id: 'lastRecorded',
						default: true,
					},
					{
						type: 'checkbox',
						label: 'Use Current Playback Buffer',
						id: 'useCurrentPlaybackBuffer',
						default: false,
						isVisible: (options) => options.lastRecorded === false,
					},
					{
						type: 'checkbox',
						label: 'Choose Buffer by Variable Value',
						id: 'chooseBufferByVariable',
						default: false,
						isVisible: (options) =>
							options.lastRecorded === false && options.useCurrentPlaybackBuffer === false,
					},
					{
						type: 'textinput',
						label: 'Buffer Number (1-4)',
						id: 'bufferVar',
						default: '0',
						useVariables: true,
						isVisible: (options) => options.chooseBufferByVariable === true,
					},
					{
						type: 'dropdown',
						label: 'Buffer',
						id: 'buffer',
						choices: self.CHOICES_BUFFERS,
						default: self.CHOICES_BUFFERS[0].id,
						required: true,
						isVisible: (options) =>
							options.lastRecorded === false &&
							options.useCurrentPlaybackBuffer === false &&
							options.chooseBufferByVariable === false,
					},
					{
						type: 'static-text',
						label: '',
						id: 'hr1',
						value: '<hr />',
					},
					{
						type: 'checkbox',
						label: 'Use Custom Speed',
						id: 'useCustomSpeed',
						default: false,
					},
					{
						type: 'textinput',
						label: 'Speed (-1000 to 1000)',
						id: 'customSpeed',
						default: 10,
						useVariables: true,
						isVisible: (options) => options.useCustomSpeed === true,
					},
					{
						type: 'dropdown',
						label: 'Speed',
						id: 'speed',
						default: 10,
						choices: self.CHOICES_SPEEDS,
						isVisible: (options) => options.useCustomSpeed === false,
					},
					{
						type: 'static-text',
						label: '',
						id: 'hr2',
						value: '<hr />',
					},
					{
						type: 'checkbox',
						label: 'Specify Frame',
						id: 'specifyFrame',
						default: false,
					},
					{
						type: 'textinput',
						label: 'Frame',
						id: 'frame',
						default: 0,
						useVariables: true,
						isVisible: (options) => options.specifyFrame === true,
					},
				],
				callback: async function (action) {
					let buffer = parseInt(action.options.buffer)
					let speed = action.options.speed
					let frame = parseInt(await self.parseVariablesInString(action.options.frame))

					if (action.options.lastRecorded) {
						buffer = 0
					} else if (action.options.useCurrentPlaybackBuffer) {
						buffer = self.DATA.currentPlaybackBuffer
					} else if (action.options.chooseBufferByVariable) {
						buffer = parseInt(await self.parseVariablesInString(action.options.bufferVar))
					}

					if (action.options.useCustomSpeed) {
						speed = parseInt(await self.parseVariablesInString(action.options.customSpeed))
					}

					//make sure speed is between -1000 and 1000
					speed = Math.min(1000, Math.max(-1000, speed))

					if (!action.options.specifyFrame) {
						frame = undefined
					}

					self.play(buffer, speed, frame)
				},
			}

			actions.increasePlaySpeed = {
				name: 'Increase Play Speed',
				options: [
					{
						type: 'textinput',
						label: 'Speed Increase Factor',
						id: 'speedFactor',
						default: 10,
						useVariables: true,
					},
				],
				callback: async function (action) {
					let buffer = self.DATA.currentPlaybackBuffer
					let speedFactor = parseInt(await self.parseVariablesInString(action.options.speedFactor))

					//make sure speed factor is a positive value
					speedFactor = Math.abs(speedFactor)

					let newSpeed = self.DATA.lastSpeed + speedFactor

					//make sure speed is between -1000 and 1000
					newSpeed = Math.min(1000, Math.max(-1000, newSpeed))

					self.play(buffer, newSpeed)
				},
			}

			actions.decreasePlaySpeed = {
				name: 'Decrease Play Speed',
				options: [
					{
						type: 'textinput',
						label: 'Speed Decrease Factor',
						id: 'speedFactor',
						default: 10,
						useVariables: true,
					},
				],
				callback: async function (action) {
					let buffer = self.DATA.currentPlaybackBuffer
					let speedFactor = parseInt(await self.parseVariablesInString(action.options.speedFactor))

					//make sure speed factor is a positive value
					speedFactor = Math.abs(speedFactor)

					let newSpeed = self.DATA.lastSpeed - speedFactor

					//make sure speed is between -1000 and 1000
					newSpeed = Math.min(1000, Math.max(-1000, newSpeed))

					self.play(buffer, newSpeed)
				},
			}

			actions.rampPlay = {
				name: 'Ramp Play (DO NOT USE YET)',
				options: [
					{
						type: 'checkbox',
						label: 'Use Last Recorded Buffer',
						id: 'lastRecorded',
						default: true,
					},
					{
						type: 'checkbox',
						label: 'Use Current Playback Buffer',
						id: 'useCurrentPlaybackBuffer',
						default: false,
						isVisible: (options) => options.lastRecorded === false,
					},
					{
						type: 'dropdown',
						label: 'Choose Specific Buffer',
						id: 'buffer',
						choices: self.CHOICES_BUFFERS,
						default: self.CHOICES_BUFFERS[0].id,
						required: true,
						isVisible: (options) =>
							options.lastRecorded === false && options.useCurrentPlaybackBuffer === false,
					},
					{
						type: 'textinput',
						label: 'Start Speed',
						id: 'startSpeed',
						default: 10,
						useVariables: true,
					},
					{
						type: 'textinput',
						label: 'Start Frame',
						id: 'startFrame',
						default: 0,
						useVariables: true,
					},
					{
						type: 'textinput',
						label: 'Ramp Speed',
						id: 'rampSpeed',
						default: -10,
					},
					{
						type: 'textinput',
						label: 'Ramp Frame',
						id: 'rampFrame',
						default: 0,
						useVariables: true,
					},
					{
						type: 'textinput',
						label: 'End Speed',
						id: 'endSpeed',
						default: -1000,
						useVariables: true,
					},
					{
						type: 'textinput',
						label: 'Transition Time (in ms) from Ramp Speed to End Speed',
						id: 'transitionTotalTime',
						default: 1500,
						useVariables: true,
					},
					{
						type: 'dropdown',
						label: 'Specify Time Between Steps, or Specify Total Steps',
						id: 'transitionType',
						default: 'time',
						choices: [
							{ id: 'time', label: 'Time Between Steps (Let Companion Calculate Total Steps)' },
							{ id: 'steps', label: 'Total Steps (Let Companion Calculate Time Between Steps)' },
						],
					},
					{
						type: 'textinput',
						label: 'Time Between Steps (in ms)',
						id: 'transitionStepTime',
						default: 100,
						useVariables: true,
						isVisible: (options) => options.transitionType === 'time',
					},
					{
						type: 'textinput',
						label: 'Total Steps',
						id: 'transitionTotalSteps',
						default: 15,
						useVariables: true,
						isVisible: (options) => options.transitionType === 'steps',
					},
				],
				callback: async function (action) {
					let buffer = parseInt(action.options.buffer)

					let startSpeed = parseInt(await self.parseVariablesInString(action.options.startSpeed))
					let startFrame = parseInt(await self.parseVariablesInString(action.options.startFrame))

					let rampSpeed = parseInt(await self.parseVariablesInString(action.options.rampSpeed))
					let rampFrame = parseInt(await self.parseVariablesInString(action.options.rampFrame))

					let endSpeed = parseInt(await self.parseVariablesInString(action.options.endSpeed))

					let transitionTotalTime = parseInt(
						await self.parseVariablesInString(action.options.transitionTotalTime),
					)
					let transitionStepTime = parseInt(
						await self.parseVariablesInString(action.options.transitionStepTime),
					)
					let transitionTotalSteps = parseInt(
						await self.parseVariablesInString(action.options.transitionTotalSteps),
					)

					if (action.options.lastRecorded) {
						buffer = 0
					} else if (action.options.useCurrentPlaybackBuffer) {
						buffer = self.DATA.currentPlaybackBuffer
					}

					if (transitionType === 'time') {
						transitionTotalSteps = ParseInt(Math.ceil(transitionTotalTime / transitionStepTime))
					} else {
						transitionStepTime = ParseInt(Math.ceil(transitionTotalTime / transitionTotalSteps))
					}

					self.rampPlay(
						buffer,
						startSpeed,
						startFrame,
						rampSpeed,
						rampFrame,
						endSpeed,
						transitionTotalTime,
						transitionStepTime,
						transitionTotalSteps,
					)
				},
			}

			actions.pause = {
				name: 'Pause',
				options: [],
				callback: async function () {
					self.pause()
				},
			}

			actions.stop = {
				name: 'Stop',
				options: [],
				callback: async function () {
					self.stop()
				},
			}

			actions.record = {
				name: 'Record',
				options: [
					{
						type: 'checkbox',
						label: 'Use Next Available (Earliest Free) Buffer',
						id: 'nextAvailable',
						default: true,
					},
					{
						type: 'checkbox',
						label: 'Choose Buffer by Variable Value',
						id: 'chooseBufferByVariable',
						default: false,
						isVisible: (options) => options.nextAvailable === false,
					},
					{
						type: 'textinput',
						label: 'Buffer Number (1-4)',
						id: 'bufferVar',
						default: '0',
						useVariables: true,
						isVisible: (options) => options.chooseBufferByVariable === true,
					},
					{
						type: 'dropdown',
						label: 'Select Buffer',
						id: 'buffer',
						choices: self.CHOICES_BUFFERS,
						default: self.CHOICES_BUFFERS[0].id,
						required: true,
						isVisible: (options) =>
							options.nextAvailable === false && options.chooseBufferByVariable === false,
					},
					{
						type: 'checkbox',
						label: 'Free Buffer if Used (Record will fail if buffer is not free)',
						id: 'freeBuffer',
						default: false,
						isVisible: (options) => options.nextAvailable === false,
					},
				],
				callback: async function (action) {
					let buffer = parseInt(action.options.buffer)
					let nextAvailable = action.options.nextAvailable
					let freeBuffer = action.options.freeBuffer

					if (nextAvailable) {
						buffer = 0
					} else if (action.options.chooseBufferByVariable) {
						buffer = parseInt(await self.parseVariablesInString(action.options.bufferVar))
					}

					self.record(buffer, freeBuffer)
				},
			}

			actions.recordStop = {
				name: 'Record Stop',
				options: [],
				callback: async function () {
					self.recordStop()
				},
			}

			actions.markInFrame = {
				name: 'Mark In Frame',
				options: [
					{
						type: 'checkbox',
						label: 'Use Current Frame',
						id: 'currentFrame',
						default: true,
					},
					{
						type: 'textinput',
						label: 'Frame',
						id: 'frame',
						default: 0,
						useVariables: true,
						isVisible: (options) => options.currentFrame === false,
					},
				],
				callback: async function (action) {
					let pos = parseInt(self.parseVariablesInString(action.options.frame))

					if (action.options.currentFrame || isNaN(pos)) {
						pos = 0
					}

					self.markInFrame(pos)
				},
			}

			actions.markOutFrame = {
				name: 'Mark Out Frame',
				options: [
					{
						type: 'checkbox',
						label: 'Use Current Frame',
						id: 'currentFrame',
						default: true,
					},
					{
						type: 'textinput',
						label: 'Frame',
						id: 'frame',
						default: 0,
						useVariables: true,
						isVisible: (options) => options.currentFrame === false,
					},
				],
				callback: async function (action) {
					let pos = parseInt(self.parseVariablesInString(action.options.frame))

					if (action.options.currentFrame || isNaN(pos)) {
						pos = 0
					}

					self.markOutFrame(pos)
				},
			}

			actions.changeRecordingMode = {
				name: 'Change Recording Mode',
				options: [
					{
						type: 'dropdown',
						label: 'Mode',
						id: 'mode',
						choices: self.CHOICES_RECORDING_MODE,
						default: self.CHOICES_RECORDING_MODE[0].id,
						required: true,
					},
				],
				callback: async function (action) {
					let mode = action.options.mode
					self.changeMode('rec_mode', mode)
				},
			}

			actions.changePlaybackMode = {
				name: 'Change Playback Mode',
				options: [
					{
						type: 'dropdown',
						label: 'Mode',
						id: 'mode',
						choices: self.CHOICES_PLAYBACK_MODE,
						default: self.CHOICES_PLAYBACK_MODE[0].id,
						required: true,
					},
				],
				callback: async function (action) {
					let mode = action.options.mode
					self.changeMode('play_mode', mode)
				},
			}

			actions.changeStopMode = {
				name: 'Change Stop Mode',
				options: [
					{
						type: 'dropdown',
						label: 'Mode',
						id: 'mode',
						choices: self.CHOICES_STOP_MODE,
						default: self.CHOICES_STOP_MODE[0].id,
						required: true,
					},
				],
				callback: async function (action) {
					let mode = action.options.mode
					self.changeMode('stop_mode', mode)
				},
			}

			actions.seekToFrame = {
				name: 'Seek to Frame',
				options: [
					{
						type: 'dropdown',
						label: 'Mode',
						id: 'mode',
						choices: self.CHOICES_SEEK_MODE,
						default: self.CHOICES_SEEK_MODE[0].id,
						required: true,
					},
					{
						type: 'number',
						label: 'Position/Frames to Seek',
						id: 'position',
						default: 0,
						min: -300000,
						max: 300000,
						useVariables: true,
					},
				],
				callback: async function (action) {
					let mode = action.options.mode
					let position = parseInt(await self.parseVariablesInString(action.options.position))
					self.seekToFrame(mode, position)
				},
			}

			actions.freeBuffer = {
				name: 'Free Buffer(s)',
				options: [
					{
						type: 'checkbox',
						label: 'Free All Buffers',
						id: 'freeAll',
						default: false,
					},
					{
						type: 'checkbox',
						label: 'Choose Buffer by Variable Value',
						id: 'chooseBufferByVariable',
						default: false,
						isVisible: (options) => options.freeAll === false,
					},
					{
						type: 'textinput',
						label: 'Buffer Number (1-4)',
						id: 'bufferVar',
						default: '0',
						useVariables: true,
						isVisible: (options) => options.freeAll == false && options.chooseBufferByVariable === true,
					},
					{
						type: 'dropdown',
						label: 'Buffer',
						id: 'buffer',
						choices: self.CHOICES_BUFFERS,
						default: self.CHOICES_BUFFERS[0].id,
						required: true,
						isVisible: (options) => options.freeAll === false && options.chooseBufferByVariable === false,
					},
				],
				callback: async function (action) {
					let buffer = 0

					if (action.options.freeAll) {
						buffer = 0
					} else if (action.options.chooseBufferByVariable) {
						buffer = parseInt(await self.parseVariablesInString(action.options.bufferVar))
					} else {
						buffer = parseInt(action.options.buffer)
					}

					self.freeBuffer(buffer)
				},
			}
		}

		actions.setVideoMode = {
			name: 'Set Video Mode',
			options: [
				{
					type: 'dropdown',
					label: 'Video Mode',
					id: 'mode',
					choices: self.CHOICES_VIDEO_MODES,
					default: self.CHOICES_VIDEO_MODES[0].id,
				},
			],
			callback: async function (action) {
				let mode = action.options.mode
				self.setVideoMode(mode)
			},
		}

		/*actions.phases = {
			name: 'Set Active Phases and Frame Rate',
			options: [
				{
					type: 'checkbox',
					label: 'Choose Active Phase(s) Number by Variable',
					id: 'choosePhasesByVariable',
					default: false,
				},
				{
					type: 'textinput',
					label: 'Active Phases (SDI outputs)',
					id: 'phasesVar',
					default: '1',
					useVariables: true,
					isVisible: (options) => options.choosePhasesByVariable === true,
				},
				{
					type: 'dropdown',
					label: 'Active Phases (SDI outputs)',
					id: 'phases',
					choices: [
						{ id: 1, label: '1' },
						{ id: 2, label: '2' },
						{ id: 3, label: '3' },
						{ id: 4, label: '4' },
					],
					default: 1,
					isVisible: (options) => options.choosePhasesByVariable === false,
				},
			],
			callback: async function (action) {
				let phases = 1

				if (action.options.choosePhasesByVariable) {
					phases = parseInt(await self.parseVariablesInString(action.options.phasesVar))
				} else {
					phases = parseInt(action.options.phases)
				}

				self.phases(phases)
			},
		}*/

		actions.setFrameRate = {
			name: 'Set Frame Rate (FPS)',
			options: [
				{
					type: 'checkbox',
					label: 'Choose Frame Rate by Variable',
					id: 'chooseFPSByVariable',
					default: false,
				},
				{
					type: 'textinput',
					label: 'Frame Rate (FPS)',
					id: 'frameRateVar',
					default: '1',
					useVariables: true,
					isVisible: (options) => options.chooseFPSByVariable === true,
				},
				{
					type: 'dropdown',
					label: 'Frame Rate',
					id: 'frameRate',
					choices: self.CHOICES_FRAME_RATES,
					default: self.CHOICES_FRAME_RATES[0].id,
					isVisible: (options) => options.chooseFPSByVariable === false,
				},
			],
			callback: async function (action) {
				let frameRate = 0

				if (action.options.choosePhasesByVariable) {
					frameRate = parseInt(await self.parseVariablesInString(action.options.frameRateVar))
				} else {
					frameRate = parseInt(action.options.frameRate)
				}

				self.frameRate(frameRate)
			},
		}

		actions.changeNetworkSettings = {
			name: 'Change Networking Settings',
			options: [
				{
					type: 'dropdown',
					label: 'Network Type',
					id: 'networkType',
					default: 'dhcp',
					choices: [
						{ id: 'dhcp', label: 'DHCP' },
						{ id: 'static', label: 'Static' },
					],
				},
				{
					type: 'textinput',
					label: 'IP Address',
					id: 'ip',
					default: '192.168.1.240',
					isVisible: (options) => options.networkType === 'static',
					useVariables: true,
				},
				{
					type: 'textinput',
					label: 'Subnet Mask',
					id: 'subnet',
					default: '24',
					isVisible: (options) => options.networkType === 'static',
					useVariables: true,
				},
				{
					type: 'textinput',
					label: 'Gateway',
					id: 'gateway',
					default: '0.0.0.0',
					isVisible: (options) => options.networkType === 'static',
					useVariables: true,
				},
			],
			callback: async function (action) {
				let opt = action.options

				let networkType = opt.networkType
				let ip = await self.parseVariablesInString(opt.ip)
				let subnet = await self.parseVariablesInString(opt.subnet)
				let gateway = await self.parseVariablesInString(opt.gateway)

				self.changeNetworkSettings(networkType, ip, subnet, gateway)
			},
		}

		actions.switchMode = {
			name: 'Switch Device Mode',
			options: [
				{
					type: 'dropdown',
					label: 'Mode',
					id: 'mode',
					default: '1',
					choices: [
						{ id: '1', label: 'SSM Mode' },
						{ id: '0', label: 'Trigger Mode' },
					],
					required: true,
				},
			],
			callback: async function (action) {
				let mode = action.options.mode
				self.switchMode(mode)
			},
		}

		actions.reboot = {
			name: 'Reboot Device',
			options: [],
			callback: async function () {
				self.reboot()
			},
		}

		actions.shutdown = {
			name: 'Shutdown Device',
			options: [],
			callback: async function () {
				self.shutdown()
			},
		}

		actions.customCommand = {
			name: 'Run Custom Command',
			options: [
				{
					type: 'textinput',
					label: 'Command',
					id: 'command',
					default: '',
					useVariables: true,
				},
			],
			callback: async function (action) {
				let command = await self.parseVariablesInString(action.options.command)

				if (command !== '') {
					self.sendCommand(command)
				}
			},
		}

		self.setActionDefinitions(actions)
	},
}
