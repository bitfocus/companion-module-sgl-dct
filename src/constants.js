module.exports = {
	CHOICES_BUFFERS: [
		{ id: '1', label: 'Buffer 1' },
		{ id: '2', label: 'Buffer 2' },
		{ id: '3', label: 'Buffer 3' },
		{ id: '4', label: 'Buffer 4' },
	],

	CHOICES_SPEEDS: [
		{ id: -1000, label: 'Backward x100' },
		{ id: -100, label: 'Backward x10' },
		{ id: -50, label: 'Backward x5' },
		{ id: -10, label: 'Backward x1' },
		{ id: -5, label: 'Backward x1/2' },
		{ id: 0, label: 'Pause' },
		{ id: 5, label: 'Forward x1/2' },
		{ id: 10, label: 'Forward x1' },
		{ id: 50, label: 'Forward x5' },
		{ id: 100, label: 'Forward x10' },
		{ id: 1000, label: 'Forward x100' },
	],

	CHOICES_RECORDING_MODE: [
		{ id: '0', label: 'Loop' },
		{ id: '1', label: 'Once' },
	],

	CHOICES_PLAYBACK_MODE: [
		{ id: '0', label: 'Loop' },
		{ id: '1', label: 'Once' },
	],

	CHOICES_STOP_MODE: [
		{ id: '0', label: 'Live' },
		{ id: '1', label: 'Black' },
		{ id: '2', label: 'Color Bars' },
	],

	CHOICES_SEEK_MODE: [
		{ id: '1', label: 'Absolute' },
		{ id: '0', label: 'Relative' },
	],

	CHOICES_BUFFER_STATUS: [
		{ id: 'free', label: 'Free' },
		{ id: 'used', label: 'Used' },
		{ id: 'record', label: 'Record' },
		{ id: 'play', label: 'Play' },
		{ id: 'pause', label: 'Pause' },
		{ id: 'other', label: 'Other' },
	],

	CHOICES_VIDEO_MODES: [
		{ id: '4', label: '1080p30', frameRate: 30 },
		{ id: '5', label: '1080p25', frameRate: 25 },
		{ id: '6', label: '1080p24', frameRate: 24 },
		{ id: '7', label: '1080p23.98', frameRate: 23.98 },
		{ id: '8', label: '1080p29.97', frameRate: 29.97 },
		{ id: '9', label: '1080p50', frameRate: 50 },
		{ id: '10', label: '1080p60', frameRate: 60 },
		{ id: '11', label: '1080i60', frameRate: 60 },
		{ id: '12', label: '1080i50', frameRate: 50 },
		{ id: '13', label: '1080i59.94', frameRate: 59.94 },
		{ id: '14', label: '1080p59.94', frameRate: 59.94 },
	],
}
