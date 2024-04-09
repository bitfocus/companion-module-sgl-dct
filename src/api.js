const { InstanceStatus } = require('@companion-module/base')

const WebSocket = require('ws')

module.exports = {
	initConnection: function () {
		let self = this

		if (self.WS) {
			self.stopInterval() //stop any existing intervals
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
				self.changeMode('rec_mode', self.config.recordingMode)
				self.changeMode('play_mode', self.config.playbackMode)
				self.changeMode('stop_mode', self.config.stopMode)
				self.getData()
				self.getPollData() //call it once to get the data initially
				self.startInterval()
			})

			self.WS.on('message', (data) => {
				self.processData.bind(self)(data)
			})
		}
	},

	setBufferCount: function (count) {
		let self = this

		self.log('info', `Setting Buffer Count to ${count}`)

		if (count == 0) {
			self.log('warn', 'Buffer Count set to 0: All buffer related actions will be disabled.')
		}
		else {
			self.log('info', `Setting Buffer Count to ${count}`)
			self.sendCommand(`count ${count}`)
		}		

		self.config.recordingBuffers = count
		self.saveConfig(self.config)

		self.loadBufferCount()
	},

	loadBufferCount: function () {
		let self = this

		let count = self.config.recordingBuffers

		if (count == undefined) {
			count = 4 //set to max
			self.config.recordingBuffers = count
		}

		self.CHOICES_BUFFERS = []
		for (let i = 1; i <= count; i++) {
			self.CHOICES_BUFFERS.push({ id: i, label: 'Buffer ' + i })
		}

		self.initActions() //reload actions due to buffer size change
		self.initVariables() //reload variables due to buffer size change
		self.checkVariables() //check variables due to buffer size change
	},

	getData: function () {
		let self = this

		//self.sendCommand('version')
		self.sendCommand('rec_mode ?')
		self.sendCommand('play_mode ?')
		self.sendCommand('stop_mode ?')

		self.sendCommand('video_mode ?')
		self.sendCommand('fps_mode ?')

		self.sendCommand('fps ?')

		self.checkVariables()
	},

	getPollData: function () {
		let self = this

		self.sendCommand('status 0') //get status of all buffers

		//check if any of the buffer statuses are Play, and if they are, request pos and mark_pos (we can't request them if nothing is playing)
		for (let i = 0; i < self.DATA.buffers.length; i++) {
			if (self.DATA.buffers[i].status === 'Play') {
				self.sendCommand(`pos`)
				self.sendCommand(`mark_pos ?`)
				break
			}
		}
	},

	processData: function (data) {
		let self = this

		try {
			if (self.config.verbose) {
				self.log('debug', `Received Data: ${data}`)
			}

			self.lastResponse = data.toString()

			let lines = data.toString().split('\r\n').filter(Boolean)
			//the first line is the command, the rest of the lines are the results of the command

			let command = lines[0]
			let results = []

			if (command == '') {
				//get the next index instead
				command = lines[1]
			}

			if (lines.length < 2) {
				results.push(lines[0]) //if there's only one line, it's also the results
			} else {
				results = lines
			}

			//console.log('lines', lines)
			//console.log('command', command)
			//console.log('results', results)

			if (lines[0].includes('OK')) {
				//command ran ok
			} else if (lines[0].includes('FAIL')) {
				//error
				self.log('error', `Error received: ${lines[0]}`)
				self.log('error', `Command: ${self.lastCommand}`)
			}

			//if the command is undefined, set it to an empty string
			if (command == undefined) {
				command = '' //prevents errors from using 'includes' on undefined
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
					self.processMode('rec_mode', results[0])
					break
				case command.includes('play_mode'):
					self.processMode('play_mode', results[0])
					break
				case command.includes('stop_mode'):
					self.processMode('stop_mode', results[0])
					break
				case command.includes('status'):
				case command.includes('B1: '): //this is a status update
					self.processStatus(results)
					break
				case command.includes('pos'):
					self.processPosition(results[0])
					break
				case command.includes('mark_pos'):
					self.processMarkPos(results[0])
					break
				case command.includes('video_mode'):
					self.processVideoMode(results[0])
					break
				case command.includes('fps_mode'):
					self.processFPSMode(results[0])
					break
				//case command.includes('phases'):
				//	self.processPhases(results)
				//	break
				case command.includes('fps'):
					self.processFPS(results[0])
					break
				default:
					self.log('debug', `Unknown Response: ${command}`)
					break
			}
		} catch (error) {
			self.log('error', `Error processing data: ${error}`)
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
			results = parts[1].toString()
		}

		switch (modeType) {
			case 'rec_mode':
				//make sure the results are one of the valid options in the CHOICES_RECORDING_MODE array
				let validRecMode = false
				for (let i = 0; i < self.CHOICES_RECORDING_MODE.length; i++) {
					if (self.CHOICES_RECORDING_MODE[i].id === results) {
						validRecMode = true
						break
					}
				}

				if (!validRecMode) {
					results = self.CHOICES_RECORDING_MODE[0].id //set to the first option
				}

				self.DATA.recordingMode = results
				break
			case 'play_mode':
				//make sure the results are one of the valid options in the CHOICES_PLAYBACK_MODE array
				let validPlayMode = false

				for (let i = 0; i < self.CHOICES_PLAYBACK_MODE.length; i++) {
					if (self.CHOICES_PLAYBACK_MODE[i].id === results) {
						validPlayMode = true
						break
					}
				}

				if (!validPlayMode) {
					results = self.CHOICES_PLAYBACK_MODE[0].id //set to the first option
				}

				self.DATA.playbackMode = results
				break
			case 'stop_mode':
				//make sure the results are one of the valid options in the CHOICES_STOP_MODE array
				let validStopMode = false
				for (let i = 0; i < self.CHOICES_STOP_MODE.length; i++) {
					if (self.CHOICES_STOP_MODE[i].id === results) {
						validStopMode = true
						break
					}
				}

				if (!validStopMode) {
					results = self.CHOICES_STOP_MODE[0].id //set to the first option
				}

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
			//example: B1: 0 / 0 free

			if (!statusArr[i].includes('OK')) {
				let match = statusArr[i].match(/B(\d): (\d+) \/ (\d+) (\w+)/)

				if (match) {
					let buffer = parseInt(match[1])
					let recorded = parseInt(match[2])
					let available = parseInt(match[3])
					let status = match[4]

					switch (status.toLowerCase()) {
						case 'free':
							status = 'Free'
							break
						case 'used':
							status = 'Used'
							break
						case 'reco':
						case 'record':
							status = 'Record'
							self.DATA.currentRecordingBuffer = buffer
							break
						case 'play':
							status = 'Play'
							self.DATA.currentPlaybackBuffer = buffer
							break
						case 'paus':
						case 'pause':
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

						//console.log(self.DATA.buffers)

						self.checkFeedbacks()
						self.checkVariables()
					} else {
						self.log('warn', `Invalid buffer status data received here: ${statusArr[i]}`)
					}
				} else {
					self.log('warn', `Invalid buffer status data received: ${statusArr[i]}`)
				}
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

	processVideoMode: function (videoMode) {
		let self = this

		//it comes in a string like this: video_mode 4
		//just get the second part
		let videoModeArr = videoMode.split(' ')
		let mode = 0

		if (videoModeArr.length === 2) {
			mode = parseInt(videoModeArr[1])
		}

		self.DATA.videoMode = mode

		self.checkVariables()
	},

	/*processPhases: function (phases) {
		let self = this

		//it comes in a string like this: phases 1
		//just get the second part
		let phasesArr = phases.split(' ')
		let phaseValue = 0

		if (phasesArr.length === 2) {
			phaseValue = parseInt(phasesArr[1])
		}

		self.DATA.activePhases = phaseValue

		self.checkVariables()
	},*/

	processFPSMode: function (fpsMode) {
		let self = this

		//it comes in a string like this: fps_mode 1
		//just get the second part
		let fpsModeArr = fpsMode.split(' ')
		let mode = 0

		if (fpsModeArr.length === 2) {
			mode = parseInt(fpsModeArr[1])
		}

		self.DATA.frameRateMode = mode

		self.checkVariables()
	},

	processFPS: function (fps) {
		let self = this

		//it comes in a string like this: fps 30
		//just get the second part
		let fpsArr = fps.split(' ')
		let sensorFpsValue = 0
		let displayFpsValue = 0

		if (fpsArr.length === 3) {
			sensorFpsValue = parseInt(fpsArr[1])
			displayFpsValue = parseInt(fpsArr[2])
		}

		self.DATA.sensorFps = sensorFpsValue
		self.DATA.displayFps = displayFpsValue

		self.checkVariables()
	},

	play: function (buffer, speed, frame = undefined) {
		let self = this

		if (buffer === 0) {
			//determine the last recorded buffer to use
			buffer = self.DATA.lastRecordingBuffer
		}

		self.DATA.currentPlaybackBuffer = buffer
		self.DATA.lastSpeed = speed
		if (frame !== undefined) {
			self.sendCommand(`play ${buffer} ${speed} ${frame}`)
		} else {
			self.sendCommand(`play ${buffer} ${speed}`)
		}

		//set the current playback buffer
		self.DATA.currentPlaybackBuffer = buffer

		//set the last speed
		self.DATA.lastSpeed = speed

		//set the currentlyPlaying bool to true to indicate that we are currently playing, so we can run pos and mark_pos commands
		self.currentlyPlaying = true

		self.checkVariables()
	},

	rampPlay: function (buffer, startSpeed, startFrame, rampSpeed, rampFrame, endSpeed, transitionTotalTime, transitionStepTime, transitionTotalSteps) {
		let self = this

		if (buffer === 0) {
			//determine the last recorded buffer to use
			buffer = self.DATA.lastRecordingBuffer
		}

		self.DATA.currentPlaybackBuffer = buffer
		self.DATA.lastSpeed = startSpeed
		self.sendCommand(`play ${buffer} ${startSpeed} ${startFrame}`)
		self.checkFeedbacks()
		self.checkVariables()

		//first check to see if we are currently ramping somewhere
		if (self.rampingMode) {
			self.log('warn', 'Ramping already in progress. Cannot start another ramp.')
			return
		}

		//now set ramping mode to false
		self.rampingMode = false

		//now start an interval to check the current frame position, and when it reaches or passes the rampFrame, change the speed and make a note that we are in ramping mode
		let interval = setInterval(() => {
			if (self.DATA.pos >= rampFrame) {
				self.rampingMode = true //set ramping mode to true to indicate in future attempts that we are ramping right now and should not do other ramps
				self.sendCommand(`speed ${buffer} ${rampSpeed}`)
				self.DATA.lastSpeed = rampSpeed
				clearInterval(interval)
				self.startRamping(buffer, rampSpeed, endSpeed, transitionTotalTime)
			}
		}, 50) //check every 50ms
	},

	startRamping: function (buffer, rampSpeed, endSpeed, transitionTime) {
		let self = this

		let speed = 0

		//determine if we're going up or down
		if (rampSpeed < endSpeed) {
			speedDir = 'up'
		} else {
			speedDir = 'down'
		}

		//calculate the total number of steps that can occur over the transition time by first subtracting the larger number from the smaller

		//for example, ramp speed is 50 and end speed is -50, the difference is 100
		let difference = Math.abs(rampSpeed - endSpeed)

		//now divide the difference by the transition time to get the step size
		let stepSize = difference / transitionTime

		//start the interval
		let interval = setInterval(() => {
			if (speed < endSpeed) {
				speed += stepSize
				self.sendCommand(`speed ${buffer} ${speed}`)
				self.DATA.lastSpeed = speed
			} else {
				clearInterval(interval)
			}
		}, 50) //check every 50ms
	},

	pause: function () {
		let self = this

		self.sendCommand('pause')
	},

	stop: function () {
		let self = this

		self.sendCommand('stop')

		self.currentlyPlaying = false
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
		self.currentlyRecording = true
		self.sendCommand(`rec ${buffer}`)
		self.checkVariables()
	},

	recordStop: function () {
		let self = this

		if (self.currentlyRecording == true) {
			self.sendCommand('rec_stop')
			self.currentlyRecording = false
		}
		else {
			self.log('warn', 'Cannot stop recording when not recording.')
		}
	},

	markInFrame: function (pos) {
		let self = this

		if (self.currentlyPlaying == true) {
			self.sendCommand(`mark_in ${pos}`)	
		}
		else {
			self.log('warn', 'Cannot mark in frame when not playing.')
		}
	},

	markOutFrame: function (pos) {
		let self = this

		if (self.currentlyPlaying == true) {
			self.sendCommand(`mark_out ${pos}`)
		}
		else {
			self.log('warn', 'Cannot mark out frame when not playing.')
		}
	},

	changeMode: function (name, mode) {
		let self = this

		self.sendCommand(`${name} ${mode}`)
	},

	seekToFrame: function (mode, pos) {
		let self = this

		if (self.currentlyPlaying == true) {
			self.sendCommand(`seek ${mode} ${pos} 0`)
		}
		else {
			self.log('warn', 'Cannot seek to frame when not playing.')
		}
	},

	freeBuffer: function (buffer) {
		let self = this

		self.sendCommand(`free ${buffer}`)
	},

	videoMode: function (mode) {
		let self = this

		self.sendCommand(`video_mode ${mode}`)
	},

	phases: function (phases) {
		let self = this

		self.sendCommand(`phases ${phases}`)
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
				self.WS.send(command + '\n')
				self.lastCommand = command
				self.checkVariables()
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
