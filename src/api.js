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

				if (self.config.setModes == true) {
					self.changeMode('rec_mode', self.config.recordingMode)
					self.changeMode('play_mode', self.config.playbackMode)
					self.changeMode('stop_mode', self.config.stopMode)
				}

				self.getData() //initial data request
				self.getPollData() //call it once to get the data initially
				self.startInterval()

				if (self.config.recordIntoEarliest == true) {
					//wait 1 second and then start recording into the earliest buffer
					setTimeout(() => {
						self.recordIntoEarliest() //start recording into the earliest buffer upon initial connection
					}, 1000).bind(self)
				}
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

		self.sendCommand('version')
		self.sendCommand('rec_mode ?')
		self.sendCommand('play_mode ?')
		self.sendCommand('stop_mode ?')

		self.sendCommand('video_mode ?')
		//self.sendCommand('fps_mode ?')

		//self.sendCommand('fps ?')

		self.checkVariables()
	},

	getPollData: function () {
		let self = this

		self.sendCommand('status 0') //get status of all buffers

		self.sendCommand('fps_mode ?')

		//check if any of the buffer statuses are Play, and if they are, request pos and mark_pos (we can't request them if nothing is playing)
		for (let i = 0; i < self.DATA.buffers.length; i++) {
			if (self.DATA.buffers[i].status === 'Play') {
				self.sendCommand(`pos`)
				self.sendCommand(`mark_pos`)
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

			self.lastResponse = data.toString().trim()

			if (data.toString().includes('platform')) {
				//this is a version response
				self.processVersion(data.toString())
				return
			}

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
				self.log('warn', `Error received: ${lines[0]}`)
				self.log('warn', `Command: ${self.lastCommand}`)
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
				case command.includes('FAIL'):
					//already processed fail
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
				case command.includes('pos') && !command.includes('mark_pos'):
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
				case command.includes('fps') && !command.includes('fps_mode'):
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

		versionArr = versionArr.split('\r\n').filter(Boolean)

		for (let i = 0; i < versionArr.length; i++) {
			let match = versionArr[i].match(/(.*): (.*)/)

			if (match) {
				let key = match[1].replace('-', '').replace(' ', '').trim().toLowerCase()
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
							//self.DATA.currentPlaybackBuffer = buffer
							break
						case 'paus':
						case 'pause':
							status = 'Pause'
							//self.DATA.currentPlaybackBuffer = buffer
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
								//update in place
								self.DATA.buffers[j].recorded = recorded
								self.DATA.buffers[j].available = available
								self.DATA.buffers[j].status = status
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

		let buffer = self.DATA.currentPlaybackBuffer

		//find the buffer in the array and store the pos
		for (let i = 0; i < self.DATA.buffers.length; i++) {
			if (self.DATA.buffers[i].buffer === buffer) {
				self.DATA.buffers[i].pos = position
				break
			}
		}

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

		let buffer = self.DATA.currentPlaybackBuffer

		//find the buffer in the array and store the pos
		for (let i = 0; i < self.DATA.buffers.length; i++) {
			if (self.DATA.buffers[i].buffer === buffer) {
				self.DATA.buffers[i].markIn = markIn
				self.DATA.buffers[i].markOut = markOut
				break
			}
		}

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
			//but if that is 0, then just choose the first buffer I guess
			if (self.DATA.lastRecordingBuffer === 0) {
				buffer = 1
			}
			else {
				buffer = self.DATA.lastRecordingBuffer
			}
		}

		//make sure nothing is undefined for any reason
		if (buffer === undefined) {
			buffer = 1
		}
		
		if (speed === undefined) {
			speed = 10
		}

		if (frame !== undefined) {
			self.sendCommand(`play ${buffer} ${speed} ${frame}`)
		} else {
			self.sendCommand(`play ${buffer} ${speed}`)
		}

		//set the current playback buffer
		self.DATA.currentPlaybackBuffer = buffer

		//find the buffer and set the current speed
		for (let i = 0; i < self.DATA.buffers.length; i++) {
			if (self.DATA.buffers[i].buffer === buffer) {
				self.DATA.buffers[i].speed = speed
				break
			}
		}

		//set the last speed
		self.DATA.lastSpeed = speed

		//set the currentlyPlaying bool to true to indicate that we are currently playing, so we can run pos and mark_pos commands
		self.currentlyPlaying = true

		self.checkVariables()
	},

	rampPlay: function (buffer, startSpeed, startFrame, rampSpeed, rampFrame, endSpeed, transitionTotalTime, transitionType, transitionStepTime, transitionTotalSteps) {
		let self = this

		//first check to see if we are currently ramping somewhere
		if (self.rampingMode) {
			self.log('warn', 'Ramping already in progress. Cannot start another ramp.')
			return
		}

		//now set ramping mode to false
		self.rampingMode = false
		clearInterval(self.RAMPINTERVAL)
		self.RAMPINTERVAL = undefined

		self.log('info', `Ramping Playback from Buffer ${buffer} at Frame: ${startFrame} Speed: ${startSpeed}, beginning Ramp at Frame: ${rampFrame} with Speed: ${rampSpeed} to end at Frame ${endFrame} Speed: ${endSpeed}.`)
		if (transitionType == 'time') {
			self.log('info', `Ramping over ${transitionTotalTime}ms.`)
		}
		else if (transitionType == 'steps') {
			self.log('info', `Ramping ${transitionTotalSteps} steps with a total time of ${transitionTotalTime}ms.`)
		}

		if (buffer === 0) {
			//determine the last recorded buffer to use
			buffer = self.DATA.lastRecordingBuffer
		}

		self.DATA.currentPlaybackBuffer = buffer
		self.DATA.lastSpeed = startSpeed
		self.sendCommand(`play ${buffer} ${startSpeed} ${startFrame}`)
		self.checkFeedbacks()
		self.checkVariables()

		self.rampingMode = true //set ramping mode to true to indicate in future attempts that we are ramping right now and should not do other ramps

		//now start an interval to check the current frame position, and when it reaches or passes the rampFrame, change the speed and make a note that we are in ramping mode
		let interval = setInterval(() => {
			if (self.DATA.pos >= rampFrame) {
				clearInterval(interval)
				if (transitionType == 'time') {
					self.startRampOverTime(buffer, rampSpeed, endSpeed, transitionTotalTime, transitionStepTime)
				}
				else if (transitionType == 'steps') {
					self.startRampOverSteps(buffer, rampSpeed, endSpeed, transitionTotalTime, transitionTotalSteps)
				}
			}
		}, 10) //check every 10ms
	},

	startRampOverTime: function (buffer, rampSpeed, rampFrame, endSpeed, endFrame, transitionTotalTime, transitionStepTime) {
		let self = this

		//perform a ramp with each step taking transitionStepTime over transitionTotalTime, starting at rampFrame and rampSpeed and ending at endFrame and endSpeed
		let totalSteps = transitionTotalTime / transitionStepTime
		let currentStep = 0
		let currentSpeed = rampSpeed
		let currentFrame = rampFrame
		let speedStep = (endSpeed - rampSpeed) / totalSteps
		let frameStep = (endFrame - rampFrame) / totalSteps

		self.RAMPINTERVAL = setInterval(() => {
			if (currentStep < totalSteps) {
				currentSpeed += speedStep
				self.sendCommand(`play ${buffer} ${currentSpeed}`)
				currentStep++
			}
			else {
				clearInterval(self.RAMPINTERVAL)
				self.sendCommand(`play ${buffer} ${endSpeed} ${endFrame}`)
				self.rampingMode = false
			}
		}, transitionStepTime)
	},

	startRampOverSteps: function (buffer, rampSpeed, rampFrame, endSpeed, endFrame, transitionTotalTime, transitionTotalSteps) {
		let self = this

		//perform a ramp with each step taking transitionStepTime over transitionTotalTime, starting at rampFrame and rampSpeed and ending at endFrame and endSpeed
		let totalSteps = transitionTotalSteps
		let currentStep = 0
		let currentSpeed = rampSpeed
		let currentFrame = rampFrame
		let speedStep = (endSpeed - rampSpeed) / totalSteps
		let frameStep = (endFrame - rampFrame) / totalSteps

		self.RAMPINTERVAL = setInterval(() => {
			if (currentStep < totalSteps) {
				currentSpeed += speedStep
				currentFrame += frameStep
				self.sendCommand(`play ${buffer} ${currentSpeed} ${currentFrame}`)
				currentStep++
			}
			else {
				clearInterval(self.RAMPINTERVAL)
				self.sendCommand(`play ${buffer} ${endSpeed} ${endFrame}`)
				self.rampingMode = false
			}
		}, transitionTotalTime / totalSteps)
	},

	stopRamp: function () {
		let self = this

		self.log('info', 'Stopping Ramp.')
		clearInterval(self.RAMPINTERVAL)
		self.rampingMode = false
	},

	pause: function () {
		let self = this

		self.sendCommand('pause')

		self.currentlyPlaying = false //dont think we can call pos or mark_pos when paused
	},

	stop: function () {
		let self = this

		self.sendCommand('stop')

		self.currentlyPlaying = false
	},

	record: function (buffer = 0, freeBuffer = false) {
		let self = this

		if (buffer === 0) {
			//if no buffer specified, first determine the first free buffer to record to
			let found = false
			for (let i = 0; i < self.DATA.buffers.length; i++) {
				if (self.DATA.buffers[i].status === 'Free') {
					self.log('info', `Recording to first free buffer: ${self.DATA.buffers[i].buffer}`)
					buffer = self.DATA.buffers[i].buffer
					found = true
					break
				}
			}

			if (!found) {
				self.log('warn', 'No free buffers available to record to.')
				return
			}
		}
		else {
			//make sure the requested buffer is free - if not, free it if the freeBuffer flag is set to true
			for (let i = 0; i < self.DATA.buffers.length; i++) {
				if (self.DATA.buffers[i].buffer === buffer) {
					if (self.DATA.buffers[i].status !== 'Free') {
						if (freeBuffer) {
							self.freeBuffer(buffer)						
						} else {
							self.log('warn', `Buffer ${buffer} is not free. Cannot record.`)
							return
						}
					}
				}
			}
		}

		//wait 20ms and then record
		setTimeout(() => {
			//first check that we are not recording on another buffer with a higher number
			if (self.currentlyRecording && self.DATA.currentRecordingBuffer > buffer) {
				self.log('warn', `Cannot record to Buffer ${buffer} when recording to Buffer ${self.DATA.currentRecordingBuffer} because the current recording buffer is a higher buffer than ${buffer}.`)
				return
			}

			self.DATA.lastRecordingBuffer = self.DATA.currentRecordingBuffer //store the last recording buffer for... reasons
			self.DATA.currentRecordingBuffer = buffer //set the current recording buffer
			self.currentlyRecording = true
			self.log('info', `Recording to Buffer ${buffer}`)
			self.sendCommand(`rec ${buffer}`)
			self.checkFeedbacks()
			self.checkVariables()
		}, 20)
	},

	recordIntoEarliest: function () {
		let self = this

		//first determine the first free buffer to record to
		let found = false
		for (let i = 0; i < self.DATA.buffers.length; i++) {
			if (self.DATA.buffers[i].status === 'Free') {
				self.log('info', `Initialization: Recording to first free buffer: ${self.DATA.buffers[i].buffer}`)
				self.record(self.DATA.buffers[i].buffer)
				found = true
				break
			}
		}

		if (!found) {
			self.log('warn', 'Initialization: No free buffers available to record to.')
		}
	},

	recordStop: function () {
		let self = this

		if (self.currentlyRecording == true) {
			self.sendCommand('rec_stop')
		}
		else {
			self.log('warn', 'Cannot stop recording when not recording.')
		}

		self.currentlyRecording = false //set to false after stopping
		self.DATA.lastRecordingBuffer = self.DATA.currentRecordingBuffer
		self.DATA.currentRecordingBuffer = 0 //set to 0 after stopping

		//find the buffer and set the pos and mark pos to 0
		for (let i = 0; i < self.DATA.buffers.length; i++) {
			if (self.DATA.buffers[i].buffer === self.DATA.lastRecordingBuffer) {
				self.DATA.buffers[i].pos = 0
				self.DATA.buffers[i].markIn = 0
				self.DATA.buffers[i].markOut = 0
				break
			}
		}

		//if we are not playing anywhere else, automatically play this last recorded buffer at speed 0, after, say, 20ms
		if (self.currentlyPlaying == false) {
			setTimeout(() => {
				self.play(self.DATA.lastRecordingBuffer, 0)
			}, 20)
		}

		self.checkFeedbacks()
		self.checkVariables()
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

	freeBuffer: function (buffer, startRecording = false) {
		let self = this

		self.log('info', `Freeing Buffer ${buffer}`)

		if (buffer !== 0) { //if we are not freeing all buffers
			//first check if we are currently recording to the buffer
			if (self.currentlyRecording == true && self.DATA.currentRecordingBuffer == buffer) {
				self.log('warn', `Cannot free Buffer ${buffer} when recording to it.`)
				return
			}
		}
		else {
			if (self.currentlyRecording == true) {
				self.log('warn', `Cannot free all buffers when recording to one of them.`)
				return
			}
		}

		self.sendCommand(`free ${buffer}`)

		//reset buffer pos data
		for (let i = 0; i < self.DATA.buffers.length; i++) {
			if (self.DATA.buffers[i].buffer === buffer || buffer == 0) {
				self.DATA.buffers[i].pos = 0
				self.DATA.buffers[i].speed = 0
				self.DATA.buffers[i].markIn = 0
				self.DATA.buffers[i].markOut = 0
			}
		}

		//if we are freeing all buffers, reset the current recording buffer and current playback buffer
		if (buffer == 0) {
			self.DATA.currentRecordingBuffer = 0
			self.DATA.currentPlaybackBuffer = 0
			self.DATA.currentlyRecording = false
			self.DATA.currentlyPlaying = false
		}

		self.checkVariables()

		//if startRecording is true, start recording into the buffer after say 20ms
		//if buffer was 0, then we cleared all buffers, so just record into buffer 1 after 20ms
		if (buffer == 0) {
			buffer = 1
		}

		if (startRecording == true && self.currentlyRecording == false) {
			setTimeout(() => {
				self.record(buffer)
			}, 50) //this delay is directly related to the internal polling rate, if the internal polling rate is too high, this may need to be increased
		}
	},

	videoMode: function (mode) {
		let self = this

		self.sendCommand(`video_mode ${mode}`)
	},

	frameRateMode: function (mode) {
		let self = this

		self.sendCommand(`fps_mode ${mode}`)
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
