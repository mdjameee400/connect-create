# Connect & Create

Product Requirement Document (PRD)

Project: "Connect Orbital" – Integrated Async Recording & Sync Video Calling

1. Executive Summary

Modern work communication is fractured. Teams constantly jump between synchronous tools (Zoom, Google Meet) for live discussions and asynchronous tools (Loom, Vidyard) to share quick updates.

Connect Orbital bridges this gap by merging both communication styles into a single, seamless desktop application. It empowers users to choose the most efficient communication path instantly: record a quick 2-minute walkthrough or launch a live team sync, all from one unified dashboard.

2. Target Audience & User Personas

The Remote Software Engineer (Alex): Needs to record quick bug demos asynchronously to avoid interrupting focus time, but occasionally needs to hop on a live debug call with team members.

The Product Manager (Sarah): Conducts live syncs with stakeholders but prefers sharing daily updates via concise screen recordings to keep calendars clean.

The Educator/Trainer (Dave): Records instructional videos for offline viewing and hosts live, interactive Q&A sessions.

3. Key Features & Functional Requirements

The application is split into three core functional modules: Async Recorder, Sync Live Meetings, and the Unified Hub.

Module A: The Screen Recorder (Asynchronous)

Recording Modes: Capture "Full Screen," "Specific Window," or "Custom Region."

Audio & Video Feeds:

Toggle system audio on/off.

Toggle microphone audio on/off.

Optional circular webcam overlay ("Facecam") with customizable position.

Local Rendering & Cloud Upload: Video records locally for maximum quality (bypassing lag). Upon stopping, it instantly begins a background upload to secure cloud storage.

Instant Share Link: Generates a shareable URL to the clipboard the second the recording stops.

Module B: Video Calling (Synchronous)

Instant Meetings: One-click to generate a meeting room and copy a join link.

Scheduled Meetings: A view of upcoming calendar syncs with a single-click "Join Now" button.

Core Call Functionality:

High-definition video and audio streaming (up to 1080p).

Real-time in-call screen sharing.

Native in-call text chat and participant list.

Active Teammates Directory: A quick-dial list showing who is online/busy with an instant "Call" button.

Module C: Unified Dashboard & Library (The Hub)

Dual-Column Layout: As designed, a clean separation of the 'Record' pane and the 'Meet' pane for zero cognitive friction.

Media Library: A history of past recordings with view counts, edit options (trim), and fast sharing features.

4. User Flows

Flow 1: The Quick-Share Demo (Asynchronous)

[User clicks "Start Recording"] 
       │
       ▼
[Selects Screen/Window] ──► [3-2-1 Countdown] ──► [Recording Active]
                                                         │
                                                         ▼
[User Clicks "Stop Recording"] ◄─────────────────────────┘
       │
       ├─► [Video preview opens in local library]
       └─► [Video uploads to cloud in background + Copy URL to clipboard]


Flow 2: Setting up an Ad-hoc Meeting (Synchronous)

[User clicks "Start Instant Meeting"]
       │
       ▼
[App requests Cam/Mic permissions] ──► [Meeting Room Launches]
                                              │
                                              ├─► [Pop-up: "Invite link copied!"]
                                              └─► [User waits for teammates to join]


5. High-Level Technical Architecture

To achieve low latency and native performance, a desktop wrapper architecture is recommended:

ComponentTechnologyPurposeFrontend FrameworkReact / ElectronCross-platform compatibility (macOS/Windows) with access to native desktop recording APIs.Live Call EngineWebRTC + SFU (e.g., LiveKit or MediaSoup)Low-latency, high-quality audio and video routing for group calls.Recording EngineMediaRecorder API / Native OS CaptureCapturing high-definition local streams without network interference.Storage & HostingAWS S3 + CloudFront CDNFast cloud video delivery and secure file hosting.DatabasePostgreSQL / RedisManaging user accounts, meeting schedules, and video metadata.

6. Key Performance Indicators (KPIs) & Success Metrics

Monthly Active Users (MAU): Measuring overall platform adoption.

Asynchronous-to-Synchronous Ratio: Tracking whether users are shifting meetings to screen recordings (Target: $40\%$ of communications handled via async recordings).

Call Quality Drop-off Rate: Ensuring live call packet loss remains under $1.5\%$.

Time to Link Share: The duration between clicking "Stop Recording" and the sharing link being ready (Target: $< 3\text{ seconds}$).



<!DOCTYPE html>

<html lang="en">

<head>

    <meta charset="UTF-8">

    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <title>Simple Screen Recorder</title>

    <style>

        body {

            font-family: Arial, sans-serif;

            text-align: center;

            padding: 50px;

            background-color: #f4f4f9;

        }

        button {

            padding: 12px 24px;

            font-size: 16px;

            margin: 10px;

            cursor: pointer;

            border: none;

            border-radius: 5px;

            font-weight: bold;

        }

        #start { background-color: #28a745; color: white; }

        #stop { background-color: #dc3545; color: white; }

        #download { background-color: #007bff; color: white; display: none; }

        video {

            margin-top: 20px;

            width: 80%;

            max-width: 600px;

            border: 2px solid #ccc;

            border-radius: 8px;

        }

    </style>

</head>

<body>

    <h1>Web Screen Recorder</h1>

    <button id="start">Start Recording</button>

    <button id="stop" disabled>Stop Recording</button>

    <br>

    <video id="preview" controls autoplay muted></video>

    <br>

    <a id="download">Download Recording</a>

    <script>

        const startBtn = document.getElementById('start');

        const stopBtn = document.getElementById('stop');

        const preview = document.getElementById('preview');

        const downloadLink = document.getElementById('download');

        let mediaRecorder;

        let recordedChunks = [];

        startBtn.addEventListener('click', async () => {

            try {

                // 1. Request permission to capture screen and audio

                const screenStream = await navigator.mediaDevices.getDisplayMedia({

                    video: { frameRate: { ideal: 30 } },

                    audio: true // Captures system audio if shared

                });

                // 2. Show the live stream in the video element

                preview.srcObject = screenStream;

                recordedChunks = [];

                // 3. Initialize the MediaRecorder

                mediaRecorder = new MediaRecorder(screenStream, {

                    mimeType: 'video/webm; codecs=vp9'

                });

                // 4. Collect video chunks as they become available

                mediaRecorder.ondataavailable = (e) => {

                    if (e.data.size > 0) {

                        recordedChunks.push(e.data);

                    }

                };

                // 5. Handle recording stop

                mediaRecorder.onstop = () => {

                    const blob = new Blob(recordedChunks, { type: 'video/webm' });

                    const videoURL = URL.createObjectURL(blob);

                    

                    // Stop all stream tracks to release the hardware (camera/screen share icon)

                    screenStream.getTracks().forEach(track => track.stop());

                    

                    preview.srcObject = null;

                    preview.src = videoURL;

                    // Setup the download link

                    downloadLink.href = videoURL;

                    downloadLink.download = `screen-recording-${Date.now()}.webm`;

                    downloadLink.style.display = 'inline-block';

                    downloadLink.textContent = "Download Video";

                };

                // Start recording

                mediaRecorder.start();

                startBtn.disabled = true;

                stopBtn.disabled = false;

            } catch (err) {

                console.error("Error accessing media devices: ", err);

                alert("Permission denied or error starting recording.");

            }

        });

        stopBtn.addEventListener('click', () => {

            mediaRecorder.stop();

            startBtn.disabled = false;

            stopBtn.disabled = true;

        });

    </script>

</body>

</html>

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/51bffc6d-fa98-47f2-b162-a7320629346f).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
