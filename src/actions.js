module.exports = {
	initActions: function () {
		let self = this

		let actions = {}

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
					type: 'dropdown',
					label: 'Buffer',
					id: 'buffer',
					choices: self.CHOICES_BUFFERS,
					default: self.CHOICES_BUFFERS[0].id,
					required: true,
					isVisible: (options) => options.lastRecorded === false,
				},
				{
					type: 'dropdown',
					label: 'Speed',
					id: 'speed',
					default: 0,
					choices: self.CHOICES_SPEEDS,
				},
				{
					type: 'number',
					label: 'Frame',
					id: 'frame',
					default: 0,
					min: 0,
				},
			],
			callback: async function (action) {
				let buffer = parseInt(action.options.buffer)
				let speed = action.options.speed
				let frame = parseInt(action.options.frame)

				if (action.options.lastRecorded) {
					buffer = 0
				}

				self.play(buffer, speed, frame)
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
					type: 'dropdown',
					label: 'Select Buffer',
					id: 'buffer',
					choices: self.CHOICES_BUFFERS,
					default: self.CHOICES_BUFFERS[0].id,
					required: true,
					isVisible: (options) => options.nextAvailable === false,
				},
			],
			callback: async function (action) {
				let buffer = parseInt(action.options.buffer)
				let nextAvailable = parseInt(action.options.nextAvailable)

				if (nextAvailable) {
					buffer = 0
				}

				self.record(buffer)
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
			name: 'Free Buffer',
			options: [
				{
					type: 'checkbox',
					label: 'Free All Buffers',
					id: 'freeAll',
					default: false,
				},
				{
					type: 'dropdown',
					label: 'Buffer',
					id: 'buffer',
					choices: self.CHOICES_BUFFERS,
					default: self.CHOICES_BUFFERS[0].id,
					required: true,
					isVisible: (options) => options.freeAll === false,
				},
			],
			callback: async function (action) {
				let buffer = parseInt(action.options.buffer)

				if (action.options.freeAll) {
					buffer = 0
				}

				self.freeBuffer(buffer)
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
