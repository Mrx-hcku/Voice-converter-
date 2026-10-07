const express = require('express');
const multer = require('multer');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

const upload = multer({ dest: 'uploads/' });

app.use(express.json());

// CORS enable kiya hai taaki kahin se bhi request chale
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Test/Landing HTML page for smooth browser mic testing
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Voice Changer Test Panel</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #090d16; color: #f1f5f9; padding: 20px; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
        .container { background: #111827; padding: 30px; border-radius: 16px; width: 100%; max-width: 440px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); border: 1px solid #1f2937; }
        h2 { text-align: center; margin-bottom: 8px; color: #38bdf8; font-size: 24px; }
        .subtitle { text-align: center; color: #94a3b8; font-size: 13px; margin-bottom: 24px; }
        .form-group { margin-bottom: 20px; }
        label { display: block; font-size: 14px; margin-bottom: 8px; color: #cbd5e1; font-weight: 500; }
        input[type="text"], select { width: 100%; padding: 12px; border-radius: 8px; background: #1f2937; color: white; border: 1px solid #374151; font-size: 14px; outline: none; }
        .btn-container { text-align: center; margin-top: 10px; }
        button { background: #3b82f6; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-size: 15px; font-weight: 600; width: 100%; transition: background 0.2s; }
        button.recording { background: #ef4444; }
        .status-box { margin-top: 16px; text-align: center; font-size: 13px; color: #94a3b8; background: #1f2937; padding: 8px; border-radius: 6px; }
        .audio-section { margin-top: 20px; border-top: 1px solid #1f2937; padding-top: 15px; }
        .audio-section h4 { font-size: 13px; color: #94a3b8; margin-bottom: 6px; text-transform: uppercase; }
        audio { width: 100%; height: 36px; border-radius: 6px; }
    </style>
</head>
<body>
    <div class="container">
        <h2>Voice Changer Hub</h2>
        <p class="subtitle">Rubberband Natural Formant Filter</p>
        
        <div class="form-group">
            <label for="serverUrl">Backend Server URL:</label>
            <input type="text" id="serverUrl" value="" placeholder="Server URL">
        </div>

        <div class="form-group">
            <label for="targetGender">Select Effect:</label>
            <select id="targetGender">
                <option value="female">Male to Female</option>
                <option value="male">Female to Male</option>
            </select>
        </div>

        <div class="btn-container">
            <button id="recordBtn" onclick="toggleRecording()">Start Recording</button>
        </div>

        <div id="status" class="status-box">Status: Ready</div>

        <div class="audio-section">
            <h4>Original Recording</h4>
            <audio id="audioOriginal" controls></audio>
        </div>

        <div class="audio-section">
            <h4>Converted Voice Output</h4>
            <audio id="audioConverted" controls></audio>
        </div>
    </div>

    <script>
        document.getElementById('serverUrl').value = window.location.origin;

        let mediaRecorder;
        let audioChunks = [];
        let isRecording = false;

        const recordBtn = document.getElementById('recordBtn');
        const statusText = document.getElementById('status');
        const audioOriginal = document.getElementById('audioOriginal');
        const audioConverted = document.getElementById('audioConverted');
        const targetGenderSelect = document.getElementById('targetGender');
        const serverUrlInput = document.getElementById('serverUrl');

        async function toggleRecording() {
            if (!isRecording) {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    mediaRecorder = new MediaRecorder(stream);
                    audioChunks = [];

                    mediaRecorder.ondataavailable = event => {
                        if (event.data.size > 0) audioChunks.push(event.data);
                    };

                    mediaRecorder.onstop = async () => {
                        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                        audioOriginal.src = URL.createObjectURL(audioBlob);

                        const endpoint = serverUrlInput.value.trim().replace(/\\/+$/, '') + '/convert-voice';
                        statusText.innerText = "Status: Uploading & Converting...";

                        const formData = new FormData();
                        formData.append('audio', audioBlob, 'voice.wav');
                        formData.append('targetGender', targetGenderSelect.value);

                        try {
                            const response = await fetch(endpoint, { method: 'POST', body: formData });
                            if (response.ok) {
                                const convertedBlob = await response.blob();
                                audioConverted.src = URL.createObjectURL(convertedBlob);
                                statusText.innerText = "Status: Success!";
                            } else {
                                statusText.innerText = "Status: Failed (" + response.status + ")";
                            }
                        } catch (err) {
                            statusText.innerText = "Status: Network Error!";
                        }
                    };

                    mediaRecorder.start();
                    isRecording = true;
                    recordBtn.innerText = "Stop Recording";
                    recordBtn.classList.add('recording');
                    statusText.innerText = "Status: Recording...";
                    audioConverted.src = "";
                } catch (err) {
                    alert('Mic permission denied or protocol not supported.');
                }
            } else {
                mediaRecorder.stop();
                isRecording = false;
                recordBtn.innerText = "Start Recording";
                recordBtn.classList.remove('recording');
                statusText.innerText = "Status: Processing...";
            }
        }
    </script>
</body>
</html>`);
});

// Voice transformation endpoint using Rubberband Formant Shifting
app.post('/convert-voice', upload.single('audio'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No audio file uploaded' });
  }

  const inputPath = req.file.path;
  const targetGender = req.body.targetGender || 'female';
  const outputPath = path.join('uploads', `converted_${Date.now()}.wav`);

  let ffmpegCommand = '';
  if (targetGender === 'female') {
    // Advanced rubberband filter for natural female conversion
    ffmpegCommand = `ffmpeg -i ${inputPath} -af "rubberband=pitch=1.35:formant=shift" ${outputPath}`;
  } else {
    // Advanced rubberband filter for natural male conversion
    ffmpegCommand = `ffmpeg -i ${inputPath} -af "rubberband=pitch=0.75:formant=shift" ${outputPath}`;
  }

  exec(ffmpegCommand, (err, stdout, stderr) => {
    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);

    if (err) {
      console.error('FFmpeg error:', err);
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      return res.status(500).json({ error: 'Audio processing failed', details: err.message });
    }

    res.download(outputPath, 'converted_voice.wav', (downloadErr) => {
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    });
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
