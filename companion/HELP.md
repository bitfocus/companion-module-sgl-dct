# SGL DCT

This module will allow you to control SGL DCT Slow Motion cameras.

## Configuration Options:

-   IP/Port of Device
-   Specify Recording Buffers (1-4)
-   Specify Record Mode (Loop, Once)
-   Specify Stop Mode (Live, Black, Color Bars)

## Actions:

-   Play/Pause/Rewind/Fast-Forward (Select Buffer: Based on config (1-4); Speed: (-100x - 100x) (optional); Specify Frame (optional))
-   Record (Use Next Available or Specify Buffer)
-   Record Stop
-   Mark In Frame (Use current position or specify position)
-   Mark Out Frame (Use current position or specify position)
-   Change Recording Mode (Loop, Once)
-   Change Playback Mode (Loop, Once)
-   Change Stop Mode (Live, Black, Color Bars)
-   Seek to Frame (Mode: Relative, Absolute; Position/Frames to seek)
-   Free Buffer (Select Buffer)
-   Change Networking Settings
-   Switch Device Mode
-   Reboot Device
-   Shutdown Device
-   Run Custom Command

_All text input fields support parsing for variable values._

## Feedbacks:

-   Buffer (buffer ID) Status: (Free, Used, Record, Play, Pause)
-   Recording Mode is X (Loop, Once)
-   Playback Mode is X (Loop, Once)
-   Stop Mode is X (Live, Black, Color Bars)

## Variables:

-   Buffer (buffer ID) Frames Recorded
-   Buffer (buffer ID) Frames Available
-   Buffer (buffer ID) Status (Free, Used, Record, Play, Pause)
-   Current Recording Buffer (1-4)
-   Current Playback Buffer (1-4)
-   Current Recording Mode (Loop, Once)
-   Current Playback Mode (Loop, Once)
-   Current Stop Mode (Live, Black, Color Bars)
-   Current Frame Position of Playback Buffer
-   Current Playback Marker In
-   Current Playback Marker Out
