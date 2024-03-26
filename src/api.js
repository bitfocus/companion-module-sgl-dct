const { InstanceStatus } = require('@companion-module/base')

const WebSocket = require('ws')

module.exports = {
	initConnection: function () {
		let self = this

		if (self.WS) {
			self.closeConnection() //close any existing connections
		}

		if (self.config.host && self.config.host !== '' && self.config.port && self.config.port !== '') {
			self.WS = new WebSocket(`ws://${self.config.host}:${self.config.port}`)

			self.WS.on('error', (error) => {
				console.log(error)
			})

			self.WS.on('open', () => {
				console.log('connected')
				self.updateStatus(InstanceStatus.Ok)
				self.setBufferCount(self.config.buffers)
				self.changeMode('rec_mode', self.config.recordingMode)
				self.changeMode('play_mode', self.config.playbackMode)
				self.changeMode('stop_mode', self.config.stopMode)
				self.getData()
				self.getPollData() //call it once to get the data initially
				self.startInterval()
			})

			self.WS.on('message', (data) => {
				self.processData(data)
			})
		}
	},

	setBufferCount: function (count) {
		let self = this

		self.log('info', `Setting Buffer Count to ${count}`)

		self.sendCommand(`count ${count}`)

		self.CHOICES_BUFFERS = []
		for (let i = 1; i <= count; i++) {
			self.CHOICES_BUFFERS.push({ id: i, label: 'Buffer ' + i })
		}
	},

	getData: function () {
		let self = this

		self.sendCommand('version')
		self.sendCommand('rec_mode ?')
		self.sendCommand('play_mode ?')
		self.sendCommand('stop_mode ?')

		self.checkVariables()
	},

	getPollData: function () {
		let self = this

		self.sendCommand('status 0')
		self.sendCommand('pos ?')
		self.sendCommand('mark_pos ?')
	},

	processData: function (data) {
		let self = this

		if (self.config.verbose) {
			self.log('debug', `Received Data: ${data}`)
		}

		let lines = data.split('\n')
		//the first line is the command, the rest of the lines are the results of the command

		let command = lines[0]
		let results = []

		if (lines.length < 2) {
			results.push(lines[0]) //if there's only one line, it's also the results
		} else {
			results = lines
		}

		//check to see if the command is one of the following
		switch (true) {
			case command.includes('OK'):
				//normal response to command
				break
			case command.includes('version'):
				self.processVersion(results)
				break
			case command.includes('rec_mode'):
				self.processMode('rec_mode', results)
				break
			case command.includes('play_mode'):
				self.processMode('play_mode', results)
				break
			case command.includes('stop_mode'):
				self.processMode('stop_mode', results)
				break
			case command.includes('status'):
				self.processStatus(results)
				break
			case command.includes('pos'):
				self.processPosition(results)
				break
			case command.includes('mark_pos'):
				self.processMarkPos(results)
				break
			default:
				self.log('debug', `Unknown Response: ${command}`)
				break
		}
	},

	processVersion: function (versionArr) {
		let self = this

		let versionObj = {}

		for (let i = 0; i < versionArr.length; i++) {
			let match = versionArr[i].match(/(.*): (.*)/)

			if (match) {
				let key = match[1].replace('-', '').replace(' ', '')
				let value = match[2]

				versionObj[key] = value
			}
		}

		self.DATA.version = versionObj
	},

	processMode: function (modeType, line) {
		let self = this

		let parts = line.split(' ')

		let results = ''

		if (parts.length === 2) {
			results = parts[1]
		}

		switch (modeType) {
			case 'rec_mode':
				self.DATA.recordingMode = results
				break
			case 'play_mode':
				self.DATA.playbackMode = results
				break
			case 'stop_mode':
				self.DATA.stopMode = results
				break
		}
	},

	processStatus: function (statusArr) {
		let self = this

		for (let i = 0; i < statusArr.length; i++) {
			//match this regex to get the buffer number and status
			//[B](.):\s(....)\s\S\s(....)\s(....)
			//B<buffer_id>: <frames_recorded> / <frames_available> <status>
			let match = statusArr[i].match(/B(\d): (\d+) \/ (\d+) (\w+)/)

			if (match) {
				let buffer = parseInt(match[1])
				let recorded = parseInt(match[2])
				let available = parseInt(match[3])
				let status = match[4]

				switch (status) {
					case 'free':
						status = 'Free'
						break
					case 'used':
						status = 'Used'
						break
					case 'reco':
						status = 'Record'
						self.DATA.currentRecordingBuffer = buffer
						break
					case 'play':
						status = 'Play'
						self.DATA.currentPlaybackBuffer = buffer
						break
					case 'paus':
						status = 'Pause'
						self.DATA.currentPlaybackBuffer = buffer
						break
				}

				//if the buffer is a number
				if (!isNaN(buffer)) {
					//create an object to store the buffer data
					let bufferObj = {
						buffer: buffer,
						recorded: recorded,
						available: available,
						status: status,
					}

					//make sure the bufferObj is not already in the DATA array
					let found = false
					for (let j = 0; j < self.DATA.buffers.length; j++) {
						if (self.DATA.buffers[j].buffer === buffer) {
							found = true
							self.DATA.buffers[j] = bufferObj //update in place
							break
						}
					}

					if (!found) {
						//add it
						self.DATA.buffers.push(bufferObj)
					}

					self.checkVariables()
				} else {
					self.log('warn', `Invalid buffer status data received: ${statusArr[i]}`)
				}
			} else {
				self.log('warn', `Invalid buffer status data received: ${statusArr[i]}`)
			}
		}
	},

	processPosition: function (pos) {
		let self = this

		//it comes in as a string like this: pos 0
		//just get the second part
		let posArr = pos.split(' ')
		let position = 0

		if (posArr.length === 2) {
			position = parseInt(posArr[1])
		}

		self.DATA.position = position

		self.checkVariables()
	},

	processMarkPos: function (markPos) {
		let self = this

		//it comes in a string like this: mark_pos 0 0
		//the first number is the mark in, the second is the mark out
		let markArr = markPos.split(' ')
		let markIn = 0
		let markOut = 0

		if (markArr.length === 3) {
			markIn = parseInt(markArr[1])
			markOut = parseInt(markArr[2])
		}

		self.DATA.markIn = markIn
		self.DATA.markOut = markOut

		self.checkVariables()
	},

	play: function (buffer, speed, frame) {
		let self = this

		if (buffer === 0) {
			//determine the last recorded buffer to use
			buffer = self.DATA.lastRecordingBuffer
		}

		self.DATA.currentPlaybackBuffer = buffer
		self.sendCommand(`play ${buffer} ${speed} ${frame}`)
		self.checkVariables()
	},

	pause: function () {
		let self = this

		self.sendCommand('pause')
	},

	stop: function () {
		let self = this

		self.sendCommand('stop')
	},

	record: function (buffer = 0) {
		let self = this

		if (buffer === 0) {
			//if no buffer specified, first determine the first free buffer to record to
			for (let i = 0; i < self.DATA.buffers.length; i++) {
				if (self.DATA.buffers[i].status === 'Free') {
					buffer = self.DATA.buffers[i].buffer
					break
				}
			}
		}

		self.DATA.lastRecordingBuffer = self.DATA.currentRecordingBuffer //store the last recording buffer
		self.DATA.currentRecordingBuffer = buffer //set the current recording buffer
		self.sendCommand(`record ${buffer}`)
		self.checkVariables()
	},

	recordStop: function () {
		let self = this

		self.sendCommand('rec_stop')
	},

	markInFrame: function (pos) {
		let self = this

		self.sendCommand(`mark_in ${pos}`)
	},

	markOutFrame: function (pos) {
		let self = this

		self.sendCommand(`mark_out ${pos}`)
	},

	changeMode: function (name, mode) {
		let self = this

		self.sendCommand(`${name} ${mode}`)
	},

	seekToFrame: function (mode, pos) {
		let self = this

		self.sendCommand(`seek ${mode} ${pos} 1`)
	},

	freeBuffer: function (buffer) {
		let self = this

		self.sendCommand(`free ${buffer}`)
	},

	changeNetworkSettings: function (networkType, ip, subnet, gateway) {
		let self = this

		//if dhcp, only send dhcp command
		if (networkType === 'dhcp') {
			self.sendCommand('ipv4 0')
		} else {
			self.sendCommand(`ipv4 1 ${ip} ${subnet} ${gateway}`)
		}

		self.sendCommand('save_settings')

		//save the settings and then save to config and restart module
		self.config.host = ip
		self.saveConfig(self.config)

		//wait 10 seconds and restart the module
		self.log('info', 'Network Settings Changed. Restarting Module in 10 seconds.')

		setTimeout(() => {
			self.initConnection()
		}, 10000)
	},

	switchMode: function (mode) {
		let self = this

		self.sendCommand(`switch_mode ${mode}`)
	},

	reboot: function () {
		let self = this

		self.sendCommand('reboot')
	},

	shutdown: function () {
		let self = this

		self.sendCommand('shutdown')
	},

	sendCommand: function (command) {
		let self = this

		if (self.WS) {
			if (self.config.verbose) {
				self.log('debug', `Sending Command: ${command}`)
			}
			try {
				self.WS.send(command)
				self.lastCommand = command
			} catch (error) {
				self.log('error', 'Error sending command: ' + String(error))
			}
		} else {
			self.log('warn', 'Websocket not connected. Command not sent.')
		}
	},

	startInterval: function () {
		let self = this
		self.stopInterval()

		if (self.config.polling == true) {
			self.log('info', `Starting Polling Interval: Every ${self.config.rate}ms`)

			self.INTERVAL = setInterval(() => {
				self.getPollData()
			}, self.config.rate)
		}
	},

	stopInterval: function () {
		let self = this
		clearInterval(self.INTERVAL)
		self.INTERVAL = null
	},

	closeConnection: function () {
		let self = this

		//close out the websocket
		if (self.WS) {
			self.log('info', 'Closing Websocket Connection.')
			self.WS.close()
			self.WS = undefined
			delete self.WS
		}
	},
}
