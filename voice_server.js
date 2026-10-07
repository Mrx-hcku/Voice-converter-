const express = require('express');
const multer = require('multer');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Multer setup for temporary audio upload storage
const upload = multer({ dest: 'uploads/' });

app.use(express.static('public'));
app.use(express.json());

// Enable CORS for frontend testing
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Health check endpoint
app.get('/', (req, res) => {
  res.send('Voice Changer Microservice is running successfully!');
});

// Voice transformation endpoint using FFmpeg Formant Shifting
app.post('/convert-voice', upload.single('audio'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No audio file uploaded' });
  }

  const inputPath = req.file.path;
  const targetGender = req.body.targetGender || 'female'; // 'female' or 'male'
  const outputPath = path.join('uploads', `converted_${Date.now()}.wav`);

  let ffmpegCommand = '';
  if (targetGender === 'female') {
    // Pitch shift up + formant preservation approximation
    ffmpegCommand = `ffmpeg -i ${inputPath} -af "asetrate=44100*1.2,atempo=1/1.2" ${outputPath}`;
  } else {
    // Male: pitch shift down
    ffmpegCommand = `ffmpeg -i ${inputPath} -af "asetrate=44100*0.85,atempo=1/0.85" ${outputPath}`;
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
  console.log(`Voice changer server listening on port ${PORT}`);
});
