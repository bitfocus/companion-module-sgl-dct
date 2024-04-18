const { InstanceStatus } = require('@companion-module/base')

const WebSocket = require('ws')

module.exports = {
	initConnection: function () {
		let self = this

		//clear the reconnect interval
		clearTimeout(self.RECONNECT_INTERVAL)

		if (self.WS) {
			self.stopInterval() //stop any existing intervals
			self.closeConnection() //close any existing connections
		}

		if (self.config.host && self.config.host !== '' && self.config.port && self.config.port !== '') {
			self.WS = new WebSocket(`ws://${self.config.host}:${self.config.port}`)

			self.WS.on('error', (error) => {
				console.log(error)

				//stop polling
				self.stopInterval()

				//try to reconnect after 10 seconds
				self.log('warn', 'Connection Error. Attempting to reconnect in 10 seconds.')
				self.RECONNECT_INTERVAL = setTimeout(() => {
					self.initConnection()
				}, 10000)
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
		} else {
			self.log('info', `Setting Buffer Count to ${count}`)
			self.queueCommand(`count ${count}`)
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

		//reset the buffers array
		self.DATA.buffers = []

		//create the buffers array
		for (let i = 1; i <= 4; i++) {
			self.DATA.buffers.push({
				buffer: i,
				recorded: 0,
				available: 0,
				status: 'Free',
				pos: 0,
				speed: 0,
				markIn: 0,
				markOut: 0,
			})
		}

		//check the size of the buffers array and if it's more than the new count, set the additional ones to have a buffer status of offline
		if (self.DATA.buffers.length > count) {
			for (let i = count; i < self.DATA.buffers.length; i++) {
				self.DATA.buffers[i].status = 'offline'
			}
		}

		self.CHOICES_BUFFERS = []
		for (let i = 1; i <= count; i++) {
			self.CHOICES_BUFFERS.push({ id: i, label: 'Buffer ' + i })
		}

		//now add the remaining buffers to the choices list but add (offline) to the end
		for (let i = count + 1; i <= 4; i++) {
			self.CHOICES_BUFFERS.push({ id: i, label: 'Buffer ' + i + ' (offline)' })
		}

		//reset currentlyRecording and currentlyPlaying variables
		self.DATA.currentlyRecording = false
		self.DATA.currentlyPlaying = false
		self.DATA.lastRecordingBuffer = 0
		self.DATA.currentRecordingBuffer = 0
		self.DATA.currentPlaybackBuffer = 0

		self.initActions() //reload actions due to buffer size change
		self.initFeedbacks() //reload feedbacks due to buffer size change
		self.initVariables() //reload variables due to buffer size change

		self.checkFeedbacks() //check feedbacks due to buffer size change
		self.checkVariables() //check variables due to buffer size change

		self.record(0, false) //record into the first free buffer
	},

	getData: function () {
		let self = this

		self.sendCommand('version')
		self.queueCommand('rec_mode ?')
		self.queueCommand('play_mode ?')
		self.queueCommand('stop_mode ?')

		self.queueCommand('video_mode ?')
		self.queueCommand('fps_mode ?')

		//self.queueCommand('fps ?')

		self.checkVariables()
	},

	getPollData: function () {
		let self = this

		self.queueCommand('status 0') //get status of all buffers

		//self.queueCommand('fps_mode ?')

		//check if any of the buffer statuses are Play, and if they are, request pos and mark_pos (we can't request them if nothing is playing)
		for (let i = 0; i < self.DATA.buffers.length; i++) {
			if (self.DATA.buffers[i].status.toLowerCase() === 'play') {
				self.queueCommand(`pos`)
				self.queueCommand(`mark_pos`)
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

			//now that we got a response, process the next command in the queue
			self.checkQueue()

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

		self.lastStatus = statusArr
		
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
			} else {
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

		//make sure the specified buffer is not recording and is marked used
		let bufferObj = self.DATA.buffers.find((bufferObj) => bufferObj.buffer === buffer)

		if (bufferObj) {
			if (bufferObj.status.toLowerCase() === 'record') {
				self.log('warn', `Buffer ${buffer} is currently recording. Cannot play.`)
				return
			}

			if (bufferObj.status.toLowerCase() === 'free') {
				self.log('warn', `Buffer ${buffer} is free. Cannot play an empty buffer.`)
				return
			}
		}

		if (frame !== undefined) {
			self.queueCommand(`play ${buffer} ${speed} ${frame}`)
		} else { //if no frame specified, just play from the beginning
			self.queueCommand(`play ${buffer} ${speed}`)
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
		self.DATA.currentlyPlaying = true

		self.checkVariables()
	},

	rampPlay: function (
		buffer,
		startSpeed,
		startFrame,
		rampSpeed,
		rampFrame,
		endSpeed,
		transitionTotalTime,
		transitionType,
		transitionStepTime,
		transitionTotalSteps,
	) {
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

		self.log(
			'info',
			`Ramping Playback from Buffer ${buffer} at Frame: ${startFrame} Speed: ${startSpeed}, beginning Ramp at Frame: ${rampFrame} with Speed: ${rampSpeed} to end at Frame ${endFrame} Speed: ${endSpeed}.`,
		)
		if (transitionType == 'time') {
			self.log('info', `Ramping over ${transitionTotalTime}ms.`)
		} else if (transitionType == 'steps') {
			self.log('info', `Ramping ${transitionTotalSteps} steps with a total time of ${transitionTotalTime}ms.`)
		}

		if (buffer === 0) {
			//determine the last recorded buffer to use
			buffer = self.DATA.lastRecordingBuffer
		}

		self.DATA.currentPlaybackBuffer = buffer
		self.DATA.lastSpeed = startSpeed
		self.queueCommand(`play ${buffer} ${startSpeed} ${startFrame}`)
		self.checkFeedbacks()
		self.checkVariables()

		self.rampingMode = true //set ramping mode to true to indicate in future attempts that we are ramping right now and should not do other ramps

		//now start an interval to check the current frame position, and when it reaches or passes the rampFrame, change the speed and make a note that we are in ramping mode
		let interval = setInterval(() => {
			if (self.DATA.pos >= rampFrame) {
				clearInterval(interval)
				if (transitionType == 'time') {
					self.startRampOverTime(buffer, rampSpeed, endSpeed, transitionTotalTime, transitionStepTime)
				} else if (transitionType == 'steps') {
					self.startRampOverSteps(buffer, rampSpeed, endSpeed, transitionTotalTime, transitionTotalSteps)
				}
			}
		}, 10) //check every 10ms
	},

	startRampOverTime: function (
		buffer,
		rampSpeed,
		rampFrame,
		endSpeed,
		endFrame,
		transitionTotalTime,
		transitionStepTime,
	) {
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
				self.queueCommand(`play ${buffer} ${currentSpeed}`)
				currentStep++
			} else {
				clearInterval(self.RAMPINTERVAL)
				self.queueCommand(`play ${buffer} ${endSpeed} ${endFrame}`)
				self.rampingMode = false
			}
		}, transitionStepTime)
	},

	startRampOverSteps: function (
		buffer,
		rampSpeed,
		rampFrame,
		endSpeed,
		endFrame,
		transitionTotalTime,
		transitionTotalSteps,
	) {
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
				self.queueCommand(`play ${buffer} ${currentSpeed} ${currentFrame}`)
				currentStep++
			} else {
				clearInterval(self.RAMPINTERVAL)
				self.queueCommand(`play ${buffer} ${endSpeed} ${endFrame}`)
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

		self.queueCommand('pause')

		self.DATA.currentlyPlaying = false //dont think we can call pos or mark_pos when paused
	},

	stop: function () {
		let self = this

		self.log('info', `Stopping Playback. Buffer: ${self.DATA.currentPlaybackBuffer}`)

		self.queueCommand('stop')

		self.DATA.currentlyPlaying = false
	},

	record: function (buffer = 0, freeBuffer = false) {
		let self = this

		if (buffer === 0) {
			//if no buffer specified, first determine the first free buffer to record to
			let found = false
			for (let i = 0; i < self.DATA.buffers.length; i++) {
				if (self.DATA.buffers[i].status.toLowerCase() === 'free') {
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
		} else {
			//make sure the requested buffer is free - if not, free it if the freeBuffer flag is set to true
			for (let i = 0; i < self.DATA.buffers.length; i++) {
				if (self.DATA.buffers[i].buffer === buffer) {
					if (self.DATA.buffers[i].status.toLowerCase() !== 'free') {
						if (freeBuffer == true) {
							self.freeBuffer(buffer)
						} else {
							self.log('warn', `Buffer ${buffer} is not free. Cannot record.`)
							return
						}
					}
				}
			}
		}

		//make sure buffer is not 0 before continuing
		if (buffer === 0) {
			self.log('warn', 'Cannot record to buffer 0. An error occured - this should not have happened.')
			return
		}

		//check the state of the buffer - it should only be free, otherwise we cannot record into it
		let bufferObj = self.DATA.buffers.find((bufferObj) => bufferObj.buffer === buffer)

		if (bufferObj) {
			if (bufferObj.status.toLowerCase() !== 'free') {
				self.log('warn', `Buffer ${buffer} is not free. Cannot record into a buffer that is not free.`)
				return
			}
		}

		//wait 20ms and then record
		setTimeout(() => {
			//first check that we are not recording on another buffer with a higher number
			if (self.DATA.currentlyRecording && self.DATA.currentRecordingBuffer > buffer) {
				if (self.config.forceSequentialRecording == true) {
					self.log(
						'warn',
						`Cannot record to Buffer ${buffer} when recording to Buffer ${self.DATA.currentRecordingBuffer} because the current recording buffer is a higher buffer than ${buffer}.`,
					)
					return
				}
			}

			self.DATA.lastRecordingBuffer = self.DATA.currentRecordingBuffer //store the last recording buffer for... reasons
			self.DATA.currentRecordingBuffer = buffer //set the new current recording buffer
			self.DATA.currentlyRecording = true
			self.log('info', `Recording to Buffer ${buffer}`)
			self.queueCommand(`rec ${buffer}`)
			self.checkFeedbacks()
			self.checkVariables()
		}, 20)
	},

	recordIntoEarliest: function () {
		let self = this

		//first determine the first free buffer to record to
		let found = false
		for (let i = 0; i < self.DATA.buffers.length; i++) {
			if (self.DATA.buffers[i].status.toLowerCase() === 'free') {
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

	recordStop: function (autoPlay, buffer, speed, pos) {
		let self = this

		if (self.DATA.currentlyRecording == true) {
			self.queueCommand('rec_stop')
		} else {
			self.log('warn', 'Cannot stop recording when not recording.')
			return
		}

		self.DATA.currentlyRecording = false //set to false after stopping
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

		if (autoPlay == true) {
			//if we are not playing anywhere else, automatically play this last recorded buffer at speed 0, after, say, 20ms
			//if buffer is 0, then use the last recorded buffer

			//have this whole process wait 20ms before continuing, to give the buffer status time to flip from record to used
			setTimeout(() => {
				if (buffer == 0) {
					buffer = self.DATA.lastRecordingBuffer || 1
				} else if (buffer == 'firstUsed') {
					//find the first buffer that has the status 'used'
					let firstUsedBuffer = self.DATA.buffers.find((buf) => buf.status?.toLowerCase() === 'used')

					if (firstUsedBuffer) {
						buffer = firstUsedBuffer.buffer
					} else {
						self.log('warn', 'No buffers are currently in use, cannot auto play a buffer just yet.')
						return
					}
				}

				if (self.DATA.currentlyPlaying == false) {
					self.log('info', `Auto-Playing Buffer ${buffer} at Speed ${speed} at Frame ${pos}.`)
					setTimeout(() => {
						self.play(buffer, speed, pos)
					}, 20)
				} else {
					self.log(
						'warn',
						`Cannot auto-play when already playing. Buffer ${self.DATA.currentPlaybackBuffer} is currently playing.`,
					)
				}
			}, 30)
		}

		self.checkFeedbacks()
		self.checkVariables()
	},

	markInFrame: function (pos) {
		let self = this

		if (self.DATA.currentlyPlaying == true) {
			self.queueCommand(`mark_in ${pos}`)
		} else {
			self.log('warn', 'Cannot mark in frame when not playing.')
		}
	},

	markOutFrame: function (pos) {
		let self = this

		if (self.DATA.currentlyPlaying == true) {
			self.queueCommand(`mark_out ${pos}`)
		} else {
			self.log('warn', 'Cannot mark out frame when not playing.')
		}
	},

	changeMode: function (name, mode) {
		let self = this

		self.log('info', `Changing ${name} to ${mode}`)

		self.queueCommand(`${name} ${mode}`)
	},

	seekToFrame: function (mode, pos) {
		let self = this

		if (self.DATA.currentlyPlaying == true) {
			self.queueCommand(`seek ${mode} ${pos} 0`)
		} else {
			self.log('warn', 'Cannot seek to frame when not playing.')
		}
	},

	freeBuffer: function (buffer, startRecording = false) {
		let self = this

		if (buffer !== 0) {
			//if we are not freeing all buffers
			//first check if we are currently recording to the buffer
			if (self.DATA.currentlyRecording == true && self.DATA.currentRecordingBuffer == buffer) {
				self.log('warn', `Cannot free Buffer ${buffer} while currently recording to it.`)
				return
			}
		} else {
			if (self.DATA.currentlyRecording == true) {
				self.log('warn', `Cannot free all buffers when recording to one of them.`)
				return
			}
		}

		//send the free command
		if (buffer === 0) {
			self.log('info', `Freeing All Buffers.`)

			self.queueCommand(`free ${buffer}`)

			//if we are freeing all buffers, reset the current recording buffer and current playback buffer
			self.DATA.currentRecordingBuffer = 0
			self.DATA.currentPlaybackBuffer = 0
			self.DATA.currentlyRecording = false
			self.DATA.currentlyPlaying = false

			//reset buffer pos data
			for (let i = 0; i < self.DATA.buffers.length; i++) {
				self.DATA.buffers[i].pos = 0
				self.DATA.buffers[i].speed = 0
				self.DATA.buffers[i].markIn = 0
				self.DATA.buffers[i].markOut = 0
				self.DATA.buffers[i].status = 'Free'
			}
		} else {
			self.log('info', `Freeing Buffer ${buffer}.`)

			self.queueCommand(`free ${buffer}`)

			//reset buffer pos data
			for (let i = 0; i < self.DATA.buffers.length; i++) {
				if (self.DATA.buffers[i].buffer === buffer) {
					self.DATA.buffers[i].pos = 0
					self.DATA.buffers[i].speed = 0
					self.DATA.buffers[i].markIn = 0
					self.DATA.buffers[i].markOut = 0
					self.DATA.buffers[i].status = 'Free'
					break
				}
			}

			//if we are freeing a specific buffer, check if it was the last recording buffer
			if (self.DATA.lastRecordingBuffer == buffer) {
				self.DATA.lastRecordingBuffer = 0
				self.DATA.currentlyRecording = false
			}

			//if we are freeing a specific buffer, check if it was the current playback buffer
			if (self.DATA.currentPlaybackBuffer == buffer) {
				self.DATA.currentPlaybackBuffer = 0
				self.DATA.currentlyPlaying = false
			}
		}

		self.checkFeedbacks()
		self.checkVariables()

		//if startRecording is true, start recording into the buffer after say 20ms
		//if buffer was 0, then we cleared all buffers, so just record into buffer 1 after 20ms
		if (buffer == 0) {
			buffer = 1
		}

		if (startRecording == true && self.DATA.currentlyRecording == false) {
			setTimeout(() => {
				self.record(buffer)
			}, 50) //this delay is directly related to the internal polling rate, if the internal polling rate is too high, this may need to be increased
		}
	},

	videoMode: function (mode) {
		let self = this

		self.log('info', `Changing Video Mode to ${mode}`)

		self.queueCommand(`video_mode ${mode}`)
	},

	frameRateMode: function (mode) {
		let self = this

		self.log('info', `Changing Frame Rate Mode to ${mode}`)

		self.queueCommand(`fps_mode ${mode}`)
	},

	phases: function (phases) {
		let self = this

		self.log('info', `Changing Phases to ${phases}`)

		self.queueCommand(`phases ${phases}`)
	},

	changeNetworkSettings: function (networkType, ip, subnet, gateway) {
		let self = this

		self.log(
			'info',
			`Changing Network Settings to ${networkType} with IP: ${ip}, Subnet: ${subnet}, Gateway: ${gateway}`,
		)

		//if dhcp, only send dhcp command
		if (networkType === 'dhcp') {
			self.queueCommand('ipv4 0')
		} else {
			self.queueCommand(`ipv4 1 ${ip} ${subnet} ${gateway}`)
		}

		self.queueCommand('save_settings')

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

		self.log('info', `Switching Mode to ${mode}`)

		self.queueCommand(`switch_mode ${mode}`)
	},

	reboot: function () {
		let self = this

		self.log('info', 'Rebooting Device.')

		self.queueCommand('reboot')
	},

	shutdown: function () {
		let self = this

		self.log('info', 'Shutting Down Device.')

		self.queueCommand('shutdown')
	},

	queueCommand: function (command) {
		let self = this

		if (self.WS) {
			//only add the command to the queue if it is not already in there, no need to flood it with the regular polling stuff
			if (self.commandQueue.includes(command) == false) {
				if (self.config.verbose) {
					self.log('debug', `Queueing Command: ${command}`)
				}
				self.commandQueue.push(command)
			}

			//go ahead and check the queue after, say, 50ms
			setTimeout(() => {
				self.checkQueue()
			}, 50)
		} else {
			self.log('warn', 'Websocket not connected. Command not queued.')
		}
	},

	checkQueue: function () {
		let self = this

		if (self.commandQueue.length > 0 && self.WS) {
			if (self.config.verbose) {
				self.log('debug', `Checking Command Queue: ${self.commandQueue.length} commands.`)
			}

			let command = self.commandQueue.shift()
			self.sendCommand(command)
		}
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

		if (self.INTERVAL) {
			self.log('info', 'Stopping Polling Interval.')

			clearInterval(self.INTERVAL)
			self.INTERVAL = null
		}
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
