const { InstanceBase, InstanceStatus, runEntrypoint } = require('@companion-module/base')

const UpgradeScripts = require('./src/upgrades')

const configFields = require('./src/configFields')
const actions = require('./src/actions')
const feedbacks = require('./src/feedbacks')
const variables = require('./src/variables')

const constants = require('./src/constants')
const api = require('./src/api')

class DCTInstance extends InstanceBase {
	constructor(internal) {
		super(internal)

		// Assign the methods from the listed files to this class
		Object.assign(this, {
			...configFields,
			...actions,
			...feedbacks,
			...variables,
			...constants,
			...api,
		})

		this.WS = undefined //websocket connection to camera
		this.INTERVAL = undefined //interval for polling data

		this.RECONNECT_INTERVAL = undefined

		this.RAMPINTERVAL = undefined

		this.DATA = {
			buffers: [],
			lastRecordingBuffer: 0,
			currentRecordingBuffer: 0,
			lastRecordingBuffer: 0,
			currentlyRecording: false,
			currentPlaybackBuffer: 0,
			currentlyPlaying: false,
			lastSpeed: 0,
			recordingMode: '',
			playbackMode: '',
			stopMode: '',
			currentFramePosition: 0,
			currentPlaybackMarkerIn: 0,
			currentPlaybackMarkerOut: 0,
		}
	}

	async init(config) {
		this.configUpdated(config)
	}

	async configUpdated(config) {
		if (config) {
			this.config = config
		}

		this.updateStatus(InstanceStatus.Connecting)

		this.loadBufferCount()

		this.initActions()
		this.initFeedbacks()
		this.initVariables()
		this.checkVariables()

		this.initConnection()
	}

	async destroy() {
		//close out any connections
		this.closeConnection()
		this.stopInterval()
	}
}

runEntrypoint(DCTInstance, UpgradeScripts)
